"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { formatDateTime } from "@/lib/format-date";
import { formatDistanceKm, buildGoogleMapsDirectionsUrl } from "@/lib/geo";
import { DynamicOSMMapView } from "@/components/map/dynamic-map";
import { RequestTimeline } from "@/components/request-timeline";

interface DispatchDetails {
  id: string;
  hospitalId: string;
  dispatcherSessionId?: string | null;
  ambulanceUnit: string;
  ambulanceId?: string | null;
  ambulanceLat: number | null;
  ambulanceLng: number | null;
  patientRef?: string | null;
  patientReference?: string | null;
  bedCategoryCode: string;
  requestedBeds: number;
  approvedBeds?: number | null;
  etaMinutes: number;
  patientCondition: string;
  status: string;
  reviewRequired?: boolean;
  reviewReason?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface HospitalDetails {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

interface BedCategoryItem {
  id: string;
  hospitalId: string;
  categoryCode: string;
  name: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
}

interface SuperAdminDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatchId: string | null;
  onActionComplete?: () => void;
}

export function SuperAdminDispatchModal({
  isOpen,
  onClose,
  dispatchId,
  onActionComplete,
}: SuperAdminDispatchModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dispatch, setDispatch] = useState<DispatchDetails | null>(null);
  const [hospital, setHospital] = useState<HospitalDetails | null>(null);
  const [beds, setBeds] = useState<BedCategoryItem[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const isFetchingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch full dispatch request details from API
  const fetchDetails = async (isBackground = false) => {
    if (!dispatchId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (!isBackground) {
        setLoading(true);
      }
      const res = await fetch(`/api/dispatch-requests/${dispatchId}`, {
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        setDispatch(data.dispatch);
        setHospital(data.hospital);
        setBeds(data.beds || []);
        setDistanceKm(data.distanceKm);
        setLastSyncTime(new Date().toLocaleTimeString());
        setErrorMsg(null);
      } else {
        const err = await res.json().catch(() => ({}));
        if (!isBackground) {
          setErrorMsg(err.error || "Dispatch request not found");
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch superadmin dispatch details:", err);
      if (!isBackground) {
        setErrorMsg(err.message || "Failed to load dispatch details");
      }
    } finally {
      isFetchingRef.current = false;
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  // Initial fetch and 1-second synchronization interval while open
  useEffect(() => {
    if (isOpen && dispatchId) {
      setActionFeedback(null);
      fetchDetails(false);
      const interval = setInterval(() => {
        fetchDetails(true);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setDispatch(null);
      setHospital(null);
      setBeds([]);
      setErrorMsg(null);
      setActionFeedback(null);
    }
  }, [isOpen, dispatchId]);

  // SuperAdmin Direct Action Handlers
  const handleUpdateStatus = async (newStatus: string) => {
    if (!dispatchId) return;
    try {
      setActionLoading(true);
      setActionFeedback(null);

      const res = await fetch("/api/superadmin/dispatches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatchId, status: newStatus }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to update status to ${newStatus}`);
      }

      setActionFeedback({
        type: "success",
        message: `Successfully transitioned dispatch request status to ${newStatus}.`,
      });
      await fetchDetails(true);
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Action failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!dispatchId) return;
    if (!confirm(`Are you sure you want to PERMANENTLY PURGE dispatch request '${dispatchId}'? This action cannot be undone.`)) {
      return;
    }
    try {
      setActionLoading(true);
      setActionFeedback(null);

      const res = await fetch("/api/superadmin/dispatches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatchId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to purge dispatch request");
      }

      if (onActionComplete) onActionComplete();
      onClose();
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Failed to purge dispatch",
      });
      setActionLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  // Compute calculated arrival time
  let estimatedArrivalStr = "Calculating...";
  if (dispatch) {
    const createdDate = new Date(dispatch.createdAt);
    const arrivalDate = new Date(createdDate.getTime() + dispatch.etaMinutes * 60000);
    estimatedArrivalStr = arrivalDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const approvedBedsCount = dispatch?.approvedBeds ?? 0;
  const requestedBedsCount = dispatch?.requestedBeds ?? 0;
  const pendingBedsCount = Math.max(0, requestedBedsCount - approvedBedsCount);

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-details-title"
      className="fixed inset-0 z-[9990] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-5xl max-h-[94vh] flex flex-col bg-white dark:bg-[#0c0c0c] border border-slate-300 dark:border-[#262626] rounded-sm shadow-2xl overflow-hidden font-sans text-slate-900 dark:text-[#f0f0f0] animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#121212] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Clear BACK Action Button */}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-white dark:bg-[#1c1c1c] hover:bg-slate-100 dark:hover:bg-[#282828] text-slate-800 dark:text-[#ededed] border border-slate-300 dark:border-[#333333] rounded-xs transition-colors cursor-pointer shadow-2xs shrink-0"
              aria-label="Back to Dispatches List"
            >
              ← BACK
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold tracking-widest text-blue-700 dark:text-blue-400 uppercase">
                  SUPERADMIN TELEMETRY INSPECTOR
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded-xs border border-emerald-200 dark:border-emerald-900/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE SYNC {lastSyncTime ? `(${lastSyncTime})` : ""}
                </span>
              </div>
              <h2
                id="dispatch-details-title"
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate mt-0.5"
              >
                DISPATCH REQUEST DETAILS
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchDetails(false)}
              disabled={loading || actionLoading}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-[#bbb] hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#1a1a1a] hover:bg-slate-100 dark:hover:bg-[#252525] border border-slate-300 dark:border-[#333] rounded-xs transition-colors cursor-pointer"
              title="Manually re-sync latest database records"
            >
              <svg className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>SYNC</span>
            </button>

            {/* Clear CLOSE Action Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white rounded hover:bg-slate-200/50 dark:hover:bg-[#222] transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
          {loading && !dispatch ? (
            <div className="py-16 flex flex-col items-center justify-center font-mono text-xs text-slate-500 dark:text-[#888] gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>FETCHING COMPLETE SYSTEM-WIDE DISPATCH TELEMETRY...</span>
            </div>
          ) : errorMsg || !dispatch ? (
            <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xs text-center space-y-2">
              <span className="font-mono text-xs font-bold uppercase text-red-700 dark:text-red-400 block">
                FAILED TO LOAD DISPATCH RECORD
              </span>
              <p className="text-slate-700 dark:text-[#ddd] text-xs font-mono">
                {errorMsg || "The dispatch request ID could not be retrieved from the database."}
              </p>
              <button
                type="button"
                onClick={() => fetchDetails(false)}
                className="mt-3 px-4 py-2 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-mono font-bold text-xs rounded-xs"
              >
                RETRY
              </button>
            </div>
          ) : (
            <>
              {/* Feedback banner */}
              {actionFeedback && (
                <div
                  className={`p-3 rounded-xs font-mono text-xs border flex items-center justify-between gap-2 ${
                    actionFeedback.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800/60 text-red-900 dark:text-red-300"
                  }`}
                >
                  <span>{actionFeedback.message}</span>
                  <button
                    type="button"
                    onClick={() => setActionFeedback(null)}
                    className="text-xs font-bold px-2 py-0.5 hover:opacity-75"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 1. Main Status & Operational Summary Header */}
              <div className="bg-white dark:bg-[#111111] p-4 sm:p-5 border border-slate-200 dark:border-[#222222] rounded-xs shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                      <span
                        className={`px-2.5 py-0.5 rounded-xs font-bold uppercase text-[11px] border ${
                          dispatch.status === "ACCEPTED"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                            : dispatch.status === "COMPLETED"
                            ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 border-blue-300 dark:border-blue-800/60"
                            : dispatch.status === "EXPIRED"
                            ? "bg-slate-200 dark:bg-[#1a1a1a] text-slate-700 dark:text-[#999] border-slate-300 dark:border-[#333]"
                            : dispatch.status === "REJECTED"
                            ? "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800/60"
                            : dispatch.status === "CANCELLED"
                            ? "bg-slate-200 dark:bg-[#1f1f1f] text-slate-800 dark:text-[#aaa] border-slate-400 dark:border-[#333]"
                            : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/60"
                        }`}
                      >
                        {dispatch.status}
                      </span>

                      {dispatch.reviewRequired && (
                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-[#1a1708] text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 rounded-xs font-semibold text-[10px]">
                          REVIEW REQUIRED ({pendingBedsCount} pending)
                        </span>
                      )}

                      <span className="text-slate-400 dark:text-[#666]">·</span>
                      <span className="text-slate-500 dark:text-[#888] font-bold break-all">
                        ID: {dispatch.id}
                      </span>
                    </div>

                    <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#ededed] break-words">
                      Ambulance {dispatch.ambulanceUnit} → {hospital?.name || "Target Hospital"}
                    </h1>
                    <p className="text-xs font-mono text-slate-500 dark:text-[#777]">
                      Created: {formatDateTime(dispatch.createdAt, true)} · Last Modified:{" "}
                      {formatDateTime(dispatch.updatedAt, true)}
                    </p>
                  </div>

                  {/* SuperAdmin Quick Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-t-0 dark:border-[#1e1e1e]">
                    {dispatch.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus("ACCEPTED")}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        ACCEPT DISPATCH
                      </button>
                    )}
                    {dispatch.status === "ACCEPTED" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus("COMPLETED")}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        MARK COMPLETED
                      </button>
                    )}
                    {dispatch.status !== "CANCELLED" && dispatch.status !== "COMPLETED" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus("CANCELLED")}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a1a] dark:hover:bg-[#252525] text-slate-800 dark:text-[#ddd] border border-slate-300 dark:border-[#333] rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        CANCEL
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handlePurge}
                      disabled={actionLoading}
                      className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/60 rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      PURGE RECORD
                    </button>
                  </div>
                </div>

                {/* Status Notice Callouts */}
                {dispatch.reviewRequired && dispatch.reviewReason && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 rounded-xs text-xs font-mono text-amber-900 dark:text-amber-300">
                    <span className="font-bold uppercase block mb-0.5">Hospital Review Pending:</span>
                    {dispatch.reviewReason}
                  </div>
                )}
                {dispatch.status === "REJECTED" && dispatch.rejectionReason && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/60 rounded-xs text-xs font-mono text-red-900 dark:text-red-300">
                    <span className="font-bold uppercase block mb-0.5">Hospital Rejection Reason:</span>
                    {dispatch.rejectionReason}
                  </div>
                )}
                {dispatch.status === "EXPIRED" && (
                  <div className="mt-3 p-3 bg-slate-100 dark:bg-[#151515] border-l-4 border-slate-400 dark:border-slate-600 rounded-xs text-xs font-mono text-slate-700 dark:text-[#aaa]">
                    <span className="font-bold uppercase block mb-0.5 text-slate-900 dark:text-[#eee]">REQUEST EXPIRED</span>
                    The request reached its expiry threshold without receiving the required hospital approval.
                  </div>
                )}
              </div>

              {/* 2. Detailed Technical Telemetry Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                {/* Section A: Hospital Target Information */}
                <div className="bg-white dark:bg-[#111111] p-4 border border-slate-200 dark:border-[#222222] rounded-xs space-y-3">
                  <div className="border-b border-slate-200 dark:border-[#222222] pb-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
                        01. RECEIVING FACILITY
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed]">
                        {hospital?.name || "Target Hospital"}
                      </h3>
                    </div>
                    {hospital?.status && (
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded-xs ${
                          hospital.status === "ACTIVE"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                            : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {hospital.status}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Hospital ID:</span>
                      <span className="font-bold text-slate-800 dark:text-[#ccc] break-all text-right">{dispatch.hospitalId}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Address:</span>
                      <span className="text-slate-800 dark:text-[#ccc] text-right break-words">{hospital?.address || "—"}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 uppercase shrink-0">City & State:</span>
                      <span className="text-slate-800 dark:text-[#ccc] text-right">
                        {hospital?.city || "—"}{hospital?.state ? `, ${hospital.state}` : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Contact Phone:</span>
                      <span className="font-bold text-slate-900 dark:text-white text-right">{hospital?.phone || "—"}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Hospital GPS:</span>
                      <span className="text-slate-800 dark:text-[#ccc] text-right">
                        {hospital?.latitude !== null && hospital?.latitude !== undefined && hospital?.longitude !== null && hospital?.longitude !== undefined
                          ? `${Number(hospital.latitude).toFixed(4)}, ${Number(hospital.longitude).toFixed(4)}`
                          : "Not configured"}
                      </span>
                    </div>
                    {distanceKm !== null && (
                      <div className="flex justify-between items-start gap-2 border-t border-slate-100 dark:border-[#1e1e1e] pt-1.5">
                        <span className="text-slate-500 uppercase shrink-0">Calculated Distance:</span>
                        <span className="font-bold text-blue-700 dark:text-blue-400">{formatDistanceKm(distanceKm)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section B: Ambulance & Patient Profile */}
                <div className="bg-white dark:bg-[#111111] p-4 border border-slate-200 dark:border-[#222222] rounded-xs space-y-3">
                  <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
                      02. AMBULANCE & PATIENT
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed]">
                      Vehicle Telemetry & Clinical Case
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Ambulance Unit:</span>
                      <span className="font-bold text-slate-900 dark:text-white break-all">{dispatch.ambulanceUnit}</span>
                    </div>
                    {dispatch.ambulanceId && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-500 uppercase shrink-0">Ambulance ID:</span>
                        <span className="text-slate-800 dark:text-[#ccc] break-all">{dispatch.ambulanceId}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Patient Ref:</span>
                      <span className="font-bold text-slate-800 dark:text-[#ccc] break-all">
                        {dispatch.patientRef || dispatch.patientReference || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Clinical Condition:</span>
                      <span className="font-bold text-slate-900 dark:text-white text-right break-words max-w-[240px]">
                        {dispatch.patientCondition}
                      </span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Origin GPS:</span>
                      <span className="font-bold text-slate-800 dark:text-[#ccc] text-right">
                        {dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null
                          ? `${Number(dispatch.ambulanceLat).toFixed(4)}, ${Number(dispatch.ambulanceLng).toFixed(4)}`
                          : "No GPS reported"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start gap-2 border-t border-slate-100 dark:border-[#1e1e1e] pt-1.5">
                      <span className="text-slate-500 uppercase shrink-0">Dispatcher Session:</span>
                      <span className="text-slate-600 dark:text-[#777] break-all text-right text-[11px]">
                        {dispatch.dispatcherSessionId || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section C: Capacity & Bed Allocation Details */}
                <div className="bg-white dark:bg-[#111111] p-4 border border-slate-200 dark:border-[#222222] rounded-xs space-y-3">
                  <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
                      03. BED REQUIREMENT & ALLOCATION
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed]">
                      Capacity Breakdown
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Category Code:</span>
                      <span className="font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-xs border border-blue-200 dark:border-blue-900/60">
                        {dispatch.bedCategoryCode}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Beds Requested:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {dispatch.requestedBeds} bed{dispatch.requestedBeds > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Beds Approved:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {approvedBedsCount} bed{approvedBedsCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Beds Pending Review:</span>
                      <span className={pendingBedsCount > 0 ? "font-bold text-amber-600 dark:text-amber-400" : "text-slate-500"}>
                        {pendingBedsCount} bed{pendingBedsCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2 border-t border-slate-100 dark:border-[#1e1e1e] pt-1.5">
                      <span className="text-slate-500 uppercase shrink-0">Review Flag:</span>
                      <span className={dispatch.reviewRequired ? "font-bold text-amber-600 dark:text-amber-400" : "text-slate-500"}>
                        {dispatch.reviewRequired ? "YES (Pending Staff Action)" : "NO"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section D: ETA, Arrival & Lifecycle Timeline */}
                <div className="bg-white dark:bg-[#111111] p-4 border border-slate-200 dark:border-[#222222] rounded-xs space-y-3">
                  <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
                      04. ETA & ARRIVAL INFORMATION
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed]">
                      Transit Estimation
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Estimated Travel Time:</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {dispatch.etaMinutes} minutes
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Expected Arrival Time:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        ~{estimatedArrivalStr}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Creation Timestamp:</span>
                      <span className="text-slate-800 dark:text-[#ccc] text-right">
                        {formatDateTime(dispatch.createdAt, true)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 uppercase shrink-0">Last Status Update:</span>
                      <span className="text-slate-800 dark:text-[#ccc] text-right">
                        {formatDateTime(dispatch.updatedAt, true)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2 border-t border-slate-100 dark:border-[#1e1e1e] pt-1.5">
                      <span className="text-slate-500 uppercase shrink-0">Lifecycle Phase:</span>
                      <span className="font-bold text-slate-800 dark:text-[#ccc]">
                        {dispatch.status === "COMPLETED"
                          ? "Arrival Complete"
                          : dispatch.status === "EXPIRED"
                          ? "Threshold Expired"
                          : dispatch.status === "ACCEPTED"
                          ? "En Route (Reserved)"
                          : dispatch.status === "PENDING"
                          ? "Triage In Progress"
                          : "Closed"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. OpenStreetMap Route Overview & Driving Directions */}
              {hospital?.latitude !== null && hospital?.latitude !== undefined && hospital?.longitude !== null && hospital?.longitude !== undefined && (
                <div className="bg-white dark:bg-[#111111] p-4 border border-slate-200 dark:border-[#222222] rounded-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-[#222222] pb-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
                        GEOGRAPHIC VECTOR & ROUTE OVERVIEW
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed]">
                        OpenStreetMap Live Vector: {dispatch.ambulanceUnit} → {hospital.name}
                      </h3>
                    </div>

                    <a
                      href={buildGoogleMapsDirectionsUrl({
                        lat: hospital.latitude,
                        lng: hospital.longitude,
                        name: hospital.name,
                        address: hospital.address,
                        city: hospital.city,
                        origin:
                          dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null
                            ? { lat: dispatch.ambulanceLat, lng: dispatch.ambulanceLng }
                            : undefined,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-white dark:bg-[#1a1a1a] hover:bg-blue-50 dark:hover:bg-[#252525] text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-900/60 rounded-xs transition-colors shadow-2xs self-start sm:self-auto"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span>OPEN GOOGLE MAPS ↗</span>
                    </a>
                  </div>

                  <div className="h-[220px] sm:h-[300px] border border-slate-200 dark:border-[#222222] rounded-xs overflow-hidden">
                    <DynamicOSMMapView
                      ambulanceLocation={
                        dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null
                          ? {
                              lat: dispatch.ambulanceLat,
                              lng: dispatch.ambulanceLng,
                              unitId: dispatch.ambulanceUnit,
                              condition: dispatch.patientCondition,
                            }
                          : null
                      }
                      hospitals={[
                        {
                          id: hospital.id,
                          name: hospital.name,
                          latitude: hospital.latitude,
                          longitude: hospital.longitude,
                          address: hospital.address,
                          city: hospital.city,
                          state: hospital.state,
                          phone: hospital.phone,
                          distanceKm: distanceKm,
                          availableBeds: 1,
                          isSuitable: true,
                          isSelected: true,
                        },
                      ]}
                      center={[hospital.latitude, hospital.longitude]}
                      showRoute={dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null}
                      className="h-full w-full"
                    />
                  </div>
                </div>
              )}

              {/* 4. Complete Audit & Activity Timeline (Shared Component) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-[#222222]">
                  <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-[#aaa] uppercase tracking-widest">
                    SYSTEM-WIDE ACTIVITY & TELEMETRY STREAM
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Auto-synchronized
                  </span>
                </div>
                <RequestTimeline dispatchId={dispatch.id} refreshTrigger={dispatch.updatedAt} />
              </div>
            </>
          )}
        </div>

        {/* Modal Bottom Footer Bar */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#121212] flex items-center justify-between shrink-0 font-mono text-xs">
          <div className="text-[11px] text-slate-500 dark:text-[#777] truncate mr-2">
            SuperAdmin Access · Full Audit Trail Logged
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 rounded-xs cursor-pointer transition-colors shadow-xs"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
