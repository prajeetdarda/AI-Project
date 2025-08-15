"use client";
import Link from "next/link";

export default function SideNav({ isOpen }: { isOpen: boolean }) {
  return (
    <aside
      className={`bg-gray-100 border-r w-56 p-4 fixed inset-y-0 left-0 transform 
                  ${isOpen ? "translate-x-0" : "-translate-x-full"} 
                  md:translate-x-0 transition-transform duration-200 ease-in-out`}
    >
      <nav className="space-y-2">
        <Link href="/" className="block px-2 py-1 rounded hover:bg-gray-200">
          Home
        </Link>
        <Link href="/games" className="block px-2 py-1 rounded hover:bg-gray-200">
          AI Games
        </Link>
        <Link href="/chat" className="block px-2 py-1 rounded hover:bg-gray-200">
          ChatBot
        </Link>
        <Link href="/summariser" className="block px-2 py-1 rounded hover:bg-gray-200">
          PDF summariser
        </Link>
        <Link href="/movies" className="block px-2 py-1 rounded hover:bg-gray-200">
          Movies Search
        </Link>
        <Link href="/rag" className="block px-2 py-1 rounded hover:bg-gray-200">
          RAG Playground
        </Link>
        <Link href="/settings" className="block px-2 py-1 rounded hover:bg-gray-200">
          Settings
        </Link>
      </nav>
    </aside>
  );
}