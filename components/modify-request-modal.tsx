"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ActiveDispatch } from "@/hooks/use-active-dispatch";

interface ModifyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: ActiveDispatch | null;
  hospitalBeds?: {
    categoryCode: string;
    name: string;
    availableBeds: number;
    totalBeds: number;
    occupiedBeds: number;
  }[];
  onSuccess: (updatedDispatch: any) => void;
}

const BASE_CATEGORIES = [
  { code: "ICU", label: "Intensive Care Unit (ICU)" },
  { code: "GENERAL", label: "General Medical Ward" },
  { code: "VENTILATOR", label: "Ventilator & Critical Care" },
  { code: "NICU", label: "Neonatal ICU (NICU)" },
  { code: "PEDIATRIC_ICU", label: "Pediatric ICU (PICU)" },
];

function matchCategory(codeA?: string, codeB?: string): boolean {
  if (!codeA || !codeB) return false;
  const a = codeA.trim().toUpperCase();
  const b = codeB.trim().toUpperCase();
  if (a === b) return true;
  if ((a === "NICU" && b === "NEONATAL_ICU") || (a === "NEONATAL_ICU" && b === "NICU")) return true;
  return false;
}

export function ModifyRequestModal({
  isOpen,
  onClose,
  dispatch,
  hospitalBeds: propHospitalBeds,
  onSuccess,
}: ModifyRequestModalProps) {
  // Form input states stored as strings to permit normal editing/clearing
  const [etaMinutes, setEtaMinutes] = useState<string>("15");
  const [patientCondition, setPatientCondition] = useState<string>("");
  const [requestedBeds, setRequestedBeds] = useState<string>("1");
  const [bedCategoryCode, setBedCategoryCode] = useState<string>("ICU");
  const [patientRef, setPatientRef] = useState<string>("");
  const [ambulanceUnit, setAmbulanceUnit] = useState<string>("");

  const prevValidBedsRef = useRef<number>(1);
  const prevOpenRef = useRef<boolean>(false);
  const prevDispatchIdRef = useRef<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedBeds, setFetchedBeds] = useState<any[]>([]);

  // Synchronize form fields STRICTLY when modal opens or active request ID changes
  // Crucial: background polling must NOT wipe out user input while modal is open
  useEffect(() => {
    const isJustOpening = isOpen && !prevOpenRef.current;
    const isNewDispatch = Boolean(dispatch && dispatch.id !== prevDispatchIdRef.current);

    if (isOpen && dispatch && (isJustOpening || isNewDispatch)) {
      setEtaMinutes(String(dispatch.etaMinutes || 15));
      setPatientCondition(dispatch.patientCondition || "");
      const beds = dispatch.requestedBeds || 1;
      setRequestedBeds(String(beds));
      prevValidBedsRef.current = beds;
      setBedCategoryCode(dispatch.bedCategoryCode || "ICU");
      setPatientRef(dispatch.patientRef || dispatch.patientReference || "");
      setAmbulanceUnit(dispatch.ambulanceUnit || dispatch.ambulanceId || "");
      setError(null);
    }

    prevOpenRef.current = isOpen;
    if (dispatch) {
      prevDispatchIdRef.current = dispatch.id;
    }
  }, [isOpen, dispatch?.id]);

  useEffect(() => {
    if (!isOpen || !dispatch) return;
    const provided = propHospitalBeds || (dispatch as any).hospitalBeds;
    if (provided && provided.length > 0) {
      return;
    }
    // Only fetch live beds from Neon if not provided in props/dispatch
    fetch(`/api/dispatch-requests/${dispatch.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.beds && Array.isArray(data.beds)) {
          setFetchedBeds(data.beds);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch live hospital beds in modify modal:", err);
      });
  }, [isOpen, dispatch?.id]);

  // Dynamic hospital bed availability from Neon
  const hospitalBeds = propHospitalBeds || (dispatch as any)?.hospitalBeds || fetchedBeds;

  // Build complete list of available categories
  const categoryOptions = useMemo(() => {
    const list: { code: string; label: string; available: number }[] = [];

    for (const base of BASE_CATEGORIES) {
      const match = hospitalBeds.find((b: any) => matchCategory(b.categoryCode, base.code));
      list.push({
        code: base.code,
        label: base.label,
        available: match ? match.availableBeds : 0,
      });
    }

    if (Array.isArray(hospitalBeds)) {
      for (const b of hospitalBeds) {
        if (!list.some((c) => matchCategory(c.code, b.categoryCode))) {
          list.push({
            code: b.categoryCode,
            label: b.name || b.categoryCode,
            available: b.availableBeds,
          });
        }
      }
    }

    return list;
  }, [hospitalBeds]);

  const approvedCount = dispatch?.approvedBeds || 0;
  const isAccepted = dispatch?.status?.toUpperCase() === "ACCEPTED";
  const isCategoryChanged = !matchCategory(bedCategoryCode, dispatch?.bedCategoryCode);

  const currentCategoryBeds = hospitalBeds.find((b: any) =>
    matchCategory(b.categoryCode, bedCategoryCode)
  );

  // Maximum beds available in hospital for the selected category
  const maxAvailableBeds = currentCategoryBeds
    ? !isCategoryChanged && isAccepted
      ? currentCategoryBeds.availableBeds + approvedCount
      : currentCategoryBeds.availableBeds
    : 0;

  if (!isOpen || !dispatch) return null;

  // Calculations for bed preview
  const parsedPreviewBeds =
    requestedBeds.trim() === "" || isNaN(Number(requestedBeds))
      ? prevValidBedsRef.current || dispatch.requestedBeds || 1
      : Math.max(1, parseInt(requestedBeds, 10));

  let approvedPreview = approvedCount;
  let additionalPending = 0;
  if (isAccepted) {
    if (isCategoryChanged) {
      // Category changed: approved count resets to 0 (Requirement 4)
      approvedPreview = 0;
      additionalPending = parsedPreviewBeds;
    } else if (parsedPreviewBeds < approvedCount) {
      approvedPreview = parsedPreviewBeds;
      additionalPending = 0;
    } else {
      approvedPreview = approvedCount;
      additionalPending = Math.max(0, parsedPreviewBeds - approvedCount);
    }
  }

  // Calculate arrival times for preview
  const parsedPreviewEta =
    etaMinutes.trim() === "" || isNaN(Number(etaMinutes))
      ? dispatch.etaMinutes || 15
      : Math.max(1, parseInt(etaMinutes, 10));

  const now = new Date();
  const currentArrival = new Date(now.getTime() + (dispatch.etaMinutes || 15) * 60 * 1000);
  const newArrival = new Date(now.getTime() + parsedPreviewEta * 60 * 1000);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      // Validate only final submitted value & restore previous stored value if empty
      const finalEta =
        etaMinutes.trim() === "" || isNaN(Number(etaMinutes))
          ? dispatch.etaMinutes || 15
          : parseInt(etaMinutes, 10);

      if (finalEta < 1) {
        throw new Error("Travel duration must be at least 1 minute.");
      }

      // Explicitly reject negative or zero bed count
      if (requestedBeds.trim() !== "") {
        const rawBeds = Number(requestedBeds);
        if (isNaN(rawBeds) || rawBeds < 1) {
          throw new Error("Requested bed count must be at least 1.");
        }
      }

      const finalBeds =
        requestedBeds.trim() === "" || isNaN(Number(requestedBeds))
          ? dispatch.requestedBeds || 1
          : parseInt(requestedBeds, 10);

      if (finalBeds < 1) {
        throw new Error("Requested bed count must be at least 1.");
      }

      const finalCondition =
        patientCondition.trim() === "" ? dispatch.patientCondition : patientCondition.trim();

      const finalPatientRef =
        patientRef.trim() === "" ? (dispatch.patientRef || dispatch.patientReference || "") : patientRef.trim();

      const finalAmbulanceUnit =
        ambulanceUnit.trim() === "" ? (dispatch.ambulanceUnit || dispatch.ambulanceId || "") : ambulanceUnit.trim();

      // Enforce bed count limit against real hospital capacity from Neon
      if (maxAvailableBeds > 0 && finalBeds > maxAvailableBeds) {
        throw new Error(
          `Requested bed count (${finalBeds}) exceeds available hospital capacity (${maxAvailableBeds}) for ${bedCategoryCode}.`
        );
      }

      const res = await fetch("/api/dispatch/modify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etaMinutes: finalEta,
          patientCondition: finalCondition,
          requestedBeds: finalBeds,
          bedCategoryCode,
          patientRef: finalPatientRef,
          patientReference: finalPatientRef,
          ambulanceUnit: finalAmbulanceUnit,
          ambulanceId: finalAmbulanceUnit,
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
          {/* Bed Category & Requested Beds */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            {/* Bed Category Selection */}
            <div>
              <label className="block font-mono text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
                CATEGORY
              </label>
              <select
                value={bedCategoryCode}
                onChange={(e) => setBedCategoryCode(e.target.value)}
                className="w-full px-3 py-2 font-mono text-xs bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.label} ({cat.available} avail)
                  </option>
                ))}
              </select>
            </div>

            {/* Requested Beds */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa]">
                  REQUESTED BEDS
                </label>
                <span className="text-[10px] font-mono text-slate-500 dark:text-[#777]">
                  Max: <strong className="text-emerald-700 dark:text-emerald-400">{maxAvailableBeds}</strong>
                </span>
              </div>
              <input
                type="number"
                min="1"
                max={maxAvailableBeds > 0 ? maxAvailableBeds : undefined}
                value={requestedBeds}
                onFocus={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val) && val >= 1) prevValidBedsRef.current = val;
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setRequestedBeds("");
                    return;
                  }
                  const parsed = parseInt(val, 10);
                  if (!isNaN(parsed)) {
                    setRequestedBeds(val);
                    if (parsed >= 1) prevValidBedsRef.current = parsed;
                  }
                }}
                onBlur={() => {
                  if (requestedBeds.trim() === "" || isNaN(Number(requestedBeds)) || Number(requestedBeds) < 1) {
                    setRequestedBeds(String(prevValidBedsRef.current || dispatch.requestedBeds || 1));
                  } else {
                    const parsed = parseInt(requestedBeds, 10);
                    setRequestedBeds(String(parsed));
                    prevValidBedsRef.current = parsed;
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none font-mono"
                placeholder={String(dispatch.requestedBeds || 1)}
              />
              <span className="text-[10px] font-mono text-slate-500 dark:text-[#777] block mt-1">
                Available in {bedCategoryCode}: <strong className="text-emerald-700 dark:text-emerald-400">{maxAvailableBeds}</strong> beds
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            {/* ETA (Minutes) */}
            <div>
              <label className="block text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
                ESTIMATED TRAVEL ETA (MINUTES)
              </label>
              <input
                type="number"
                min="1"
                max="300"
                value={etaMinutes}
                onChange={(e) => setEtaMinutes(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none font-mono"
                placeholder={String(dispatch.etaMinutes || 15)}
              />
            </div>

            {/* Ambulance / Unit ID */}
            <div>
              <label className="block text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
                AMBULANCE UNIT IDENTIFIER
              </label>
              <input
                type="text"
                value={ambulanceUnit}
                onChange={(e) => setAmbulanceUnit(e.target.value)}
                placeholder={dispatch.ambulanceUnit || dispatch.ambulanceId || "e.g. 108 EMS Unit-22"}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Patient Condition */}
          <div>
            <label className="block font-mono text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
              PATIENT CLINICAL CONDITION & NOTES
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

          {/* Patient Reference */}
          <div>
            <label className="block font-mono text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
              PATIENT REFERENCE ID
            </label>
            <input
              type="text"
              value={patientRef}
              onChange={(e) => setPatientRef(e.target.value)}
              placeholder={dispatch.patientRef || dispatch.patientReference || "e.g. PAT-9204"}
              className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none font-mono text-xs"
            />
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
