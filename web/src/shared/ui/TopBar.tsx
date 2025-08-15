"use client";
import { useRouter } from "next/navigation";
import { Home } from "lucide-react";

export default function TopBar() {
  const router = useRouter();

  return (
    <header className="h-20 bg-gray-900 text-white grid grid-cols-3 items-center px-8 shadow">
      {/* Left spacer */}
      <div />

      {/* Center: Home Icon + Project Name */}
      <button
        onClick={() => router.push("/")}
        className="justify-self-center flex items-center gap-4 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors shadow-md"
        title="Go to Home"
      >
        <Home size={40} />
        <span className="text-2xl font-bold tracking-wide">
          GenAI Hub
        </span>
      </button>

      {/* Right: Name & Email */}
      <div className="justify-self-end text-base text-gray-300 text-right leading-tight">
        <div className="font-semibold">Prajeet Darda</div>
        <a
          href="mailto:prajeetdarda@gmail.com"
          className="hover:underline hover:text-white"
        >
          prajeetdarda@gmail.com
        </a>
      </div>
    </header>
  );
}