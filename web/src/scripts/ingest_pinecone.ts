// src/scripts/ingest.ts
// Run: npx tsx src/scripts/ingest.ts data/movies.csv
// Deps: openai, @pinecone-database/pinecone, csv-parse, tsx
// Env:  OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

// ---------- CONFIG ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'movies-v1';

// OpenAI embedding model (request 384 dims to match your Pinecone index)
const OPENAI_EMBED_MODEL = 'text-embedding-3-small';
const OPENAI_EMBED_DIMS = 384;

const UPSERT_BATCH = 100;  // vectors per Pinecone upsert
const EMBED_BATCH = 64;    // texts per OpenAI embeddings request

// ---------- TYPES ----------
type Row = {
  original_title: string;
  overview: string;
  genres?: string; // e.g., "['Drama', 'Crime']"
};

type Doc = {
  id: string;
  title: string;
  text: string;      // title + ". " + overview
  genres: string[];  // ['Drama','Crime']
};

// ---------- UTILS ----------
function requireEnv(name: string, value?: string) {
  if (!value) throw new Error(`Missing env var: ${name}`);
}

function l2norm(vec: number[]) {
  const n = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / n);
}

function parseGenres(raw?: string): string[] {
  if (!raw) return [];
  // accepts "['Drama', 'Crime']" or ["Drama","Crime"] etc.
  return raw
    .replace(/[\[\]"]/g, '')                       // drop brackets + double quotes
    .split(',')
    .map((s) => s.trim().replace(/^'+|'+$/g, ''))  // trim + strip single quotes
    .filter(Boolean);
}

// ---------- OPENAI EMBEDDINGS ----------
async function embedBatchOpenAI(texts: string[]): Promise<number[][]> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const chunk = texts.slice(i, i + EMBED_BATCH);

    const resp = await client.embeddings.create({
      model: OPENAI_EMBED_MODEL,
      input: chunk,
      dimensions: OPENAI_EMBED_DIMS, // request 384‑dim vectors
    });

    // embeddings returned in the same order as inputs
    for (const item of resp.data) {
      out.push(l2norm(item.embedding as number[]));
    }

    const done = Math.min(i + EMBED_BATCH, texts.length);
    if (done % (EMBED_BATCH * 10) === 0 || done === texts.length) {
      console.log(`embedded ${done} / ${texts.length}`);
    }
  }

  return out;
}

// ---------- MAIN ----------
async function main() {
  // 1) Env checks
  requireEnv('OPENAI_API_KEY', OPENAI_API_KEY);
  requireEnv('PINECONE_API_KEY', PINECONE_API_KEY);
  requireEnv('PINECONE_INDEX', PINECONE_INDEX);

  // 2) CSV path
  const csvPath = process.argv[2] || path.join(process.cwd(), 'data', 'movies.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found at: ${csvPath}`);
  }

  // 3) Read + parse CSV
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Row[];
  if (!rows.length) throw new Error('CSV has no rows');

  // 4) Build docs
  const docs: Doc[] = rows
    .map((r, i) => {
      const title = (r.original_title || '').trim();
      const overview = (r.overview || '').trim();
      if (!title || !overview) return null;
      const text = `${title}. ${overview}`.replace(/\s+/g, ' ').trim();
      const genres = parseGenres(r.genres);
      return { id: `tmdb-${i}`, title, text, genres };
    })
    .filter((x): x is Doc => !!x);

  console.log(`loaded ${docs.length} docs from CSV`);

  // 5) Embeddings
  const texts = docs.map((d) => d.text);
  const vectors = await embedBatchOpenAI(texts);
  if (vectors.length !== docs.length) throw new Error('embed count mismatch');
  console.log(`vector dim: ${vectors[0]?.length} (expected ${OPENAI_EMBED_DIMS})`);

  // 6) Upsert to Pinecone
  const pc = new Pinecone({ apiKey: PINECONE_API_KEY! });
  const index = pc.index(PINECONE_INDEX!);

  for (let i = 0; i < docs.length; i += UPSERT_BATCH) {
    const batchDocs = docs.slice(i, i + UPSERT_BATCH);
    const upserts = batchDocs.map((d, j) => ({
      id: d.id,
      values: vectors[i + j],
      metadata: {
        title: d.title,
        genres: d.genres,
        text: d.text, // used later for snippets / RAG grounding
      },
    }));
    await index.upsert(upserts);
    console.log(`upserted ${Math.min(i + UPSERT_BATCH, docs.length)} / ${docs.length}`);
  }

  console.log('✅ ingest complete.');
}

main().catch((err) => {
  console.error('❌ ingest failed:', err?.message || err);
  process.exit(1);
});