import 'server-only';
import { Pinecone } from '@pinecone-database/pinecone';

let client: Pinecone | null = null;

export function getPinecone() {
  if (!client) client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  return client;
}

export function getIndex() {
  const name = process.env.PINECONE_INDEX!;
  return getPinecone().index(name);
}