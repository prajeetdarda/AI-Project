import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { NextResponse } from 'next/server';
import { embedQuery } from '@/lib/embeddings_openai';
import { getIndex } from '@/lib/pinecone';
import { bm25Search, findTopTitle } from '@/lib/opensearch';
import { parseQuery } from '@/lib/intent';
import { generateListicle } from '@/lib/listicle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function minMax(scores: number[]) {
  if (!scores.length) return (_: number) => 0;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const denom = max - min || 1e-6;
  return (x: number) => (x - min) / denom;
}
function extractCandidateTitle(raw: string): string | undefined {
  const s = raw.trim();

  // 1) quoted title → "The Batman"
  const mQuoted = s.match(/["“”'’]([^"“”'’]+)["“”'’]/);
  if (mQuoted) return mQuoted[1].trim();

  // 2) patterns like: movies similar to X / similar to X / like X
  const mLike =
    s.match(/\b(?:movies?|films?)\s+(?:similar\s+to|like)\s+(.+)$/i) ||
    s.match(/\b(?:similar\s+to|like)\s+(.+)$/i);
  if (mLike) return mLike[1].trim();

  // 3) short, Title‑Cased strings → treat as a title (e.g., "Gravity", "The Batman")
  if (/^[A-Z][\w'’:-]*(\s+[A-Z][\w'’:-]*){0,3}$/.test(s)) return s;

  // 4) last‑token fallback (handles “similar to batman” → “batman”)
  const toks = s.split(/\s+/);
  const last = toks[toks.length - 1];
  if (last && last.length >= 3) return last;

  return undefined;
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    // ---- 1) Parse intent ----
    const parsed = await parseQuery(query);
    const N = Math.max(1, Math.min(parsed.n || 7, 20)); // final list size (cap 20)
    const genres = parsed.genres ?? [];
    console.log('[parseQuery parsed object] inside listicle/route.ts', parsed);

    // ---- 2) Decide seed text (title vs plot) ----
    let seedText = parsed.semantic_query || query;
    let seed = { id: undefined as string | undefined, title: undefined as string | undefined };

    if (parsed.searchType === 'title') {
        const candidate =
            parsed.candidate_title?.trim() ||
            extractCandidateTitle(query) ||              // <-- NEW fallback
            parsed.semantic_query || query;

        const hit = await findTopTitle(candidate);
      //const hit = await findTopTitle(parsed.candidate_title || query);
      if (hit?.text) {
        seedText = hit.text;
        seed = { id: hit.id, title: hit.title };
      }
    }

    // ---- 3) Hybrid retrieval (pull deep) ----
    const vecK = Math.max(60, N * 8); // breadth for selection
    const bmK = Math.max(60, N * 8);

    // Pinecone
    const qvec = await embedQuery(seedText);
    const pIndex = getIndex();
    const pineFilter = genres.length ? { genres: { $in: genres } } : undefined;

    const vecRes = await pIndex.query({
      vector: qvec,
      topK: vecK,
      includeMetadata: true,
      filter: pineFilter,
    });

    const vecMatches = (vecRes.matches ?? []).map((m) => {
      const md = (m.metadata ?? {}) as any;
      return {
        id: m.id,
        title: md.title ?? '',
        genres: (md.genres ?? []) as string[],
        text: md.text ?? '',
        score_vec: m.score ?? 0,
      };
    });

    // OpenSearch
    const bmItems = await bm25Search({
      query: seedText,
      genres,
      k: bmK,
    });

    // Normalize + fuse (alpha leaning semantic)
    const alpha = 0.6;
    const vecById = new Map(vecMatches.map((m) => [m.id, m]));
    const bmById = new Map(bmItems.map((m) => [m.id, m]));
    const normVec = minMax(vecMatches.map((m) => m.score_vec));
    const normBm = minMax(bmItems.map((m) => m.score));

    const ids = new Set<string>([...vecById.keys(), ...bmById.keys()]);
    const fused = Array.from(ids).map((id) => {
      const v = vecById.get(id);
      const b = bmById.get(id);
      const nv = v ? normVec(v.score_vec) : 0;
      const nb = b ? normBm(b.score) : 0;
      const combined = alpha * nv + (1 - alpha) * nb;
      return {
        id,
        title: v?.title ?? b?.title ?? '',
        genres: v?.genres ?? b?.genres ?? [],
        text: v?.text ?? b?.snippet ?? '',
        score: combined,
      };
    }).sort((a, b) => b.score - a.score);

    // ---- 4) Build LLM context (top ~2–3×N) ----
    const contextCands = fused.slice(0, Math.max(N * 3, 20)).map((m) => ({
      id: m.id,
      title: m.title,
      genres: m.genres,
      overview: m.text,
    }));

    // ---- 5) Generate grounded listicle ----
    const gen = await generateListicle({
      query,
      n: N,
      candidates: contextCands,
    });

    // Map refs back to movie IDs/titles
    const byRef = new Map<number, { id: string; title: string; genres: string[]; overview: string }>();
    contextCands.forEach((c, i) => byRef.set(i + 1, c));

    const items = gen.items.map((it) => {
      const ref = byRef.get(it.ref);
      return {
        id: ref?.id ?? '',
        title: it.title || ref?.title || '',
        genres: ref?.genres ?? [],
        reason: it.reason,
        ref: it.ref,
      };
    }).filter((x) => x.id && x.title);

    // If the model returned fewer than N valid refs, top-up from fused
    const need = N - items.length;
    if (need > 0) {
      const already = new Set(items.map((x) => x.id));
      for (const f of fused) {
        if (already.has(f.id)) continue;
        items.push({
          id: f.id,
          title: f.title,
          genres: f.genres,
          reason: 'Selected based on semantic and keyword relevance to your request.',
          ref: 0,
        });
        if (items.length >= N) break;
      }
    }

    return NextResponse.json({
      source: 'rag-listicle',
      seed,                 // shows which title we used (if any)
      n: N,
      usedCandidates: contextCands.length,
      items,
      // rawModel: gen.raw, // uncomment for debugging
    });
  } catch (e: any) {
    console.error('listicle error', e);
    return NextResponse.json({ error: e?.message || 'server error' }, { status: 500 });
  }
}