"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceKm } from "@/lib/geo";
import { ActiveDispatch } from "@/hooks/use-active-dispatch";

interface ActiveDispatchBannerProps {
  activeDispatch: ActiveDispatch | null;
  lastUpdated?: string;
  onSwitchClick?: () => void;
  onModifyClick?: () => void;
}

export function ActiveDispatchBanner({
  activeDispatch,
  lastUpdated,
  onSwitchClick,
  onModifyClick,
}: ActiveDispatchBannerProps) {
  const router = useRouter();

  if (!activeDispatch) {
    return null;
  }

  const isAccepted = activeDispatch.status.toUpperCase() === "ACCEPTED";
  const statusBg = isAccepted
    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
    : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/60";

  const handleSwitch = () => {
    if (onSwitchClick) {
      onSwitchClick();
    } else {
      router.push("/find-beds?switch=true");
    }
  };

  const handleModify = () => {
    if (onModifyClick) {
      onModifyClick();
    } else {
      router.push(`/dispatch-requests/${activeDispatch.id}?modify=true`);
    }
  };

  const distanceText =
    activeDispatch.distanceKm !== null
      ? formatDistanceKm(activeDispatch.distanceKm)
      : null;

  return (
    <aside
      aria-label="Active emergency dispatch banner"
      className="w-full bg-slate-100 dark:bg-[#0c0c0c] border-b-2 border-amber-400 dark:border-amber-500/70 text-slate-900 dark:text-[#ededed] font-sans transition-colors"
    >
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        {/* DESKTOP / TABLET LAYOUT (>= 768px) */}
        <div className="hidden md:flex md:items-center md:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-800 dark:text-amber-400 bg-amber-200/60 dark:bg-amber-950/80 px-1.5 py-0.5 rounded-xs border border-amber-300 dark:border-amber-800/60">
                ACTIVE DISPATCH
              </span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs border ${statusBg}`}>
                {activeDispatch.status}
              </span>
              {activeDispatch.reviewRequired && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs border bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800 animate-pulse flex items-center gap-1">
                  <span>⚠️</span> HOSPITAL REVIEW REQUIRED
                </span>
              )}
              {lastUpdated && (
                <span className="text-[10px] font-mono text-slate-500 dark:text-[#737373]">
                  • Synced {lastUpdated}
                </span>
              )}
            </div>

            <div className="text-sm font-semibold text-slate-900 dark:text-[#ededed] truncate">
              <span className="font-bold">{activeDispatch.hospitalName}</span>
              <span className="text-slate-400 dark:text-[#666] mx-1.5">·</span>
              <span className="font-mono text-xs">{activeDispatch.bedCategoryCode}</span>
              <span className="text-slate-400 dark:text-[#666] mx-1.5">·</span>
              <span className="font-mono text-xs">
                {activeDispatch.requestedBeds} {activeDispatch.requestedBeds === 1 ? "bed" : "beds"}
                {activeDispatch.approvedBeds !== undefined && activeDispatch.approvedBeds !== null && activeDispatch.approvedBeds < activeDispatch.requestedBeds && (
                  <span className="text-amber-600 dark:text-amber-400 ml-1">
                    ({activeDispatch.approvedBeds} approved, {activeDispatch.requestedBeds - activeDispatch.approvedBeds} pending)
                  </span>
                )}
              </span>
              {distanceText && (
                <>
                  <span className="text-slate-400 dark:text-[#666] mx-1.5">·</span>
                  <span className="font-mono text-xs text-blue-700 dark:text-blue-400">{distanceText}</span>
                </>
              )}
            </div>

            <div className="text-[11px] font-mono text-slate-500 dark:text-[#888888] mt-0.5 truncate">
              Request: <span className="font-bold text-slate-700 dark:text-[#ccc]">{activeDispatch.id}</span>
              {activeDispatch.hospitalAddress && (
                <span className="ml-2 text-slate-400 dark:text-[#666]">({activeDispatch.hospitalAddress})</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href={`/dispatch-requests/${activeDispatch.id}`}
              className="px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider bg-white dark:bg-[#181818] hover:bg-slate-50 dark:hover:bg-[#222222] text-slate-900 dark:text-[#ededed] border border-slate-300 dark:border-[#333333] rounded-xs transition-colors cursor-pointer"
            >
              VIEW
            </Link>
            <button
              type="button"
              onClick={handleModify}
              className="px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xs border border-blue-700 dark:border-blue-500 transition-colors cursor-pointer"
            >
              MODIFY REQUEST
            </button>
            <button
              type="button"
              onClick={handleSwitch}
              className="px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-slate-950 dark:text-black rounded-xs border border-amber-600 dark:border-amber-500 transition-colors cursor-pointer"
            >
              SWITCH HOSPITAL
            </button>
          </div>
        </div>

        {/* MOBILE LAYOUT (< 768px) */}
        <div className="block md:hidden">
          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-800 dark:text-amber-400 bg-amber-200/60 dark:bg-amber-950/80 px-1.5 py-0.5 rounded-xs border border-amber-300 dark:border-amber-800/60">
              ACTIVE DISPATCH
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs border ${statusBg}`}>
                {activeDispatch.status}
              </span>
              {activeDispatch.reviewRequired && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs border bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800 animate-pulse">
                  REVIEW REQUIRED
                </span>
              )}
            </div>
          </div>

          <div className="space-y-0.5 mb-2">
            <div className="text-sm font-bold text-slate-900 dark:text-[#ededed] break-words leading-snug">
              {activeDispatch.hospitalName}
            </div>
            {activeDispatch.hospitalAddress && (
              <div className="text-[11px] text-slate-600 dark:text-[#888888] break-words">
                {activeDispatch.hospitalAddress}
                {activeDispatch.hospitalCity ? `, ${activeDispatch.hospitalCity}` : ""}
              </div>
            )}
          </div>

          <div className="text-xs font-mono text-slate-700 dark:text-[#bbb] mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="font-semibold text-blue-700 dark:text-blue-400">{activeDispatch.bedCategoryCode}</span>
            <span className="text-slate-400 dark:text-[#555]">·</span>
            <span>{activeDispatch.requestedBeds} {activeDispatch.requestedBeds === 1 ? "bed" : "beds"}</span>
            {activeDispatch.approvedBeds !== undefined && activeDispatch.approvedBeds !== null && activeDispatch.approvedBeds < activeDispatch.requestedBeds && (
              <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                ({activeDispatch.approvedBeds} appr, {activeDispatch.requestedBeds - activeDispatch.approvedBeds} pend)
              </span>
            )}
            {distanceText && (
              <>
                <span className="text-slate-400 dark:text-[#555]">·</span>
                <span>{distanceText}</span>
              </>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-500 dark:text-[#737373] mb-2.5 break-all">
            Request: <span className="font-bold text-slate-800 dark:text-[#ccc]">{activeDispatch.id}</span>
          </div>

          {/* Action Buttons: Stacked on mobile with wrap guarantee */}
          <div className="flex flex-col sm:flex-row gap-1.5">
            <Link
              href={`/dispatch-requests/${activeDispatch.id}`}
              className="w-full text-center py-2 px-3 text-xs font-mono font-semibold uppercase tracking-wider bg-white dark:bg-[#181818] hover:bg-slate-50 dark:hover:bg-[#222222] text-slate-900 dark:text-[#ededed] border border-slate-300 dark:border-[#333333] rounded-xs transition-colors"
            >
              VIEW REQUEST
            </Link>
            <button
              type="button"
              onClick={handleModify}
              className="w-full text-center py-2 px-3 text-xs font-mono font-semibold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xs border border-blue-700 dark:border-blue-500 transition-colors cursor-pointer"
            >
              MODIFY REQUEST
            </button>
            <button
              type="button"
              onClick={handleSwitch}
              className="w-full text-center py-2 px-3 text-xs font-mono font-semibold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-slate-950 dark:text-black rounded-xs border border-amber-600 dark:border-amber-500 transition-colors cursor-pointer"
            >
              SWITCH HOSPITAL
            </button>
          </div>

          {lastUpdated && (
            <div className="text-[10px] font-mono text-slate-400 dark:text-[#555] mt-1.5 text-right">
              Synced: {lastUpdated}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
