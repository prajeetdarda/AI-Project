"use client";
import React, { useEffect, useState } from "react";

type ListItem = {
  id: string;
  title: string;
  genres: string[];
  reason: string;
  ref: number; // [#i] the model cited
};

export default function ListiclePage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seed, setSeed] = useState<{ id?: string; title?: string } | null>(
    null
  );
  const [showHelp, setShowHelp] = useState(false);

  // close modal on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowHelp(false);
    }
    if (showHelp) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHelp]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setItems([]);
    setSeed(null);
    try {
      const res = await fetch("/api/movies/listicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generation failed");
      setItems(data.items || []);
      setSeed(data.seed || null);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Movie List Generator (RAG)</h1>

        {/* Help button with label */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Behind the Tech</span>
          <button
            onClick={() => setShowHelp(true)}
            aria-label="How it works"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300"
            title="How it works"
          >
            ?
          </button>
        </div>
      </header>

      <form onSubmit={onGenerate} className="space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Try: "7 mind-bending sci-fi with twisty plots" or "Top 5 movies similar to Gravity"'
          className="w-full border rounded px-3 py-2"
        />
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Generating…" : "Generate"}
        </button>
      </form>

      {seed?.title && (
        <p className="text-sm text-gray-600">
          Seeded from title: <span className="font-medium">{seed.title}</span>
        </p>
      )}

      {error && <p className="text-red-600">{error}</p>}

      {/* Results grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {items.map((it, i) => (
          <article key={it.id} className="border rounded p-3 h-full">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="text-xs px-2 py-1 rounded bg-gray-100 border select-none">
                  {i + 1}
                </span>
                <div>
                  <div className="font-medium">{it.title}</div>
                  <div className="text-sm text-gray-600">
                    {(it.genres || []).join(" • ")}
                  </div>
                </div>
              </div>
              {it.ref ? (
                <span
                  title="Model citation to context candidate"
                  className="text-xs px-2 py-1 rounded bg-gray-100 border select-none"
                >
                  #{it.ref}
                </span>
              ) : null}
            </div>
            <p className="mt-2 leading-relaxed">{it.reason}</p>
          </article>
        ))}
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-xl rounded-lg bg-white shadow-lg p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Behind the Tech</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="px-2 py-1 rounded hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="text-sm text-gray-700 space-y-2">
              <p>
                This page is powered by a{" "}
                <span className="font-medium">
                  Retrieval-Augmented Generation (RAG)
                </span>{" "}
                pipeline with <span className="font-medium">LangChain</span>.
              </p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  <span className="font-medium">Intent parsing:</span> An LLM
                  interprets your query, extracting relevant genres, keywords,
                  or target movies.
                </li>
                <li>
                  <span className="font-medium">Hybrid retrieval:</span>{" "}
                  Searches <span className="font-medium">Pinecone</span>{" "}
                  (semantic vectors) and{" "}
                  <span className="font-medium">OpenSearch</span> (keyword
                  BM25), then merges results.
                </li>
                <li>
                  <span className="font-medium">Grounded generation:</span>{" "}
                  LangChain prompts an LLM to create a numbered list with short
                  justifications, citing matched movies via <code>#[n]</code>.
                </li>
                <li>
                  <span className="font-medium">AWS automation:</span> Ground
                  truth movie data is stored in{" "}
                  <span className="font-medium">AWS S3</span>, and{" "}
                  <span className="font-medium">AWS Lambda</span> functions
                  automatically process updates — refreshing embeddings in{" "}
                  <span className="font-medium">Pinecone</span> and keeping the{" "}
                  <span className="font-medium">OpenSearch</span> index in sync.
                </li>
              </ol>
              <p className="text-xs text-gray-500">
                Tech stack: Next.js, OpenAI API (embeddings + LLM), LangChain,
                Pinecone, OpenSearch, AWS S3, AWS Lambda.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-2 rounded bg-black text-white"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
