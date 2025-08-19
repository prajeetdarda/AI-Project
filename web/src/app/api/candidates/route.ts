import songsData from "../../../../data/songs_data.json";

type Song = {
  title: string;
  artist: string;
  vec: number[];
};

type SongsData = {
  features: string[];
  means: number[];
  stds: number[];
  songs: Song[];
};

const data: SongsData = songsData as SongsData;

function cosineSim(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function normalize(
  feats: Record<string, number>,
  means: number[],
  stds: number[]
): number[] {
  return data.features.map((f: string, i: number) =>
    ((feats[f] ?? 0) - means[i]) / stds[i]
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const q = normalize(body.features, data.means, data.stds);

    const sims = data.songs.map((s) => cosineSim(q, s.vec));

    const ranked = data.songs
      .map((s, i) => ({ ...s, sim: sims[i] }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, body.topn || 10);

    return new Response(JSON.stringify(ranked), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}