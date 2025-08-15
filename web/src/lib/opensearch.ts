import 'server-only';

// Read from env (safer than hardcoding in app code)
const OS_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const OS_INDEX = process.env.OPENSEARCH_INDEX || 'movies';
const OS_USER = process.env.OPENSEARCH_USERNAME!;
const OS_PASS = process.env.OPENSEARCH_PASSWORD!;

function requireEnv(val: string | undefined, name: string) {
  if (!val) throw new Error(`Missing env: ${name}`);
}

requireEnv(OS_ENDPOINT, 'OPENSEARCH_ENDPOINT');
requireEnv(OS_USER, 'OPENSEARCH_USERNAME');
requireEnv(OS_PASS, 'OPENSEARCH_PASSWORD');

function b64(s: string) {
  return Buffer.from(s, 'utf8').toString('base64');
}

async function osRequest<T = any>(method: string, path: string, body?: any) {
  const url = `${OS_ENDPOINT.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Basic ${b64(`${OS_USER}:${OS_PASS}`)}`,
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // @ts-ignore
    cache: 'no-store',
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  return { status: res.status, data, text };
}

type BM25Args = { query: string; genres?: string[]; k?: number };

// export async function findTopTitle(query: string) {
//   // try exact match on keyword subfield, then phrase/fuzzy
//   const body = {
//     size: 5,
//     query: {
//       bool: {
//         should: [
//           { term:   { 'title.keyword': query } },                // exact
//           { match_phrase: { title: { query, slop: 1, boost: 3 } } }, // phrase
//           { match: { title: { query, fuzziness: 'AUTO', boost: 1 } } } // fuzzy
//         ],
//         minimum_should_match: 1
//       }
//     },
//     _source: ['title','genres','text','overview']
//   };

//   const res = await osRequest('POST', `/${OS_INDEX}/_search`, body);
//   if (res.status >= 300) throw new Error(`Title lookup failed: ${res.status} ${res.text}`);

//   const hits: any[] = res.data?.hits?.hits ?? [];
//   if (!hits.length) return null;

//   const h = hits[0];
//   const src = h._source || {};
//   console.log('findTopTitle', query, '->', h._id, src.title);
//   return {
//     id: h._id as string,
//     title: src.title as string,
//     genres: (src.genres ?? []) as string[],
//     text: (src.text || src.overview || '') as string,
//     score: h._score as number
//   };
// }
export async function findTopTitle(query: string) {
  // Strip instruction words so OS matches a title better
  const q = query
    .replace(/\btop\s+\d+\b/ig, '')
    .replace(/\b(movies?|films?)\b/ig, '')
    .replace(/\b(similar\s+to|like)\b/ig, '')
    .replace(/\b(best|recommend(ed)?|list|show|find)\b/ig, '')
    .trim();

  const body = {
    size: 5,
    query: {
      bool: {
        should: [
          { term: { 'title.keyword': q } },                                   // exact title
          { match_phrase: { title: { query: q, slop: 1, boost: 3 } } },       // phrase
          { match: { title: { query: q, fuzziness: 'AUTO', boost: 1 } } },    // fuzzy
        ],
        minimum_should_match: 1,
      },
    },
    _source: ['title','genres','text','overview'],
  };

  const res = await osRequest('POST', `/${OS_INDEX}/_search`, body);
  if (res.status >= 300) throw new Error(`Title lookup failed: ${res.status} ${res.text}`);

  const hits: any[] = res.data?.hits?.hits ?? [];
  if (!hits.length) return null;

  const h = hits[0];
  const src = h._source || {};
  console.log('findTopTitle', query, '->', h._id, src.title);
  return {
    id: h._id as string,
    title: src.title as string,
    genres: (src.genres ?? []) as string[],
    text: (src.text || src.overview || '') as string,
    score: h._score as number,
  };
}

export async function bm25Search({ query, genres = [], k = 20 }: BM25Args) {
  // Build a multi_match BM25 query; filter genres with 'terms' if provided
  const body: any = {
    size: k,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ['title^2', 'text'], // boost title
              type: 'best_fields',
            },
          },
        ],
        filter: genres.length ? [{ terms: { genres } }] : [],
      },
    },
    _source: ['title', 'genres', 'text', 'overview'],
  };

  const res = await osRequest('POST', `/${OS_INDEX}/_search`, body);
  if (res.status >= 300) {
    throw new Error(`OpenSearch query failed: ${res.status} ${res.text}`);
  }

  const hits: any[] = res.data?.hits?.hits ?? [];
  return hits.map((h) => {
    const src = h._source || {};
    const text: string = src.text || src.overview || '';
    return {
      id: h._id,
      title: src.title || '',
      genres: src.genres || [],
      score: h._score || 0,
      snippet: text, // you can trim if you want
    };
  });
}