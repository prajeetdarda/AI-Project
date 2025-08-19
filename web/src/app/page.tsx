// app/page.tsx
export default function Home() {
  return (
    <div className="w-full bg-white">
      {/* Content container */}
      <div className="max-w-7xl mx-auto px-6">
        {/* Push content up a bit; not perfectly centered */}
        <section className="pt-16 pb-20">
          <h1 className="text-4xl font-bold text-gray-800 text-center">
            Welcome to AI Project
          </h1>

          <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-6">
            <a
              href="/games"
              className="inline-flex items-center justify-center px-12 py-6 text-2xl font-semibold text-white bg-blue-600 rounded-xl shadow hover:bg-blue-500 transition-colors w-full md:w-auto"
            >
              AI Games
            </a>
            <a
              href="/movies"
              className="inline-flex items-center justify-center px-12 py-6 text-2xl font-semibold text-white bg-green-600 rounded-xl shadow hover:bg-green-500 transition-colors w-full md:w-auto"
            >
              Movie Recommendations
            </a>
            <a
              href="/audio"
              className="inline-flex items-center justify-center px-12 py-6 text-2xl font-semibold text-white bg-green-600 rounded-xl shadow hover:bg-green-500 transition-colors w-full md:w-auto"
            >
              Song Recommendations
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}