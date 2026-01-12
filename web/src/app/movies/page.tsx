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
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
      <header className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-gray-900">Movie Recommender</h1>

        {/* Help button with label */}
        <button
          onClick={() => setShowHelp(true)}
          className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2 text-gray-700 transition-colors"
        >
          <span>Behind the Tech</span>
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs font-medium">
            ?
          </span>
        </button>
      </header>

      <p className="text-gray-600 mb-6">
        RAG-based semantic search powered by LangChain, Pinecone, and OpenSearch
      </p>

      <form onSubmit={onGenerate} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Describe the movies you want
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Try: "7 mind-bending sci-fi with twisty plots" or "Top 5 movies similar to Gravity"'
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          className="px-6 py-3 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed font-medium transition-colors"
          disabled={loading}
        >
          {loading ? "Generating…" : "Generate Recommendations"}
        </button>
      </form>

      {seed?.title && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            Seeded from: <span className="font-semibold">{seed.title}</span>
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results grid */}
      {items.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Your Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {items.map((it, i) => (
              <article key={it.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow h-full">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 select-none">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-gray-900">{it.title}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {(it.genres || []).join(" • ")}
                      </div>
                    </div>
                  </div>
                  {it.ref ? (
                    <span
                      title="Model citation to context candidate"
                      className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 select-none"
                    >
                      #{it.ref}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{it.reason}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <h2 className="text-xl font-bold text-gray-900">Behind the Tech</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="text-sm text-gray-700 space-y-3">
              <p className="text-base">
                This page is powered by a{" "}
                <span className="font-semibold text-gray-900">
                  Retrieval-Augmented Generation (RAG)
                </span>{" "}
                pipeline with <span className="font-semibold">LangChain</span>.
              </p>
              <ol className="list-decimal pl-5 space-y-2.5">
                <li>
                  <span className="font-semibold text-gray-900">Intent parsing:</span> An LLM
                  interprets your query, extracting relevant genres, keywords,
                  or target movies.
                </li>
                <li>
                  <span className="font-semibold text-gray-900">Hybrid retrieval:</span>{" "}
                  Searches <span className="font-semibold">Pinecone</span>{" "}
                  (semantic vectors) and{" "}
                  <span className="font-semibold">OpenSearch</span> (keyword
                  BM25), then merges results.
                </li>
                <li>
                  <span className="font-semibold text-gray-900">Grounded generation:</span>{" "}
                  LangChain prompts an LLM to create a numbered list with short
                  justifications, citing matched movies via <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">#[n]</code>.
                </li>
                <li>
                  <span className="font-semibold text-gray-900">AWS automation:</span> Ground
                  truth movie data is stored in{" "}
                  <span className="font-semibold">AWS S3</span>, and{" "}
                  <span className="font-semibold">AWS Lambda</span> functions
                  automatically process updates — refreshing embeddings in{" "}
                  <span className="font-semibold">Pinecone</span> and keeping the{" "}
                  <span className="font-semibold">OpenSearch</span> index in sync.
                </li>
              </ol>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
                <p className="text-xs text-gray-600">
                  <span className="font-semibold text-gray-700">Tech stack:</span> Next.js, OpenAI API (embeddings + LLM), LangChain,
                  Pinecone, OpenSearch, AWS S3, AWS Lambda
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHelp(false)}
                className="px-6 py-2.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 font-medium transition-colors"
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
