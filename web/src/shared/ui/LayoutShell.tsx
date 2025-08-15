"use client";
import TopBar from "./TopBar";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar with big Home button */}
      <TopBar />

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}