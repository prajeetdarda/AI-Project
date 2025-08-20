"use client";

import { useState, useCallback, useMemo } from "react";

type Features = {
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  liveness: number;
  speechiness: number;
  tempo: number;
  valence: number;
  loudness: number;
  duration_ms?: number;
};

type Song = { title: string; artist: string; rationale?: string; sim?: number };

const API_BASE =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_API_BASE_URL &&
  process.env.NEXT_PUBLIC_API_BASE_URL.trim()
    ? process.env.NEXT_PUBLIC_API_BASE_URL.trim()
    : "http://localhost:8000";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

function msToMMSS(ms?: number) {
  if (!ms || !Number.isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

function pct(x: number) {
  const v = Math.max(0, Math.min(1, x));
  return Math.round(v * 100);
}

/* -------------------- Demo fallback content -------------------- */
const DEMO_FEATS: Features = {
  acousticness: 0.22,
  danceability: 0.71,
  energy: 0.68,
  instrumentalness: 0.12,
  liveness: 0.11,
  speechiness: 0.05,
  tempo: 118,
  valence: 0.56,
  loudness: -8.7,
  duration_ms: 205000,
};

const DEMO_RECS: Song[] = [
  {
    title: "Midnight City",
    artist: "M83",
    rationale: "Similar energy/valence; synth-forward textures",
    sim: 0.83,
  },
  {
    title: "Instant Crush",
    artist: "Daft Punk",
    rationale: "Danceability/tempo match; electronic palette",
    sim: 0.81,
  },
  {
    title: "The Less I Know The Better",
    artist: "Tame Impala",
    rationale: "Groove-aligned; mid‑tempo, warm timbre",
    sim: 0.79,
  },
];

/* -------------------- Timeout helper -------------------- */
async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  ms = 6500
) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export default function AudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [feats, setFeats] = useState<Features | null>(null);
  const [cands, setCands] = useState<Song[]>([]);
  const [recs, setRecs] = useState<Song[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [defaultsUsed, setDefaultsUsed] = useState<Record<string, boolean>>({});

  // demo flags (section-specific)
  const [demoFeats, setDemoFeats] = useState(false);
  const [demoRecs, setDemoRecs] = useState(false);

  // mic state
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const run = useCallback(
    async (customFile?: File) => {
      const useFile = customFile ?? file;
      if (!useFile) return;
      const t0 = performance.now();
      setBusy(true);
      setErr(null);
      setRecs([]);
      setCands([]);
      setDefaultsUsed({});
      setDemoFeats(false);
      setDemoRecs(false);

      try {
        /* ---------- (A) Show demo immediately (optimistic UI) ---------- */
        setFeats(DEMO_FEATS);
        setRecs(DEMO_RECS);
        setDemoFeats(true);
        setDemoRecs(true);

        /* ---------- (1) FastAPI → /infer (with timeout) ---------- */
        const fd = new FormData();
        fd.append("file", useFile);
        const inferUrl = joinUrl(API_BASE, "/infer");

        let fixed: Features | null = null;
        try {
          const predRes = await fetchWithTimeout(
            inferUrl,
            { method: "POST", body: fd },
            6500
          );
          if (!predRes.ok) {
            const txt = await predRes.text().catch(() => "");
            throw new Error(`infer failed (${predRes.status}) ${txt}`);
          }
          const raw = await predRes.json();
          const src: any =
            raw && typeof raw === "object" && raw.features && typeof raw.features === "object"
              ? raw.features
              : raw;

          const used: Record<string, boolean> = {};
          const take = (name: keyof Features, fallback: number) => {
            const v = (src as any)?.[name];
            const num = typeof v === "number" ? v : Number(v);
            const ok = Number.isFinite(num);
            used[name as string] = !ok;
            return ok ? (num as number) : fallback;
          };

          fixed = {
            acousticness: take("acousticness", DEMO_FEATS.acousticness),
            danceability: take("danceability", DEMO_FEATS.danceability),
            energy: take("energy", DEMO_FEATS.energy),
            instrumentalness: take(
              "instrumentalness",
              DEMO_FEATS.instrumentalness
            ),
            liveness: take("liveness", DEMO_FEATS.liveness),
            speechiness: take("speechiness", DEMO_FEATS.speechiness),
            tempo: take("tempo", DEMO_FEATS.tempo),
            valence: take("valence", DEMO_FEATS.valence),
            loudness: take("loudness", DEMO_FEATS.loudness),
            duration_ms: take("duration_ms", DEMO_FEATS.duration_ms ?? 210000),
          };

          setFeats(fixed); // overwrite demo features
          setDefaultsUsed(used);
          setDemoFeats(false); // real features loaded
        } catch (e) {
          // keep demo feats
          console.warn("[audio] /infer fallback to demo:", e);
          setDemoFeats(true);
        }

        /* ---------- (2) Next.js → /api/candidates (with timeout) ---------- */
        try {
          const candRes = await fetchWithTimeout(
            "/api/candidates",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                features: fixed ?? DEMO_FEATS,
                topn: 10,
              }),
            },
            5000
          );

          const candJson = await candRes.json().catch(() => ({}));
          if (!candRes.ok)
            throw new Error(candJson?.error || "candidates failed");

          const arr: Song[] = Array.isArray(candJson)
            ? candJson
            : Array.isArray(candJson?.items)
            ? candJson.items
            : [];
          const slimCands = arr
            .filter((x) => x?.title && x?.artist)
            .map(({ title, artist, sim }) => ({ title, artist, sim }));

          setCands(slimCands);
        } catch (e) {
          console.warn("[audio] /api/candidates fallback: keeping demo", e);
        }

        /* ---------- (3) Next.js → /api/llm-recs (with timeout) ---------- */
        try {
          const llmRes = await fetchWithTimeout(
            "/api/llm-recs",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                features: fixed ?? DEMO_FEATS,
                candidates: (cands.length ? cands : DEMO_RECS).map(
                  ({ title, artist }) => ({ title, artist })
                ),
                limit: 20,
                avoid: recs.map(({ title, artist }) => ({ title, artist })),
              }),
            },
            5500
          );

          const llmJson = await llmRes.json().catch(() => ({}));
          if (!llmRes.ok) throw new Error(llmJson?.error || "llm error");

          const items: Song[] = Array.isArray(llmJson?.items)
            ? llmJson.items
            : [];
          if (items.length) {
            setRecs(items); // overwrite demo recs with real ones
            setDemoRecs(false);
          } else {
            // if API returns empty, keep demo recs
            setDemoRecs(true);
          }
        } catch (e) {
          console.warn("[audio] /api/llm-recs fallback: keeping demo recs", e);
          setDemoRecs(true);
        }

        console.log(
          "[audio] total time:",
          Math.round(performance.now() - t0),
          "ms"
        );
      } catch (e: any) {
        console.error("[audio] run() error:", e);
        setErr(String(e.message || e));
      } finally {
        setBusy(false);
      }
    },
    [file, cands.length, recs]
  );

  // Microphone recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const audioFile = new File([blob], "recording.webm", {
          type: "audio/webm",
        });
        setAudioURL(URL.createObjectURL(blob));
        setFile(audioFile);
        void run(audioFile); // auto-run after recording
      };
      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setRecording(true);
    } catch (err) {
      console.error("mic error", err);
      setErr("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    recorder?.stop();
    setRecording(false);
  };

  const anyDefaults = useMemo(
    () => Object.values(defaultsUsed).some(Boolean),
    [defaultsUsed]
  );

  const featureCards = useMemo(() => {
    if (!feats) return null;
    const rows: { label: string; key: keyof Features; isPct?: boolean }[] = [
      { label: "Danceability", key: "danceability", isPct: true },
      { label: "Energy", key: "energy", isPct: true },
      { label: "Valence", key: "valence", isPct: true },
      { label: "Acousticness", key: "acousticness", isPct: true },
      { label: "Instrumentalness", key: "instrumentalness", isPct: true },
      { label: "Speechiness", key: "speechiness", isPct: true },
      { label: "Liveness", key: "liveness", isPct: true },
    ];
    return rows.map((r, i) => {
      const v = feats[r.key];
      const percent = r.isPct ? pct(v ?? 0) : v ?? 0;
      const warn = defaultsUsed[r.key as string];
      return (
        <div
          key={i}
          className={`rounded border p-3 ${
            warn ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
          } shadow-sm`}
        >
          <div className="flex items-center justify-between text-sm text-gray-700">
            <span className="font-medium">{r.label}</span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded bg-gray-200">
            <div
              className="h-2 rounded bg-black"
              style={{ width: `${percent}%` }}
            />
          </div>
          {warn && (
            <div className="mt-1 text-xs text-amber-700">default used</div>
          )}
        </div>
      );
    });
  }, [feats, defaultsUsed]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      {/* Header with "Behind the tech" */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Audio‑to‑Song Recommendations</h1>
        <button
          className="text-sm px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
          onClick={() => setShowAbout(true)}
        >
          Behind the tech{" "}
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs">
            ?
          </span>
        </button>
      </div>

      {/* Upload + Analyze in one line */}
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept="audio/*"
          onChange={onPick}
          className="border border-gray-300 bg-gray-100 text-gray-700 text-sm rounded-md px-3 py-2 cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
        />
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          onClick={() => run()}
          disabled={!file || busy}
        >
          {busy ? "Processing..." : "Analyze & Recommend"}
        </button>
      </div>

      {/* OR divider */}
      <div className="flex items-center justify-center my-2">
        <span className="text-gray-500 font-semibold">OR</span>
      </div>

      {/* Mic controls */}
      <div className="flex items-center gap-3">
        {!recording ? (
          <button
            className="px-4 py-2 rounded bg-green-600 text-white"
            onClick={startRecording}
          >
            Start Recording
          </button>
        ) : (
          <button
            className="px-4 py-2 rounded bg-red-600 text-white"
            onClick={stopRecording}
          >
            Stop Recording
          </button>
        )}
        {audioURL && <audio controls src={audioURL} className="ml-2" />}
      </div>

      {/* Errors / warnings */}
      {err && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">
          {err}
        </div>
      )}
      {anyDefaults && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800">
          Some feature values were missing; defaults used. Check console for raw
          payload.
        </div>
      )}

      {/* Predicted features */}
      {feats && (
        <section className="rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold mb-3">Predicted Audio Features</h2>
            {demoFeats && (
              <span className="text-xs rounded-full border px-2 py-0.5 text-amber-700 border-amber-300 bg-amber-50">
                demo results (API slow)
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featureCards}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border px-2 py-1">
              Tempo: <b>{Math.round(feats.tempo)} BPM</b>
            </span>
            <span className="rounded-full border px-2 py-1">
              Loudness: <b>{feats.loudness.toFixed(1)} dB</b>
            </span>
            {/* <span className="rounded-full border px-2 py-1">
              Duration: <b>{msToMMSS(feats.duration_ms)}</b>
            </span> */}
          </div>
        </section>
      )}

      {/* Candidates */}
      {cands.length > 0 && (
        <section className="rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold mb-3">Top‑10 Dataset Candidates</h2>
            {/* If you also want a chip here, you could add another demo flag for candidates */}
          </div>
          <ol className="space-y-2 list-decimal list-inside">
            {cands.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.title}</span> — {c.artist}
                {typeof c.sim === "number" ? (
                  <span className="text-gray-400"> · sim {c.sim.toFixed(3)}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* LLM recommendations */}
      {recs.length > 0 && (
        <section className="rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold mb-3">Recommended Similar Songs</h2>
            {demoRecs && (
              <span className="text-xs rounded-full border px-2 py-0.5 text-amber-700 border-amber-300 bg-amber-50">
                demo results (API slow)
              </span>
            )}
          </div>
          <ol className="space-y-2 list-decimal list-inside">
            {recs.map((r, i) => (
              <li key={i}>
                <span className="font-medium">{r.title}</span> — {r.artist}
                {r.rationale ? (
                  <span className="text-gray-500"> · {r.rationale}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Behind the tech modal */}
      {showAbout && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Behind the tech</h3>
              <button
                className="rounded-full border px-3 py-1 text-sm"
                onClick={() => setShowAbout(false)}
              >
                Close
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>
                <b>Data curation:</b> Scraped and unified thousands of track
                previews with metadata to build a benchmark dataset for
                supervised learning.
              </li>
              <li>
                <b>Embedding model:</b> Fine-tuned PANNs (Pretrained Audio
                Neural Networks, CNN14) via transfer learning for high-quality
                music representation and embeddings.
              </li>
              <li>
                <b>Feature prediction:</b> Designed a multi-task linear head to
                predict Spotify-style attributes (danceability, energy,
                acousticness, etc.) directly from embeddings.
              </li>
              <li>
                <b>Recommendation engine:</b> Integrated predicted features with
                the Spotify Web API to retrieve musically aligned candidate
                songs.
              </li>
              <li>
                <b>LLM curation:</b> Leveraged OpenAI GPT to refine candidates,
                generate concise rationales, and present human-like
                recommendations.
              </li>
              <li>
                <b>Stack & Deployment:</b> FastAPI microservice for inference
                deployed on Render; frontend built with Next.js (App Router) and
                TailwindCSS; hosted on Vercel with GitHub CI/CD pipelines
                enabling cloud-native, automated, and scalable deployments.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}