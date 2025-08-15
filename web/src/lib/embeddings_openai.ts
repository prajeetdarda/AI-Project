import 'server-only';
import OpenAI from 'openai';

const OPENAI_EMBED_MODEL = 'text-embedding-3-small';
const OPENAI_EMBED_DIMS = 384;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function l2norm(vec: number[]) {
  const n = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / n);
}

export async function embedQuery(text: string): Promise<number[]> {
  const resp = await client.embeddings.create({
    model: OPENAI_EMBED_MODEL,
    input: text,
    dimensions: OPENAI_EMBED_DIMS,
  });
  const vec = resp.data[0].embedding as number[];
  return l2norm(vec);
}