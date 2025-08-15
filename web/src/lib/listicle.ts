import 'server-only';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

// Keep reasons concise; keep token usage predictable
const MAX_OVERVIEW = 500;

export type Candidate = {
  id: string;
  title: string;
  genres: string[];
  overview: string; // we’ll supply this from metadata.text or overview
};

export type ListicleItem = {
  title: string;
  reason: string;
  ref: number; // 1-based index into the context array
};

export type ListicleResult = {
  items: ListicleItem[];
  raw: string; // original model text (for debugging)
};

// Build compact context lines like: [#1] Inception — Genres: [Action, Sci-Fi] — Overview: …
export function buildContextPack(cands: Candidate[]) {
  const numbered = cands.map((c, i) => {
    const trimmed =
      (c.overview || '')
        .replace(/\s+/g, ' ')
        .slice(0, MAX_OVERVIEW) + ((c.overview || '').length > MAX_OVERVIEW ? '…' : '');
    const g = (c.genres || []).join(', ');
    return `[#${i + 1}] ${c.title} — Genres: [${g}] — Overview: ${trimmed}`;
  });
  return numbered.join('\n');
}

const systemPrompt = `
You are a precise, grounded movie recommender. You must ONLY use the provided candidates.
Do NOT invent titles, years, runtimes, awards, or facts not present in the context.
When the user requests constraints that are not in the context (e.g., runtime), IGNORE them silently.
Write concise, punchy one-sentence reasons based on the overviews/genres.
For each item, include a citation to the corresponding [#i].
Output a numbered list (1..N). No extra commentary.
`.trim();

const userPromptTpl = `
Make a numbered list of {n} movies that best match:

"{query}"

Use only the candidates below. Each line format:
"1) Title — one-sentence reason [#i]"

Candidates:
{context}
`.trim();

const prompt = ChatPromptTemplate.fromMessages([
  ['system', systemPrompt],
  ['user', userPromptTpl],
]);

const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0.2,
});

const chain = prompt.pipe(model).pipe(new StringOutputParser());

export async function generateListicle(args: {
  query: string;
  n: number;
  candidates: Candidate[];
}): Promise<ListicleResult> {
  const { query, n, candidates } = args;
  const context = buildContextPack(candidates);

  const raw = await chain.invoke({ query, n, context });

  // Very light parser: extract numbered items and [#i] refs
  // (We keep parsing forgiving; UI can still show raw if needed.)
  const lines = raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^\d+\)/.test(s));

  const items: ListicleItem[] = lines.slice(0, n).map((line) => {
    // 1) Title — reason [#i]
    const mRef = line.match(/\[#(\d+)\]/);
    const ref = mRef ? parseInt(mRef[1], 10) : 0;

    // Strip leading "1) "
    const noNum = line.replace(/^\d+\)\s*/, '');

    // Split on em dash / hyphen dash combos
    const parts = noNum.split(/\s+—\s+| - /);
    const title = (parts[0] || '').trim();
    const reason = (parts.slice(1).join(' — ') || '').replace(/\s*\[#\d+\]\s*$/, '').trim();

    return {
      title,
      reason,
      ref: Number.isFinite(ref) ? ref : 0,
    };
  });

  return { items, raw };
}