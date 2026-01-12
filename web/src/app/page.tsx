// app/page.tsx
export default function Home() {
  return (
    <div className="w-full bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      {/* Top attribution line */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-2">
          <p className="text-xs text-gray-600 text-center">
            Built by Prajeet Darda ·{" "}
            <a
              href="https://www.linkedin.com/in/prajeet-darda"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              LinkedIn
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/prajeetdarda"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              GitHub
            </a>{" "}
            · prajeetdarda@gmail.com
          </p>
        </div>
      </div>

      {/* Content container */}
      <div className="max-w-7xl mx-auto px-6">
        {/* Hero section */}
        <section className="pt-20 pb-12 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Multimodal AI Discovery Platform
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore intelligent recommendation systems powered by advanced AI technologies including RAG, fine-tuned neural networks, and semantic search
          </p>
        </section>

        {/* Main features section */}
        <section className="pb-20">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-12">
            Explore Live Demos
          </h2>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Movie Recommendations Card */}
            <a
              href="/movies"
              className="block bg-white rounded-2xl shadow-md hover:shadow-xl transition-all p-8 border border-gray-200 hover:border-blue-400"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">🎬</span>
                <h3 className="text-2xl font-bold text-gray-900">
                  Movie Recommender
                </h3>
              </div>
              <p className="text-gray-700 mb-4 leading-relaxed">
                RAG-based semantic search powered by LangChain, Pinecone, and OpenSearch
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Semantic retrieval with vector embeddings</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Sub-second latency on AWS Lambda</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Handles 1k+ daily queries efficiently</span>
                </div>
              </div>
            </a>

            {/* Audio Recommendations Card */}
            <a
              href="/audio"
              className="block bg-white rounded-2xl shadow-md hover:shadow-xl transition-all p-8 border border-gray-200 hover:border-purple-400"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">🎵</span>
                <h3 className="text-2xl font-bold text-gray-900">
                  Audio-Based Music Discovery
                </h3>
              </div>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Fine-tuned PANNs (CNN14) for intelligent playlist generation from audio features
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>95% accuracy in audio feature detection</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Trained on 6k+ tracks with custom ML pipeline</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Personalized recommendations via GPT integration</span>
                </div>
              </div>
            </a>
          </div>
        </section>

        {/* Technology highlights */}
        <section className="pb-12">
          <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-200 max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">
              Technology Stack
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 text-center">
              <div>
                <div className="font-bold text-gray-900">LangGraph</div>
                <div className="text-sm text-gray-600 mt-1">Orchestration</div>
              </div>
              <div>
                <div className="font-bold text-gray-900">LangChain</div>
                <div className="text-sm text-gray-600 mt-1">AI Framework</div>
              </div>
              <div>
                <div className="font-bold text-gray-900">OpenAI GPT-4o</div>
                <div className="text-sm text-gray-600 mt-1">LLM Engine</div>
              </div>
              <div>
                <div className="font-bold text-gray-900">Next.js 15</div>
                <div className="text-sm text-gray-600 mt-1">React Framework</div>
              </div>
              <div>
                <div className="font-bold text-gray-900">TypeScript</div>
                <div className="text-sm text-gray-600 mt-1">Type Safety</div>
              </div>
              <div>
                <div className="font-bold text-gray-900">SQLite</div>
                <div className="text-sm text-gray-600 mt-1">Database</div>
              </div>
              <div>
                <div className="font-bold text-gray-900">Tailwind CSS</div>
                <div className="text-sm text-gray-600 mt-1">Styling</div>
              </div>
            </div>
          </div>
        </section>

        {/* Source code link */}
        <section className="pb-12">
          <div className="text-center">
            <a
              href="https://github.com/prajeetdarda/AI-Project"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">View Source Code on GitHub</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}