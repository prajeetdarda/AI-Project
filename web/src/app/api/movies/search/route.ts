import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { NextResponse } from 'next/server';
import { embedQuery } from '@/lib/embeddings_openai';
import { getIndex } from '@/lib/pinecone';
import { bm25Search, findTopTitle } from '@/lib/opensearch';
import { parseQuery } from '@/lib/intent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Mode = 'vector' | 'bm25' | 'hybrid';

type Body = {
  query: string;
  // Optional overrides/knobs from UI (kept compatible with your old client)
  genres?: string[];
  k?: number;                 // final results to return to UI
  mode?: Mode;                // 'vector' | 'bm25' | 'hybrid'
  alpha?: number;             // hybrid fusion weight for vector [0,1]
  vecK?: number;              // depth from Pinecone in hybrid
  bmK?: number;               // depth from OpenSearch in hybrid
};

function minMax(scores: number[]) {
  if (!scores.length) return (_: number) => 0;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const denom = max - min || 1e-6;
  return (x: number) => (x - min) / denom;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    // 1) Raw safety check
    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    // 2) Parse user query → structured plan
    const parsed = await parseQuery(body.query);
    console.log('[parseQuery parsed object] inside search/route.ts', parsed);
    // Parsed gives: n, searchType ('plot' | 'title'), candidate_title, semantic_query,
    // genres (canonicalized), keywords (for BM25), soft_constraints, etc.

    // 3) Merge parser outputs with any explicit UI overrides (if present)
    const userK = Math.max(1, Math.min(body.k ?? parsed.n ?? 20, 50));
    const mode: Mode = body.mode ?? 'hybrid';
    const vecK = Math.max(userK, body.vecK ?? 100);
    const bmK = Math.max(userK, body.bmK ?? 100);
    // If caller provided genres, honor them; else use parsed genres
    const genres = (body.genres?.length ? body.genres : parsed.genres) ?? [];
    const alpha = Math.min(1, Math.max(0, body.alpha ?? 0.6));

    // 4) Decide seed text for retrieval
    //    - title → resolve best title in OpenSearch, use its overview as seed
    //    - plot  → use parsed.semantic_query
    let seedText = parsed.semantic_query || body.query;
    let seed = { id: undefined as string | undefined, title: undefined as string | undefined };

    if (parsed.searchType === 'title') {
      const hit = await findTopTitle(parsed.candidate_title || body.query);
      if (hit?.text) {
        seedText = hit.text;
        seed = { id: hit.id, title: hit.title };
      } // else: fallback to plot-like behavior with seedText from semantic_query
    }

    // 5) Fast single-engine paths (no deep pull needed)
    if (mode === 'bm25') {
      const items = await bm25Search({ query: seedText, genres, k: userK });
      return NextResponse.json({ source: 'bm25', seed, items });
    }

    if (mode === 'vector') {
      const qvec = await embedQuery(seedText);
      const index = getIndex();
      const filter = genres.length ? { genres: { $in: genres } } : undefined;

      const res = await index.query({
        vector: qvec,
        topK: userK,                // vector-only: fetch exactly what we return
        includeMetadata: true,
        filter,
      });

      const items = (res.matches ?? []).map((m) => {
        const md = (m.metadata ?? {}) as any;
        return {
          id: m.id,
          title: md.title ?? '',
          genres: md.genres ?? [],
          score: m.score ?? 0,
          snippet: md.text ?? '',
        };
      });

      return NextResponse.json({ source: 'vector', seed, items });
    }

    // 6) Hybrid: pull deep from both, normalize & fuse, then trim to userK
    // 6a) Pinecone candidates
    const qvec = await embedQuery(seedText);
    const pIndex = getIndex();
    const pineFilter = genres.length ? { genres: { $in: genres } } : undefined;

    const vecRes = await pIndex.query({
      vector: qvec,
      topK: vecK,                 // deep candidates for fusion
      includeMetadata: true,
      filter: pineFilter,
    });

    const vecMatches = (vecRes.matches ?? []).map((m) => {
      const md = (m.metadata ?? {}) as any;
      return {
        id: m.id,
        title: md.title ?? '',
        genres: md.genres ?? [],
        text: md.text ?? '',
        score_vec: m.score ?? 0,
      };
    });

    // 6b) BM25 candidates
    const bmItems = await bm25Search({
      query: seedText,
      genres,
      k: bmK,                     // deep candidates for fusion
    });

    // 6c) Normalize & fuse (linear weighting)
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
        snippet: v?.text ?? b?.snippet ?? '',
        score: combined,
        _scores: { vector: v?.score_vec ?? 0, bm25: b?.score ?? 0, combined },
      };
    }).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // tie-breaker on the stronger single-modality score
      const bMax = Math.max(b._scores.vector, b._scores.bm25);
      const aMax = Math.max(a._scores.vector, a._scores.bm25);
      if (bMax !== aMax) return bMax - aMax;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({
      source: 'hybrid',
      seed,
      alpha,
      vecK,
      bmK,
      items: fused.slice(0, userK),
    });

  } catch (e: any) {
    console.error('search error', e);
    return NextResponse.json({ error: e?.message || 'server error' }, { status: 500 });
  }
}