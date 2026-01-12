"use client";
import { usePathname, useRouter } from "next/navigation";
import { Home } from "lucide-react";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === "/";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Conditional home button - only show on non-home pages */}
      {!isHomePage && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-3 flex justify-center">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 text-sm font-medium"
              title="Back to Home"
            >
              <Home size={18} />
              <span>Home</span>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}