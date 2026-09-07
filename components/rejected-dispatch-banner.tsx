"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export interface RejectedDispatchInfo {
  id: string;
  hospitalId: string;
  hospitalName: string;
  rejectionReason: string;
  rejectedAt: string;
}

interface RejectedDispatchBannerProps {
  rejectedDispatch: RejectedDispatchInfo | null;
  onDismiss?: () => void;
}

export function RejectedDispatchBanner({
  rejectedDispatch,
  onDismiss,
}: RejectedDispatchBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!rejectedDispatch) return;
    try {
      const dismissedKey = `dismissed_rejection_${rejectedDispatch.id}`;
      const dismissed = localStorage.getItem(dismissedKey);
      if (dismissed === "true") {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [rejectedDispatch?.id]);

  if (!rejectedDispatch || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(`dismissed_rejection_${rejectedDispatch.id}`, "true");
    } catch {
      // Ignore
    }
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  };

  return (
    <aside
      aria-label="Dispatch request rejected alert"
      className="w-full bg-red-50 dark:bg-[#130808] border-b-2 border-red-600 dark:border-red-500 text-slate-900 dark:text-[#ededed] font-sans transition-colors"
    >
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-3 sm:py-4">
        {/* DESKTOP LAYOUT (>= md) */}
        <div className="hidden md:flex md:items-start md:justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-red-700 text-white px-2 py-0.5 rounded-xs">
                REQUEST REJECTED
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-[#888]">
                ID: {rejectedDispatch.id}
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed] mt-1 break-words">
              {rejectedDispatch.hospitalName} has rejected your dispatch request.
            </h3>

            <div className="text-xs font-mono text-red-800 dark:text-red-400 mt-0.5">
              Reason: <span className="font-semibold">{rejectedDispatch.rejectionReason}</span>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#a1a1a1] mt-1">
              Please select another suitable hospital and create a new dispatch request.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-center">
            <Link
              href="/find-beds"
              className="px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-red-700 hover:bg-red-800 text-white rounded-xs transition-colors cursor-pointer text-center"
            >
              FIND ANOTHER HOSPITAL
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3.5 py-2 text-xs font-mono font-semibold uppercase tracking-wider bg-white dark:bg-[#1a1a1a] hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-700 dark:text-[#ccc] border border-slate-300 dark:border-[#333] rounded-xs transition-colors cursor-pointer text-center"
            >
              OKAY
            </button>
          </div>
        </div>

        {/* MOBILE LAYOUT (< md) */}
        <div className="block md:hidden">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-red-700 text-white px-2 py-0.5 rounded-xs">
              REQUEST REJECTED
            </span>
          </div>

          <div className="text-sm font-bold text-slate-900 dark:text-[#ededed] leading-snug break-words">
            {rejectedDispatch.hospitalName} has rejected your dispatch request.
          </div>

          <div className="text-xs font-mono text-red-800 dark:text-red-400 mt-1 break-words">
            Reason: <span className="font-semibold">{rejectedDispatch.rejectionReason}</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-[#999] mt-1.5 leading-relaxed">
            Please select another suitable hospital and create a new dispatch request.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <Link
              href="/find-beds"
              className="w-full text-center py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider bg-red-700 hover:bg-red-800 text-white rounded-xs transition-colors"
            >
              FIND ANOTHER HOSPITAL
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full text-center py-2 px-3 text-xs font-mono font-semibold uppercase tracking-wider bg-white dark:bg-[#1a1a1a] hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-700 dark:text-[#ccc] border border-slate-300 dark:border-[#333] rounded-xs transition-colors cursor-pointer"
            >
              OKAY
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
