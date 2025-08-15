import 'server-only';
import OpenAI from 'openai';
import { z } from 'zod';

/** ===== Types & Schema ===== */
export type SearchType = 'plot' | 'title';
export type Task = 'listicle' | 'plain_search' | 'find_similar';

const ParsedQuerySchema = z.object({
  task: z.enum(['listicle', 'plain_search', 'find_similar']).default('listicle'),
  n: z.number().int().min(1).max(50).default(10),
  searchType: z.enum(['plot', 'title']).default('plot'),
  candidate_title: z.string().trim().optional().default(''),
  semantic_query: z.string().trim().default(''),
  genres: z.array(z.string().trim()).default([]),
  keywords: z.array(z.string().trim()).default([]),
  soft_constraints: z.array(z.string().trim()).default([]),
  confidence: z.number().min(0).max(1).default(0.6),
});

export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

/** ===== Canonical genres discovered from your dataset =====
 * Action, Adventure, Animation, Comedy, Crime, Drama, Family, Fantasy,
 * History, Horror, Music, Mystery, Romance, Science Fiction, TV Movie,
 * Thriller, War, Western
 */
const CANON_GENRES = [
  'Action','Adventure','Animation','Comedy','Crime','Drama','Family','Fantasy',
  'History','Horror','Music','Mystery','Romance','Science Fiction','TV Movie',
  'Thriller','War','Western'
] as const;
type Canon = typeof CANON_GENRES[number];

/** ===== Synonym map → canonical =====
 * This lets users say "sci fi", "scifi", "romcom", "cowboy", "military", etc.
 * Add/adjust freely as you see more queries.
 */
const GENRE_CANON: Record<Canon, string[]> = {
  Action: ['action','superhero','martial arts','high-octane','guns','car chase','fight'],
  Adventure: ['adventure','quest','expedition','journey','exploration','swashbuckling'],
  Animation: ['animation','animated','anime','cartoon','pixar','cg'],
  Comedy: ['comedy','funny','humor','satire','parody','romcom','rom-com'],
  Crime: ['crime','gangster','heist','mob','noir','organized crime','detective'],
  Drama: ['drama','dramatic','character study','tearjerker','biopic'],
  Family: ['family','family-friendly','kids','children'],
  Fantasy: ['fantasy','magic','mythical','sword and sorcery','fairy tale'],
  History: ['history','historical','period piece','biographical history'],
  Horror: ['horror','scary','slasher','supernatural horror','creature feature'],
  Music: ['music','musical','concert','band'],
  Mystery: ['mystery','whodunit','detective','investigation','sleuth'],
  Romance: ['romance','love story','romantic','romcom','rom-com'],
  'Science Fiction': ['sci fi','sci-fi','scifi','science fiction','space','cyberpunk','time travel','dystopian','alien'],
  'TV Movie': ['tv movie','made for tv','television movie'],
  Thriller: ['thriller','suspense','edge-of-your-seat','conspiracy','psychological thriller'],
  War: ['war','military','WWII','world war','soldier','battlefield'],
  Western: ['western','cowboy','frontier','gunslinger','spaghetti western'],
};

/** ===== Utilities ===== */
function canonicalizeGenres(rawTerms: string[]): string[] {
  const out = new Set<string>();
  const lowerTerms = rawTerms.map((s) => s.toLowerCase());

  // 1) Direct case-insensitive match to canonical keys
  for (const canon of CANON_GENRES) {
    if (lowerTerms.some((t) => t === canon.toLowerCase())) {
      out.add(canon);
    }
  }

  // 2) Synonym hit or substring include
  for (const [canon, syns] of Object.entries(GENRE_CANON) as [Canon, string[]][]) {
    const found = syns.some((syn) => {
      const s = syn.toLowerCase();
      return lowerTerms.some((t) => t.includes(s));
    });
    if (found) out.add(canon);
  }

  return Array.from(out);
}

