// Run examples:
//  - Local CSV: npx tsx src/scripts/os_setup_and_ingest.ts data/movies.csv
//  - From S3:   npx tsx src/scripts/os_setup_and_ingest.ts s3://bucket/movies/movies.csv

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import type { IncomingMessage } from 'node:http';

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

// Optional S3 mode
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

type Row = { original_title: string; overview: string; genres?: string };
type Doc = { id: string; title: string; overview: string; text: string; genres: string[] };

const OS_ENDPOINT = mustEnv('OPENSEARCH_ENDPOINT');
const OS_INDEX = process.env.OPENSEARCH_INDEX || 'movies';
const OS_USER = process.env.OPENSEARCH_USERNAME || '';
const OS_PASS = process.env.OPENSEARCH_PASSWORD || '';

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parseGenres(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .replace(/[\[\]"]/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

function b64(str: string) {
  return Buffer.from(str, 'utf8').toString('base64');
}

async function osRequest<T = any>(
  method: string,
  pathPart: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; data: T; text: string }> {
  const url = `${OS_ENDPOINT.replace(/\/+$/, '')}/${pathPart.replace(/^\/+/, '')}`;
  const h: Record<string, string> = {
    'content-type': 'application/json',
    ...headers,
  };
  if (OS_USER && OS_PASS) {
    h['authorization'] = `Basic ${b64(`${OS_USER}:${OS_PASS}`)}`;
  }
  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  } as any);
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
  return { status: res.status, data, text };
}

async function createIndexIfMissing() {
  // check
  const head = await osRequest('HEAD', `/${OS_INDEX}`);
  if (head.status === 200) {
    console.log(`ℹ️ index '${OS_INDEX}' already exists`);
    return;
  }
  // create with mapping + analyzer
  const body = {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      analysis: {
        analyzer: {
          english_folded: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding', 'porter_stem'],
          },
        },
      },
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        title: {
          type: 'text',
          analyzer: 'english_folded',
          search_analyzer: 'english_folded',
          fields: { keyword: { type: 'keyword', ignore_above: 256 } },
        },
        text: {
          type: 'text',
          analyzer: 'english_folded',
          search_analyzer: 'english_folded',
        },
        overview: {
          type: 'text',
          analyzer: 'english_folded',
          search_analyzer: 'english_folded',
        },
        genres: { type: 'keyword' }, // exact-match filterable
      },
    },
  };
  const put = await osRequest('PUT', `/${OS_INDEX}`, body);
  if (put.status >= 300) {
    throw new Error(`Create index failed: ${put.status} ${put.text}`);
  }
  console.log(`✅ created index '${OS_INDEX}'`);
}

async function readCsvLocal(csvPath: string): Promise<Row[]> {
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);
  const raw = fs.readFileSync(csvPath, 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true }) as Row[];
}

async function readCsvFromS3(s3url: string): Promise<Row[]> {
  const m = s3url.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!m) throw new Error(`Invalid S3 URL: ${s3url}`);
  const [, Bucket, Key] = m;
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const out = await s3.send(new GetObjectCommand({ Bucket, Key }));
  const stream = out.Body as unknown as IncomingMessage;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  const raw = Buffer.concat(chunks).toString('utf8');
  return parse(raw, { columns: true, skip_empty_lines: true }) as Row[];
}

function buildDocs(rows: Row[]): Doc[] {
  const docs: Doc[] = rows
    .map((r, i) => {
      const title = (r.original_title || '').trim();
      const overview = (r.overview || '').trim();
      if (!title || !overview) return null;
      const text = `${title}. ${overview}`.replace(/\s+/g, ' ').trim();
      return {
        id: `tmdb-${i}`,
        title,
        overview,
        text,
        genres: parseGenres(r.genres),
      };
    })
    .filter((d): d is Doc => !!d);
  return docs;
}

// OpenSearch Bulk API expects NDJSON: action line + source line per doc
function toBulkNdjson(indexName: string, docs: Doc[]): string {
  const lines: string[] = [];
  for (const d of docs) {
    lines.push(JSON.stringify({ index: { _index: indexName, _id: d.id } }));
    lines.push(JSON.stringify(d));
  }
  return lines.join('\n') + '\n';
}

async function bulkInsert(docs: Doc[], batchSize = 2000) {
  console.log(`Indexing ${docs.length} docs into '${OS_INDEX}'...`);
  for (let i = 0; i < docs.length; i += batchSize) {
    const slice = docs.slice(i, i + batchSize);
    const ndjson = toBulkNdjson(OS_INDEX, slice);
    const res = await osRequest('POST', '/_bulk', ndjson, {
      'content-type': 'application/x-ndjson',
    });
    if (res.status >= 300 || res.data?.errors) {
      // try to surface first error
      const firstErr = res.data?.items?.find((it: any) => it.index?.error)?.index?.error;
      throw new Error(
        `Bulk failed (status ${res.status}) ${firstErr ? JSON.stringify(firstErr) : res.text}`
      );
    }
    console.log(`  • ${Math.min(i + batchSize, docs.length)} / ${docs.length}`);
  }
  // refresh so searches see the docs immediately
  await osRequest('POST', `/${OS_INDEX}/_refresh`);
  console.log('✅ bulk index complete');
}

async function testSearch(q: string) {
  const body = {
    size: 5,
    query: {
      multi_match: {
        query: q,
        fields: ['title^2', 'text'], // title boosted
        type: 'best_fields',
      },
    },
  };
  const res = await osRequest('POST', `/${OS_INDEX}/_search`, body);
  if (res.status >= 300) {
    throw new Error(`Search failed: ${res.status} ${res.text}`);
  }
  const hits = res.data?.hits?.hits || [];
  console.log(`🔎 Sample search "${q}" → ${hits.length} hits`);
  for (const h of hits) {
    console.log(`  - ${h._source.title}  (score ${h._score?.toFixed?.(3)})`);
  }
}

async function main() {
  const src = process.argv[2];
  if (!src) {
    console.error('Usage: tsx src/scripts/os_setup_and_ingest.ts <local.csv | s3://bucket/key>');
    process.exit(1);
  }

  await createIndexIfMissing();

  const rows = src.startsWith('s3://')
    ? await readCsvFromS3(src)
    : await readCsvLocal(path.isAbsolute(src) ? src : path.join(process.cwd(), src));

  const docs = buildDocs(rows);
  console.log(`Loaded ${docs.length} docs from ${src}`);

  await bulkInsert(docs);

  await testSearch('superhero action');
  await testSearch('mind-bending sci-fi heist');
}

main().catch((e) => {
  console.error('❌ setup/ingest error:', e?.message || e);
  process.exit(1);
});