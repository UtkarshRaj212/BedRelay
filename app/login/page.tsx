import { Suspense } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-black dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* Top Header */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm shadow-xs">
              BR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-black dark:text-[#ededed] tracking-tight leading-none font-mono">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
              <span className="text-[10px] text-slate-600 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                Hospital Telemetry Authentication
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-[#888888] hover:text-black dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto my-12 sm:my-16 px-4">
        <Suspense
          fallback={
            <div className="p-8 text-center font-mono text-xs text-slate-500">
              Loading authentication gateway...
            </div>
          }
        >
          <AuthCard />
        </Suspense>
      </main>
    </div>
  );
}
