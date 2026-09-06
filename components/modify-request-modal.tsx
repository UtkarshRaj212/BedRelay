"use client";

import { useState } from "react";
import { ActiveDispatch } from "@/hooks/use-active-dispatch";

interface ModifyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: ActiveDispatch | null;
  onSuccess: (updatedDispatch: any) => void;
}

const BED_CATEGORIES = [
  { code: "ICU", label: "Intensive Care Unit (ICU)" },
  { code: "VENTILATOR", label: "Ventilator & Critical Care" },
  { code: "GENERAL", label: "General Medical Ward" },
  { code: "PEDIATRIC_ICU", label: "Pediatric ICU (PICU)" },
  { code: "NEONATAL_ICU", label: "Neonatal ICU (NICU)" },
];

export function ModifyRequestModal({
  isOpen,
  onClose,
  dispatch,
  onSuccess,
}: ModifyRequestModalProps) {
  if (!isOpen || !dispatch) return null;

  const [etaMinutes, setEtaMinutes] = useState<number>(dispatch.etaMinutes || 15);
  const [patientCondition, setPatientCondition] = useState<string>(dispatch.patientCondition || "");
  const [requestedBeds, setRequestedBeds] = useState<number>(dispatch.requestedBeds || 1);
  const [bedCategoryCode, setBedCategoryCode] = useState<string>(dispatch.bedCategoryCode || "ICU");
  const [patientRef, setPatientRef] = useState<string>(dispatch.patientRef || dispatch.patientReference || "");
  const [ambulanceUnit, setAmbulanceUnit] = useState<string>(dispatch.ambulanceUnit || dispatch.ambulanceId || "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approvedCount = dispatch.approvedBeds || 0;
  const isAccepted = dispatch.status.toUpperCase() === "ACCEPTED";

  // Calculations for bed preview
  let approvedPreview = approvedCount;
  let additionalPending = 0;
  if (isAccepted) {
    if (requestedBeds < approvedCount) {
      approvedPreview = requestedBeds;
      additionalPending = 0;
    } else {
      approvedPreview = approvedCount;
      additionalPending = Math.max(0, requestedBeds - approvedCount);
    }
  }

  // Calculate arrival times for preview
  const now = new Date();
  const currentArrival = new Date(now.getTime() + (dispatch.etaMinutes || 15) * 60 * 1000);
  const newArrival = new Date(now.getTime() + (etaMinutes || 15) * 60 * 1000);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/dispatch/modify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etaMinutes: Number(etaMinutes),
          patientCondition: patientCondition.trim(),
          requestedBeds: Number(requestedBeds),
          bedCategoryCode,
          patientRef: patientRef.trim(),
          patientReference: patientRef.trim(),
          ambulanceUnit: ambulanceUnit.trim(),
          ambulanceId: ambulanceUnit.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to modify dispatch request.");
      }

      onSuccess(data.dispatch);
      onClose();
    } catch (err: any) {
      setError(err.message || "Network error modifying request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modify-request-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#0f0f0f] border border-slate-300 dark:border-[#2a2a2a] w-full max-w-lg rounded-xs p-5 sm:p-6 shadow-xl text-slate-900 dark:text-[#ededed] font-sans transition-colors my-8">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-[#222222] pb-3 mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-blue-700 dark:text-blue-400 font-bold block">
              DISPATCH TELEMETRY UPDATE
            </span>
            <h2 id="modify-request-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#ededed] leading-tight">
              MODIFY ACTIVE REQUEST
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-[#777]">
              {dispatch.id} • {dispatch.hospitalName}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* COMPARISON PREVIEW SUMMARY */}
          <div className="p-3 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-[#222222] rounded-xs font-mono text-xs space-y-2">
            <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase font-bold tracking-wider">
              TELEMETRY DELTA PREVIEW (CURRENT → NEW)
            </div>

            {/* ETA Delta */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-[#888]">ETA / Arrival:</span>
              <span className="font-semibold text-slate-900 dark:text-[#ededed]">
                {formatTime(currentArrival)} ({dispatch.etaMinutes}m) →{" "}
                <span className="text-blue-700 dark:text-blue-400">
                  {formatTime(newArrival)} ({etaMinutes}m)
                </span>
              </span>
            </div>

            {/* Beds Delta */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-[#888]">Beds:</span>
              <span className="font-semibold text-slate-900 dark:text-[#ededed]">
                {dispatch.requestedBeds} {dispatch.bedCategoryCode} →{" "}
                <span className="text-blue-700 dark:text-blue-400">
                  {requestedBeds} {bedCategoryCode}
                </span>
              </span>
            </div>

            {/* Bed Breakdown for Accepted Dispatches */}
            {isAccepted && (
              <div className="pt-1.5 border-t border-slate-200 dark:border-[#262626] text-[11px] flex justify-between">
                <span className="text-slate-500 dark:text-[#888]">Approved / Pending:</span>
                <span>
                  Approved: <strong>{approvedPreview}</strong>
                  {additionalPending > 0 && (
                    <span className="text-amber-700 dark:text-amber-400 ml-1.5">
                      (+{additionalPending} pending review)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            {/* ETA (Minutes) */}
            <div>
              <label className="block text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
                Travel Duration (Minutes)
              </label>
              <input
                type="number"
                min="1"
                max="300"
                value={etaMinutes}
                onChange={(e) => setEtaMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none"
                required
              />
            </div>

            {/* Requested Beds */}
            <div>
              <label className="block text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
                Requested Beds Count
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={requestedBeds}
                onChange={(e) => setRequestedBeds(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Bed Category Selection */}
          <div>
            <label className="block font-mono text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
              Required Bed Category
            </label>
            <select
              value={bedCategoryCode}
              onChange={(e) => setBedCategoryCode(e.target.value)}
              className="w-full px-3 py-2 font-mono text-xs bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none"
            >
              {BED_CATEGORIES.map((cat) => (
                <option key={cat.code} value={cat.code}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Patient Condition */}
          <div>
            <label className="block font-mono text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
              Patient Clinical Condition
            </label>
            <textarea
              rows={2}
              value={patientCondition}
              onChange={(e) => setPatientCondition(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none font-sans"
              placeholder="e.g. Critical, acute respiratory distress, intubated"
              required
            />
            <p className="text-[10px] font-mono text-slate-500 dark:text-[#777] mt-0.5">
              Material changes in severity (e.g. Stable → Critical) automatically alert hospital staff for clinical review.
            </p>
          </div>

          {/* Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div>
              <label className="block text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
                Ambulance / Unit ID
              </label>
              <input
                type="text"
                value={ambulanceUnit}
                onChange={(e) => setAmbulanceUnit(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
                Patient Reference
              </label>
              <input
                type="text"
                value={patientRef}
                onChange={(e) => setPatientRef(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
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
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xs transition-colors disabled:opacity-50 cursor-pointer text-center"
            >
              {submitting ? "UPDATING TELEMETRY..." : "APPLY MODIFICATIONS"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