function looksLikeTitle(raw: string): boolean {
  // Heuristics: very short or "movies like/similar to ..."
  if (/\b(similar to|like)\b/i.test(raw)) return true;
  const tokens = raw.trim().split(/\s+/);
  return tokens.length <= 3; // short strings likely titles (e.g., "Gravity", "The Batman")
}

function extractN(raw: string): number | undefined {
  // Prefer "top 7" then any bare number (be careful not to grab years)
  const m = raw.match(/\btop\s*(\d{1,2})\b/i) || raw.match(/\b(\d{1,2})\b/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  if (Number.isFinite(n) && n >= 1 && n <= 50) return n;
  return undefined;
}

function basicKeywords(raw: string): string[] {
  const STOP = new Set([
    'the','a','an','of','and','or','to','for','with','in','under','over','like','similar',
    'movies','movie','films','film','top','best','list','show','me','find','give','up',
  ]);
  return raw
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .slice(0, 12);
}

/** ===== LLM prompt ===== */
function buildParserPrompt(raw: string) {
  return [
    {
      role: 'system' as const,
      content:
        `You are an intent parser for a movie search engine.\n` +
        `Return ONLY a JSON object with fields: ` +
        `task, n, searchType, candidate_title, semantic_query, genres, keywords, soft_constraints, confidence.\n` +
        `Decide searchType: if the user wants "movies like <TITLE>" or provides a likely film title, use "title"; otherwise "plot".\n` +
        `Extract n (count) if present; default 10.\n` +
        `Only 'genres' and 'overview' exist in the dataset. If a constraint cannot be enforced (e.g., runtime, year), put it in soft_constraints and do not claim it as a hard filter.\n` +
        `Canonicalize genres to this set exactly: ${CANON_GENRES.join(', ')}.\n` +
        `Map user phrasings to canonical genres using synonyms when appropriate.\n` +
        `keywords are BM25 terms; semantic_query is a cleaned natural-language string.\n` +
        `confidence is 0..1.`,
    },
    { role: 'user' as const, content: `Query: "${raw}"\n\nOutput strictly valid JSON. No extra text.` },
  ];
}

/** ===== Heuristic fallback (no LLM) ===== */
function heuristicParse(raw: string): ParsedQuery {
  const n = extractN(raw) ?? 10;
  const searchType: SearchType = looksLikeTitle(raw) ? 'title' : 'plot';
  // crude genre detection: look for synonyms in the whole raw string
  const genres = canonicalizeGenres([raw]);
  const keywords = basicKeywords(raw);
  const candidate_title = searchType === 'title' ? raw.trim() : '';
  const semantic_query = raw.trim();
  // record non-enforceable constraints as "soft"
  const soft_constraints: string[] = [];
  if (/\bunder\b\s*\d/.test(raw)) soft_constraints.push('runtime');
  return ParsedQuerySchema.parse({
    task: 'listicle',
    n,
    searchType,
    candidate_title,
    semantic_query,
    genres,
    keywords,
    soft_constraints,
    confidence: 0.5,
  });
}

/** ===== Main entry ===== */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function parseQuery(raw: string): Promise<ParsedQuery> {
  const obviousTitle = looksLikeTitle(raw);
  try {
    const messages = buildParserPrompt(raw);
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: messages as any,
      response_format: { type: 'json_object' },
    });
    const content = resp.choices[0]?.message?.content ?? '';
    const json = JSON.parse(content);
    const parsed = ParsedQuerySchema.safeParse(json);
    if (parsed.success) {
      const p = parsed.data;
      return {
        ...p,
        // normalize & clamp
        genres: canonicalizeGenres(p.genres),
        keywords: p.keywords.slice(0, 12),
        n: Math.max(1, Math.min(p.n, 50)),
        searchType: p.searchType || (obviousTitle ? 'title' : 'plot'),
        semantic_query: p.semantic_query || raw.trim(),
      };
    }
    return heuristicParse(raw);
  } catch {
    return heuristicParse(raw);
  }
}