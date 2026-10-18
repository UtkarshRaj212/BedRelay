"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "./theme-context";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use 'light' as fallback during SSR to avoid mismatch
  const currentTheme = mounted ? theme : "light";

  return (
    <div
      role="group"
      aria-label="Theme selection"
      className="inline-flex items-center rounded-sm border border-slate-300 dark:border-[#2a2a2a] bg-slate-100 dark:bg-[#111111] p-0.5 font-mono text-[10px] sm:text-[11px] leading-tight select-none shadow-xs"
    >
      {/* Light Button */}
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={currentTheme === "light"}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] transition-all cursor-pointer ${
          currentTheme === "light"
            ? "bg-white text-black font-bold shadow-xs border border-slate-200"
            : "text-slate-600 hover:text-black dark:text-slate-400 dark:hover:text-slate-200 font-medium"
        }`}
        title="Switch to Light theme"
      >
        <svg
          className="w-3 h-3 text-amber-500 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <span>Light</span>
      </button>

      {/* Dark Button */}
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={currentTheme === "dark"}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] transition-all cursor-pointer ${
          currentTheme === "dark"
            ? "bg-[#222222] text-[#ededed] border border-[#383838] font-bold shadow-xs"
            : "text-slate-600 hover:text-black dark:text-slate-400 dark:hover:text-slate-200 font-medium"
        }`}
        title="Switch to Dark theme"
      >
        <svg
          className="w-3 h-3 text-indigo-400 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <span>Dark</span>
      </button>
    </div>
  );
}
