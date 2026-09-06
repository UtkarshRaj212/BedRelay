"use client";

import { useState } from "react";

export interface ReviewDispatchItem {
  id: string;
  ambulanceUnit: string;
  bedCategoryCode: string;
  requestedBeds: number;
  approvedBeds?: number | null;
  reviewRequired?: boolean;
  reviewReason?: string | null;
  etaMinutes: number;
  patientCondition: string;
  status: string;
}

interface HospitalReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: ReviewDispatchItem | null;
  onSuccess: () => void;
}

export function HospitalReviewModal({
  isOpen,
  onClose,
  dispatch,
  onSuccess,
}: HospitalReviewModalProps) {
  if (!isOpen || !dispatch) return null;

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approved = dispatch.approvedBeds ?? 0;
  const requested = dispatch.requestedBeds ?? 1;
  const hasAdditionalBeds = requested > approved;

  const handleConfirmReview = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/hospital/dispatches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: dispatch.id,
          action: "REVIEW_UPDATE",
          note: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm review.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Network error confirming review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#0f0f0f] border border-slate-300 dark:border-[#2a2a2a] w-full max-w-lg rounded-xs p-5 sm:p-6 shadow-xl text-slate-900 dark:text-[#ededed] font-sans my-8">
        <div className="border-b border-slate-200 dark:border-[#222222] pb-3 mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold block">
              CLINICAL TELEMETRY REVIEW
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#ededed] leading-tight">
              REVIEW DISPATCH MODIFICATION
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-[#777]">
              {dispatch.id} • {dispatch.ambulanceUnit}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 text-sm font-bold cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/60 text-red-800 dark:text-red-400 text-xs font-mono rounded-xs">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Reason Alert */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-xs text-xs font-mono">
            <span className="font-bold text-amber-900 dark:text-amber-300 uppercase block mb-1">
              ⚠️ Reason Review Required:
            </span>
            <p className="text-amber-800 dark:text-amber-300 font-sans">
              {dispatch.reviewReason || "Clinical condition or bed capacity modified while en route."}
            </p>
          </div>

          {/* Current Details */}
          <div className="p-3 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-xs font-mono text-xs space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 dark:text-[#777] uppercase">Category & Beds:</span>
              <span className="font-bold text-slate-900 dark:text-[#ededed]">
                {dispatch.bedCategoryCode} · {requested} requested ({approved} currently approved)
              </span>
            </div>

            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 dark:text-[#777] uppercase">ETA:</span>
              <span className="font-bold text-slate-900 dark:text-[#ededed]">~{dispatch.etaMinutes} minutes</span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-[#262626]">
              <span className="text-slate-500 dark:text-[#777] uppercase block text-[10px] mb-0.5">
                Current Patient Condition:
              </span>
              <p className="text-slate-800 dark:text-[#ccc] font-sans text-xs">
                {dispatch.patientCondition}
              </p>
            </div>
          </div>

          {hasAdditionalBeds && (
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xs text-[11px] font-mono text-blue-900 dark:text-blue-300">
              Notice: Acknowledging this review will allocate {requested - approved} additional {dispatch.bedCategoryCode} bed(s) from your available pool.
            </div>
          )}

          {/* Staff Notes */}
          <div>
            <label className="block font-mono text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
              Clinical / Staff Acknowledgment Note (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Trauma bay prepared, respiratory therapist notified."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none font-sans"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#222222]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-2 text-xs font-mono font-semibold uppercase text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#333] rounded-xs transition-colors cursor-pointer text-center"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleConfirmReview}
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xs transition-colors disabled:opacity-50 cursor-pointer text-center"
            >
              {submitting ? "CONFIRMING..." : "CONFIRM REVIEW & ACKNOWLEDGE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
