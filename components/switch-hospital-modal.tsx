"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ActiveDispatch } from "@/hooks/use-active-dispatch";

export interface TargetHospitalInfo {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  beds?: {
    categoryCode: string;
    name?: string;
    availableBeds: number;
    totalBeds: number;
  }[];
}

interface SwitchHospitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDispatch: ActiveDispatch | null;
  targetHospital?: TargetHospitalInfo | null;
  availableHospitals?: TargetHospitalInfo[];
  onConfirmSwitch: (params?: { targetHospitalId?: string; bedCategoryCode: string; requestedBeds: number }) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
}

const SUPPORTED_CATEGORIES = [
  { code: "ICU", label: "ICU (Intensive Care)" },
  { code: "GENERAL", label: "General Medical Ward" },
  { code: "VENTILATOR", label: "Ventilator & Critical Care" },
  { code: "NICU", label: "Neonatal Intensive Care (NICU)" },
  { code: "PEDIATRIC_ICU", label: "Pediatric ICU (PICU)" },
];

export function SwitchHospitalModal({
  isOpen,
  onClose,
  currentDispatch,
  targetHospital,
  availableHospitals,
  onConfirmSwitch,
  isSubmitting = false,
  error = null,
}: SwitchHospitalModalProps) {
  const [internalHospitals, setInternalHospitals] = useState<TargetHospitalInfo[]>([]);
  const [isLoadingHospitals, setIsLoadingHospitals] = useState<boolean>(false);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
  const [bedCategoryCode, setBedCategoryCode] = useState<string>("ICU");
  const [requestedBeds, setRequestedBeds] = useState<string>("1");
  const prevRequestedBedsRef = useRef<number>(1);
  const [localError, setLocalError] = useState<string | null>(null);

  const prevOpenRef = useRef<boolean>(false);
  const prevDispatchIdRef = useRef<string | null>(null);

  // Fallback: If availableHospitals is not provided or empty, fetch hospitals from API
  useEffect(() => {
    if (!isOpen) return;
    if (availableHospitals && availableHospitals.length > 0) return;

    let isMounted = true;
    setIsLoadingHospitals(true);
    fetch("/api/hospitals/search")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data.hospitals)) {
          const others = data.hospitals.filter(
            (h: any) => h.id !== currentDispatch?.hospitalId
          );
          setInternalHospitals(others);
        }
      })
      .catch((err) => console.error("Error fetching hospitals for switch modal:", err))
      .finally(() => {
        if (isMounted) setIsLoadingHospitals(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, availableHospitals, currentDispatch?.hospitalId]);

  // Combine external and internal hospital lists, excluding the current receiving facility
  const combinedHospitals = useMemo(() => {
    const list = (availableHospitals && availableHospitals.length > 0)
      ? availableHospitals
      : internalHospitals;
    return list.filter((h) => h.id !== currentDispatch?.hospitalId);
  }, [availableHospitals, internalHospitals, currentDispatch?.hospitalId]);

  // Synchronize initial form state strictly when the modal opens or active dispatch changes.
  // NEVER overwrite user typing on background polling ticks!
  useEffect(() => {
    if (isOpen && currentDispatch) {
      const isNewOpen = !prevOpenRef.current;
      const isDifferentDispatch = currentDispatch.id !== prevDispatchIdRef.current;

      if (isNewOpen || isDifferentDispatch) {
        prevOpenRef.current = true;
        prevDispatchIdRef.current = currentDispatch.id;

        const initialCategory = currentDispatch.bedCategoryCode || "ICU";
        const initialBeds = currentDispatch.requestedBeds || 1;
        setBedCategoryCode(initialCategory);
        setRequestedBeds(String(initialBeds));
        prevRequestedBedsRef.current = initialBeds;
        setLocalError(null);

        // Set initial hospital
        if (targetHospital && targetHospital.id !== currentDispatch.hospitalId) {
          setSelectedHospitalId(targetHospital.id);
        } else if (combinedHospitals.length > 0) {
          setSelectedHospitalId(combinedHospitals[0].id);
        }
      }
    } else if (!isOpen) {
      prevOpenRef.current = false;
    }
  }, [isOpen, currentDispatch, targetHospital, combinedHospitals]);

  // If selectedHospitalId is empty or not in combinedHospitals, select the first valid option
  useEffect(() => {
    if (isOpen && combinedHospitals.length > 0) {
      const exists = combinedHospitals.some((h) => h.id === selectedHospitalId);
      if (!exists) {
        if (targetHospital && targetHospital.id !== currentDispatch?.hospitalId) {
          setSelectedHospitalId(targetHospital.id);
        } else {
          setSelectedHospitalId(combinedHospitals[0].id);
        }
      }
    }
  }, [isOpen, combinedHospitals, selectedHospitalId, targetHospital, currentDispatch?.hospitalId]);

  // Determine effective target hospital
  const effectiveHospital = useMemo(() => {
    if (selectedHospitalId) {
      const found = combinedHospitals.find((h) => h.id === selectedHospitalId);
      if (found) return found;
    }
    if (targetHospital && targetHospital.id !== currentDispatch?.hospitalId) {
      return targetHospital;
    }
    return combinedHospitals[0] || null;
  }, [selectedHospitalId, combinedHospitals, targetHospital, currentDispatch?.hospitalId]);

  // Derive available categories and available counts for the effective hospital
  const categoryOptions = useMemo(() => {
    if (!effectiveHospital) {
      return SUPPORTED_CATEGORIES.map((c) => ({ ...c, available: 0 }));
    }

    const list: { code: string; label: string; available: number }[] = [];

    // Map base categories
    for (const cat of SUPPORTED_CATEGORIES) {
      const found = effectiveHospital.beds?.find(
        (b) =>
          b.categoryCode.toUpperCase() === cat.code.toUpperCase() ||
          (cat.code === "NICU" && b.categoryCode.toUpperCase() === "NEONATAL_ICU") ||
          (cat.code === "NEONATAL_ICU" && b.categoryCode.toUpperCase() === "NICU")
      );
      list.push({
        code: cat.code,
        label: cat.label,
        available: found ? found.availableBeds : 0,
      });
    }

    // Add hospital-specific bed categories not present in base list
    if (effectiveHospital.beds) {
      for (const b of effectiveHospital.beds) {
        const isAlreadyListed = list.some(
          (c) =>
            c.code.toUpperCase() === b.categoryCode.toUpperCase() ||
            (c.code === "NICU" && b.categoryCode.toUpperCase() === "NEONATAL_ICU")
        );
        if (!isAlreadyListed) {
          list.push({
            code: b.categoryCode,
            label: b.name || b.categoryCode,
            available: b.availableBeds,
          });
        }
      }
    }

    return list;
  }, [effectiveHospital]);

  // Derive maximum beds available in the effective hospital for the selected category
  const targetCategoryBed = useMemo(() => {
    if (!effectiveHospital?.beds) return null;
    return effectiveHospital.beds.find(
      (b) =>
        b.categoryCode.toUpperCase() === bedCategoryCode.toUpperCase() ||
        (bedCategoryCode.toUpperCase() === "NICU" && b.categoryCode.toUpperCase() === "NEONATAL_ICU") ||
        (bedCategoryCode.toUpperCase() === "NEONATAL_ICU" && b.categoryCode.toUpperCase() === "NICU")
    );
  }, [effectiveHospital, bedCategoryCode]);

  const maxAvailableBeds = targetCategoryBed ? targetCategoryBed.availableBeds : 0;

  // Early return strictly AFTER all hooks are called
  if (!isOpen || !currentDispatch) {
    return null;
  }

  const isAccepted = currentDispatch.status.toUpperCase() === "ACCEPTED";

  const handleConfirm = async () => {
    setLocalError(null);

    if (!effectiveHospital) {
      setLocalError("Please select a target receiving hospital facility.");
      return;
    }

    let finalBeds: number;
    if (requestedBeds.trim() === "" || isNaN(Number(requestedBeds)) || Number(requestedBeds) < 1) {
      finalBeds = prevRequestedBedsRef.current || 1;
      setRequestedBeds(String(finalBeds));
    } else {
      finalBeds = parseInt(requestedBeds, 10);
      prevRequestedBedsRef.current = finalBeds;
    }

    if (finalBeds < 1) {
      setLocalError("Requested bed count must be at least 1.");
      return;
    }

    if (maxAvailableBeds > 0 && finalBeds > maxAvailableBeds) {
      setLocalError(
        `${effectiveHospital.name} only has ${maxAvailableBeds} available ${bedCategoryCode} bed(s). Cannot request ${finalBeds}.`
      );
      return;
    }

    await onConfirmSwitch({
      targetHospitalId: effectiveHospital.id,
      bedCategoryCode: bedCategoryCode.toUpperCase(),
      requestedBeds: finalBeds,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#0f0f0f] border border-slate-300 dark:border-[#2a2a2a] w-full max-w-md rounded-xs p-5 sm:p-6 shadow-xl text-slate-900 dark:text-[#ededed] font-sans transition-colors my-8">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-[#222222] pb-3 mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold block">
              ACTIVE REQUEST MANAGEMENT
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
          {/* Current Hospital */}
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
                ({currentDispatch.bedCategoryCode} · {currentDispatch.requestedBeds} bed{currentDispatch.requestedBeds > 1 ? "s" : ""})
              </span>
            </div>
          </div>

          {/* New Hospital Selector Card */}
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold tracking-wider">
                NEW DESTINATION FACILITY
              </span>
              {combinedHospitals.length > 1 && (
                <span className="text-[10px] text-slate-500 dark:text-[#777] font-mono">
                  {combinedHospitals.length} options
                </span>
              )}
            </div>

            {isLoadingHospitals && combinedHospitals.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">Loading available facilities...</div>
            ) : combinedHospitals.length > 0 ? (
              <div className="mt-1">
                <select
                  value={effectiveHospital ? effectiveHospital.id : selectedHospitalId}
                  onChange={(e) => {
                    setSelectedHospitalId(e.target.value);
                    setLocalError(null);
                  }}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#111] border border-blue-300 dark:border-blue-800 text-slate-900 dark:text-[#ededed] font-bold text-xs rounded-xs focus:outline-none"
                >
                  {combinedHospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.city ? `(${h.city})` : ""}
                    </option>
                  ))}
                </select>
                {effectiveHospital && effectiveHospital.address && (
                  <div className="text-[10px] text-slate-500 dark:text-[#888] mt-1 break-words">
                    {effectiveHospital.address}{effectiveHospital.city ? `, ${effectiveHospital.city}` : ""}
                  </div>
                )}
              </div>
            ) : effectiveHospital ? (
              <div>
                <div className="font-bold text-slate-900 dark:text-[#ededed] text-sm break-words">
                  {effectiveHospital.name}
                </div>
                {effectiveHospital.city && (
                  <div className="text-[11px] text-slate-600 dark:text-[#888888] mt-0.5 break-words">
                    {effectiveHospital.address ? `${effectiveHospital.address}, ` : ""}
                    {effectiveHospital.city}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-amber-700 dark:text-amber-400 py-2">
                No alternate receiving hospital facilities available.
              </div>
            )}
          </div>
        </div>

        {/* Editable Category & Requested Beds for Destination Facility */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 font-mono text-xs">
          <div>
            <label className="block text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa] mb-1">
              Category
            </label>
            <select
              value={bedCategoryCode}
              onChange={(e) => {
                setBedCategoryCode(e.target.value);
                setLocalError(null);
              }}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-[#111] border border-slate-300 dark:border-[#333] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none"
            >
              {categoryOptions.map((cat) => (
                <option key={cat.code} value={cat.code}>
                  {cat.label} ({cat.available} avail)
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] uppercase font-semibold text-slate-700 dark:text-[#aaa]">
                Requested Beds
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
                if (!isNaN(val) && val >= 1) prevRequestedBedsRef.current = val;
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
                  if (parsed >= 1) prevRequestedBedsRef.current = parsed;
                }
              }}
              onBlur={() => {
                if (requestedBeds.trim() === "" || isNaN(Number(requestedBeds)) || Number(requestedBeds) < 1) {
                  setRequestedBeds(String(prevRequestedBedsRef.current || 1));
                } else {
                  const parsed = parseInt(requestedBeds, 10);
                  setRequestedBeds(String(parsed));
                  prevRequestedBedsRef.current = parsed;
                }
              }}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-[#111] border border-slate-300 dark:border-[#333] text-slate-900 dark:text-[#ededed] rounded-xs focus:outline-none"
              required
            />
            <span className="text-[10px] font-mono text-slate-500 dark:text-[#777] block mt-1">
              Available in {bedCategoryCode}: <span className="font-bold text-emerald-700 dark:text-emerald-400">{maxAvailableBeds}</span>
            </span>
          </div>
        </div>

        <div className="p-2.5 bg-slate-100 dark:bg-[#121212] border border-slate-200 dark:border-[#222222] rounded-xs text-[11px] text-slate-600 dark:text-[#888888] mb-5 font-mono">
          The current request (<span className="font-bold text-slate-800 dark:text-[#ccc]">{currentDispatch.id}</span>) will be atomically cancelled before the new request is transmitted.
        </div>

        {(error || localError) && (
          <div className="mb-4 p-2.5 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/60 text-red-800 dark:text-red-400 text-xs font-mono rounded-xs">
            {error || localError}
          </div>
        )}

        {/* Action Buttons */}
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
            onClick={handleConfirm}
            disabled={isSubmitting || !effectiveHospital}
            className={`w-full sm:w-auto py-2.5 px-4 text-xs font-mono font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer disabled:opacity-50 text-center shadow-xs ${
              isAccepted
                ? "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 border border-red-800 dark:border-red-500 text-white"
                : "bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 border border-amber-600 dark:border-amber-500 text-slate-950 dark:text-black font-extrabold"
            }`}
          >
            {isSubmitting
              ? "SWITCHING FACILITY..."
              : isAccepted
              ? "CANCEL & SWITCH"
              : effectiveHospital
              ? `CANCEL & SEND TO ${effectiveHospital.name.split(" ")[0].toUpperCase()}`
              : "CANCEL & SWITCH"}
          </button>
        </div>
      </div>
    </div>
  );
}
