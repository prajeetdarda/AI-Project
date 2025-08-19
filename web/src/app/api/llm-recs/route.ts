import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ---- Inputs ----
type RawFeats = Partial<Record<
  "danceability" | "energy" | "valence" | "tempo" | "acousticness" | "loudness",
  number | string | null | undefined
>>;

type Cand = { title: string; artist: string };
type Avoid = { title: string; artist: string };

// ---- Utils ----
function num(x: unknown, fallback: number): number {
  const v = typeof x === "string" ? Number(x) : (x as number);
  return Number.isFinite(v) ? (v as number) : fallback;
}

/** Make tight bands around a feature value (symmetric percent or absolute). */
function bandPct(v: number, pct: number, min=0, max=1) {
  const lo = Math.max(min, v * (1 - pct));
  const hi = Math.min(max, v * (1 + pct));
  return [Number(lo.toFixed(3)), Number(hi.toFixed(3))] as const;
}
function bandAbs(v: number, abs: number, min?: number, max?: number) {
  let lo = v - abs, hi = v + abs;
  if (typeof min === "number") lo = Math.max(min, lo);
  if (typeof max === "number") hi = Math.min(max, hi);
  return [Math.round(lo), Math.round(hi)] as const;
}

const STYLE_TOKENS = [
  "tasteful mainstream picks with a modern feel",
  "night‑drive indie/electronic vibe",
  "radio‑friendly crossovers with dance appeal",
  "festival‑ready energetic cuts",
  "mood‑driven, current but not obscure",
];
const styleToken = () => STYLE_TOKENS[Math.floor(Math.random() * STYLE_TOKENS.length)];

// ---- OpenAI client ----
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Inputs
    const raw: RawFeats = body?.features ?? {};
    const candidates: Cand[] = Array.isArray(body?.candidates) ? body.candidates.slice(0, 20) : [];
    const genres: string[] = Array.isArray(body?.genres) ? body.genres.slice(0, 8) : []; // optional
    const avoid: Avoid[] = Array.isArray(body?.avoid) ? body.avoid.slice(0, 150) : [];
    const limit = Math.min(Math.max(Number(body?.limit ?? 20), 5), 50);

    // Coerce the few features we’ll actually use as guardrails
    const f = {
      danceability: num(raw.danceability, 0.5),
      energy:       num(raw.energy, 0.5),
      valence:      num(raw.valence, 0.5),
      tempo:        num(raw.tempo, 110),
      acousticness: num(raw.acousticness, 0.5),
      loudness:     num(raw.loudness, -12),
    };

    // Build bands:
    // - bounded [0..1] for danceability/energy/valence/acousticness using ±12.5%
    // - tempo ±12 BPM
    // - loudness ±2 dB (no hard bounds)
    const [dLo, dHi] = bandPct(f.danceability, 0.125, 0, 1);
    const [eLo, eHi] = bandPct(f.energy,       0.125, 0, 1);
    const [vLo, vHi] = bandPct(f.valence,      0.125, 0, 1);
    const [aLo, aHi] = bandPct(f.acousticness, 0.125, 0, 1);
    const [tLo, tHi] = bandAbs(f.tempo, 12, 60, 200);
    const [LLo, LHi] = bandAbs(f.loudness, 2);

    // Prep anchors and avoid lists for the prompt
    const anchorArtists = Array.from(new Set(
      candidates.map(c => (c.artist || "").trim()).filter(Boolean)
    )).slice(0, 12);

    const anchorTracks = candidates
      .map(c => `${(c.title||"").trim()} — ${(c.artist||"").trim()}`)
      .filter(Boolean)
      .slice(0, 12)
      .join("\n");

    const avoidList = avoid
      .map(a => `${(a.title||"").trim()} — ${(a.artist||"").trim()}`)
      .filter(Boolean)
      .slice(0, 120)
      .join("\n");

    const genreLine = genres.length ? genres.join(", ") : "(none)";

    const sys = `You are a music curator. Use numeric constraints and provided artist/genre anchors
to recommend popular, streamable songs that fit the target vibe.

Return STRICT JSON with schema:
{
  "items": [
    { "title": "string", "artist": "string", "rationale": "short string" }
  ]
}`;

    const user = `
PRIMARY ANCHORS:
- Preferred genres (soft constraint): ${genreLine}
- Example reference tracks (non-binding):
${anchorTracks || "(none)"}
- Example anchor artists to stay near (soft constraint): ${anchorArtists.join(", ") || "(none)"}

HARD CONSTRAINTS (stay inside these numeric bands):
- danceability in [${dLo}, ${dHi}]
- energy in [${eLo}, ${eHi}]
- valence in [${vLo}, ${vHi}]
- tempo in [${tLo}, ${tHi}] BPM
- acousticness in [${aLo}, ${aHi}] (lower = more electric/produced)
- loudness in [${LLo}, ${LHi}] dB (approximate)

Diversity/quality constraints:
- Return exactly ${limit} items when possible.
- No duplicate tracks; avoid repeating the same artist more than twice.
- Prefer releases from ~last 20 years unless anchors imply legacy.

Avoid if possible:
${avoidList || "(none)"}

Stylistic framing: ${styleToken()}
Keep rationales very short (6–12 words). Output JSON only, no extra text.`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.6,      // lower to reduce generic drift
      top_p: 0.9,
      frequency_penalty: 0.2,
      presence_penalty: 0.2,
    });

    const text = resp.choices?.[0]?.message?.content || "{}";

    // Parse & clean
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = { items: [] }; }

    type Item = { title: string; artist: string; rationale?: string };
    const seen = new Set<string>();
    const items: Item[] = (Array.isArray(parsed.items) ? parsed.items : [])
      .filter((x: Item) => x && x.title && x.artist)
      .filter((x: Item) => {
        const k = `${x.title} — ${x.artist}`.toLowerCase().trim();
        if (seen.has(k)) return false;
        seen.add(k); return true;
      })
      .slice(0, limit)
      .map((x: Item) => ({
        title: String(x.title).trim(),
        artist: String(x.artist).trim(),
        rationale: String(x.rationale || "").trim(),
      }));

    return NextResponse.json({
      items,
      anchors: {
        genres,
        anchor_artists: anchorArtists,
        numeric_bands: {
          danceability: [dLo, dHi],
          energy: [eLo, eHi],
          valence: [vLo, vHi],
          tempo: [tLo, tHi],
          acousticness: [aLo, aHi],
          loudness: [LLo, LHi],
        },
      },
      limit,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "openai_error", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}