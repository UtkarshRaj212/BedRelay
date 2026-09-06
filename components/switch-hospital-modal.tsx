"use client";

import { ActiveDispatch } from "@/hooks/use-active-dispatch";

interface SwitchHospitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDispatch: ActiveDispatch | null;
  targetHospital: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    state?: string;
  } | null;
  onConfirmSwitch: () => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
}

export function SwitchHospitalModal({
  isOpen,
  onClose,
  currentDispatch,
  targetHospital,
  onConfirmSwitch,
  isSubmitting = false,
  error = null,
}: SwitchHospitalModalProps) {
  if (!isOpen || !currentDispatch || !targetHospital) {
    return null;
  }

  const isAccepted = currentDispatch.status.toUpperCase() === "ACCEPTED";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs"
    >
      <div className="bg-white dark:bg-[#0f0f0f] border border-slate-300 dark:border-[#2a2a2a] w-full max-w-md rounded-xs p-5 sm:p-6 shadow-xl text-slate-900 dark:text-[#ededed] font-sans transition-colors">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-[#222222] pb-3 mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold block">
              ACTIVE REQUEST CONFLICT
            </span>
            <h2 id="switch-dialog-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#ededed] leading-tight">
              SWITCH RECEIVING HOSPITAL
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 text-sm font-bold cursor-pointer disabled:opacity-50"
            aria-label="Close switch modal"
          >
            ✕
          </button>
        </div>

        {/* Accepted Strong Alert */}
        {isAccepted && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/60 border-l-4 border-red-600 dark:border-red-500 rounded-xs text-xs font-mono text-red-900 dark:text-red-300">
            <div className="font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>CRITICAL ALERT</span>
            </div>
            <p className="leading-relaxed">
              The target facility has already <strong>ACCEPTED</strong> your inbound telemetry. Switching hospitals will immediately <strong>cancel</strong> this reservation and release allocated beds.
            </p>
          </div>
        )}

        <p className="text-xs text-slate-600 dark:text-[#888888] mb-4">
          You already have an active emergency dispatch request in the network. A dispatcher or ambulance can only maintain one active request at a time.
        </p>

        {/* Current vs New Hospital Summary Cards */}
        <div className="space-y-3 mb-4 font-mono text-xs">
          {/* Current */}
          <div className="p-3 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-[#242424] rounded-xs">
            <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase font-bold tracking-wider mb-1">
              CURRENT RECEIVING FACILITY
            </div>
            <div className="font-bold text-slate-900 dark:text-[#ededed] text-sm break-words">
              {currentDispatch.hospitalName}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-[#777]">Status:</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-xs border ${
                  isAccepted
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/60"
                }`}
              >
                {currentDispatch.status}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-[#666]">
                ({currentDispatch.bedCategoryCode} · {currentDispatch.requestedBeds} bed)
              </span>
            </div>
          </div>

          {/* New Hospital */}
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xs">
            <div className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold tracking-wider mb-1">
              NEW DESTINATION FACILITY
            </div>
            <div className="font-bold text-slate-900 dark:text-[#ededed] text-sm break-words">
              {targetHospital.name}
            </div>
            {targetHospital.city && (
              <div className="text-[11px] text-slate-600 dark:text-[#888888] mt-0.5 break-words">
                {targetHospital.address ? `${targetHospital.address}, ` : ""}
                {targetHospital.city}
              </div>
            )}
          </div>
        </div>

        <div className="p-2.5 bg-slate-100 dark:bg-[#121212] border border-slate-200 dark:border-[#222222] rounded-xs text-[11px] text-slate-600 dark:text-[#888888] mb-5 font-mono">
          The current request (<span className="font-bold text-slate-800 dark:text-[#ccc]">{currentDispatch.id}</span>) will be atomically cancelled before the new request is sent.
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/60 text-red-800 dark:text-red-400 text-xs font-mono rounded-xs">
            {error}
          </div>
        )}

        {/* Action Buttons: Stack on mobile, flex on desktop */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto py-2.5 px-4 text-xs font-mono font-semibold uppercase tracking-wider bg-white dark:bg-[#181818] hover:bg-slate-50 dark:hover:bg-[#222222] text-slate-700 dark:text-[#ccc] border border-slate-300 dark:border-[#333333] rounded-xs transition-colors cursor-pointer disabled:opacity-50 text-center"
          >
            GO BACK
          </button>
          <button
            type="button"
            onClick={onConfirmSwitch}
            disabled={isSubmitting}
            className={`w-full sm:w-auto py-2.5 px-4 text-xs font-mono font-bold uppercase tracking-wider text-white rounded-xs transition-colors cursor-pointer disabled:opacity-50 text-center shadow-xs ${
              isAccepted
                ? "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 border border-red-800 dark:border-red-500"
                : "bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700 border border-amber-700 dark:border-amber-500 text-slate-950 dark:text-black font-extrabold"
            }`}
          >
            {isSubmitting
              ? "SWITCHING FACILITY..."
              : isAccepted
              ? "CANCEL & SWITCH"
              : `CANCEL & SEND TO ${targetHospital.name.split(" ")[0].toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
