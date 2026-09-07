"use client";

import React, { useEffect } from "react";
import { formatDateTime } from "@/lib/format-date";

export interface AuditPayloadItem {
  id: string;
  dispatchId?: string | null;
  requestId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  timestamp: string | Date;
  actorType?: string | null;
  actorName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  action: string;
  details?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  note?: string | null;
}

interface AuditPayloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditItem: AuditPayloadItem | null;
}

interface DiffRow {
  label: string;
  previous: string | null;
  next: string | null;
  isNestedJson?: boolean;
  previousJson?: any;
  nextJson?: any;
}

function normalizeActor(item: AuditPayloadItem): string {
  const type = (item.actorType || "").toUpperCase();
  const name = item.actorName || item.userName;
  const email = item.userEmail;

  if (type === "DISPATCHER" || (!type && name?.toLowerCase().includes("dispatcher"))) {
    return "DISPATCHER";
  }
  if (type === "HOSPITAL" || type === "HOSPITAL_STAFF" || type === "HOSPITAL_ADMIN") {
    return "HOSPITAL STAFF";
  }
  if (type === "SUPER_ADMIN" || type === "SUPERADMIN") {
    return "SUPER ADMIN";
  }
  if (type === "SYSTEM" || (!type && !name)) {
    return "SYSTEM";
  }
  if (name && !type) {
    if (email?.includes("admin")) return "SUPER ADMIN";
    return name.toUpperCase();
  }
  return type || "SYSTEM";
}

function tryParseJson(val: any): any | null {
  if (!val) return null;
  if (typeof val === "object") return val;
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function formatLabel(key: string): string {
  const map: Record<string, string> = {
    beds: "REQUESTED BEDS",
    requestedbeds: "REQUESTED BEDS",
    requested_beds: "REQUESTED BEDS",
    approvedbeds: "APPROVED BEDS",
    approved_beds: "APPROVED BEDS",
    category: "BED CATEGORY",
    bedcategory: "BED CATEGORY",
    bedcategorycode: "BED CATEGORY",
    bed_category_code: "BED CATEGORY",
    eta: "ETA",
    etaminutes: "ETA",
    eta_minutes: "ETA",
    condition: "CONDITION",
    patientcondition: "CONDITION",
    patient_condition: "CONDITION",
    ambulance: "AMBULANCE ID",
    ambulanceunit: "AMBULANCE ID",
    ambulance_unit: "AMBULANCE ID",
    patientref: "PATIENT REFERENCE",
    patientreference: "PATIENT REFERENCE",
    patient_ref: "PATIENT REFERENCE",
    status: "STATUS",
    reviewrequired: "REVIEW REQUIRED",
    reviewreason: "REVIEW REASON",
  };

  const lower = key.toLowerCase();
  if (map[lower]) return map[lower];

  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .toUpperCase();
}

function formatValue(key: string, val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "True" : "False";
  if (typeof val === "number") {
    const lower = key.toLowerCase();
    if (lower.includes("eta")) return `${val} min`;
    return String(val);
  }
  if (typeof val === "string") {
    const lower = key.toLowerCase();
    if (lower.includes("eta") && !val.includes("min") && !val.includes("m") && !isNaN(Number(val))) {
      return `${val} min`;
    }
    return val;
  }
  return JSON.stringify(val);
}

export function AuditPayloadModal({ isOpen, onClose, auditItem }: AuditPayloadModalProps) {
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

  if (!isOpen || !auditItem) return null;

  const actorLabel = normalizeActor(auditItem);
  const requestId = auditItem.dispatchId || auditItem.requestId || auditItem.resourceId || "N/A";

  // Parse Old & New values
  const oldJson = tryParseJson(auditItem.oldValue);
  const newJson = tryParseJson(auditItem.newValue);
  const detailsJson = tryParseJson(auditItem.details);

  const diffRows: DiffRow[] = [];

  if (oldJson && typeof oldJson === "object" && newJson && typeof newJson === "object") {
    // Both are structured JSON objects
    const allKeys = Array.from(new Set([...Object.keys(oldJson), ...Object.keys(newJson)]));
    for (const key of allKeys) {
      const oldVal = oldJson[key];
      const newVal = newJson[key];

      const isNested = Boolean((oldVal && typeof oldVal === "object") || (newVal && typeof newVal === "object"));
      diffRows.push({
        label: formatLabel(key),
        previous: isNested ? null : formatValue(key, oldVal),
        next: isNested ? null : formatValue(key, newVal),
        isNestedJson: isNested,
        previousJson: isNested ? oldVal : null,
        nextJson: isNested ? newVal : null,
      });
    }
  } else if (auditItem.oldValue !== null || auditItem.newValue !== null) {
    // Plain string diffs or simple values
    let label = "CHANGE DETAILS";
    const action = auditItem.action.toUpperCase();

    if (action.includes("BEDS")) label = "REQUESTED BEDS";
    else if (action.includes("CATEGORY")) label = "BED CATEGORY";
    else if (action.includes("ETA")) label = "ETA";
    else if (action.includes("CONDITION")) label = "CONDITION";
    else if (action.includes("AMBULANCE")) label = "AMBULANCE ID";
    else if (action.includes("PATIENT_REF")) label = "PATIENT REFERENCE";
    else if (action.includes("STATUS")) label = "STATUS";

    diffRows.push({
      label,
      previous: auditItem.oldValue ? formatValue(label, auditItem.oldValue) : "—",
      next: auditItem.newValue ? formatValue(label, auditItem.newValue) : "—",
    });
  } else if (detailsJson && typeof detailsJson === "object") {
    // Details itself might contain before/after or payload fields
    if (detailsJson.previous || detailsJson.new || detailsJson.before || detailsJson.after) {
      const prev = detailsJson.previous || detailsJson.before;
      const nxt = detailsJson.new || detailsJson.after;
      if (typeof prev === "object" && typeof nxt === "object") {
        const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(nxt)]));
        for (const k of allKeys) {
          diffRows.push({
            label: formatLabel(k),
            previous: formatValue(k, prev[k]),
            next: formatValue(k, nxt[k]),
          });
        }
      } else {
        diffRows.push({
          label: "PAYLOAD UPDATE",
          previous: typeof prev === "string" ? prev : JSON.stringify(prev, null, 2),
          next: typeof nxt === "string" ? nxt : JSON.stringify(nxt, null, 2),
        });
      }
    } else {
      // General key-value dictionary in details
      for (const [k, v] of Object.entries(detailsJson)) {
        const isNested = Boolean(v && typeof v === "object");
        diffRows.push({
          label: formatLabel(k),
          previous: "—",
          next: isNested ? null : formatValue(k, v),
          isNestedJson: isNested,
          nextJson: isNested ? v : null,
        });
      }
    }
  }

  // Full raw payload object for complete transparency and deep inspection
  const fullRawPayload = {
    id: auditItem.id,
    action: auditItem.action,
    actorType: auditItem.actorType,
    actorName: auditItem.actorName || auditItem.userName || null,
    actorEmail: auditItem.userEmail || null,
    timestamp: auditItem.timestamp,
    requestId: requestId,
    resourceType: auditItem.resourceType || null,
    resourceId: auditItem.resourceId || null,
    oldValue: oldJson || auditItem.oldValue,
    newValue: newJson || auditItem.newValue,
    details: detailsJson || auditItem.details,
    note: auditItem.note || null,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#0c0c0c] border border-slate-300 dark:border-[#262626] rounded-sm shadow-2xl overflow-hidden font-sans text-slate-900 dark:text-[#f0f0f0] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#222] bg-slate-50 dark:bg-[#121212]">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase block">
              AUDIT RECORD INSPECTOR
            </span>
            <h2 id="audit-modal-title" className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">
              AUDIT PAYLOAD DETAILS
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white rounded hover:bg-slate-200/50 dark:hover:bg-[#222] transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body: Scrollable Internally */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Metadata Section */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222] rounded-xs font-mono">
            <div>
              <span className="text-[10px] uppercase text-slate-500 dark:text-[#777] font-bold block">
                Action
              </span>
              <span className="font-bold text-blue-700 dark:text-blue-400 break-words">
                {auditItem.action}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-500 dark:text-[#777] font-bold block">
                Actor
              </span>
              <span className="font-bold text-slate-900 dark:text-white break-words">
                {actorLabel}
                {auditItem.actorName && auditItem.actorName !== actorLabel ? (
                  <span className="text-[10px] font-normal text-slate-500 dark:text-[#888] block">
                    {auditItem.actorName}
                  </span>
                ) : null}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-500 dark:text-[#777] font-bold block">
                Timestamp
              </span>
              <span className="text-slate-800 dark:text-[#ccc] text-[11px] break-words">
                {formatDateTime(auditItem.timestamp, true)}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-500 dark:text-[#777] font-bold block">
                Request ID
              </span>
              <span className="text-slate-800 dark:text-[#ccc] font-bold break-all text-[11px]">
                {requestId}
              </span>
            </div>
          </div>

          {/* Structured Diff / Change Data Section */}
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2.5 border-b border-slate-200 dark:border-[#222]">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-[#aaa]">
                CHANGE DATA / PAYLOAD
              </span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-[#666]">
                {diffRows.length} field{diffRows.length === 1 ? "" : "s"} recorded
              </span>
            </div>

            {diffRows.length > 0 ? (
              <div className="space-y-3 font-mono">
                {diffRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-xs space-y-1.5"
                  >
                    <div className="font-bold text-[11px] text-slate-900 dark:text-white uppercase tracking-wide">
                      {row.label}
                    </div>

                    {row.isNestedJson ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        {row.previousJson !== null && row.previousJson !== undefined && (
                          <div>
                            <span className="text-slate-400 dark:text-[#666] text-[10px] uppercase block mb-1">
                              Previous:
                            </span>
                            <pre className="p-2 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#292929] rounded text-[10px] text-slate-600 dark:text-[#aaa] overflow-x-auto max-h-40 overflow-y-auto">
                              {JSON.stringify(row.previousJson, null, 2)}
                            </pre>
                          </div>
                        )}
                        {row.nextJson !== null && row.nextJson !== undefined && (
                          <div>
                            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold block mb-1">
                              New:
                            </span>
                            <pre className="p-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded text-[10px] text-emerald-900 dark:text-emerald-300 overflow-x-auto max-h-40 overflow-y-auto font-bold">
                              {JSON.stringify(row.nextJson, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 text-xs">
                        {row.previous && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-slate-400 dark:text-[#666] font-mono text-[10px] uppercase w-16 shrink-0">
                              Previous:
                            </span>
                            <span className="text-slate-600 dark:text-[#999] break-words">
                              {row.previous}
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline gap-2">
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px] uppercase font-bold w-16 shrink-0">
                            New:
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white break-words">
                            {row.next || "—"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-xs text-slate-500 font-mono text-center">
                No individual field diff recorded. See details below.
              </div>
            )}
          </div>

          {/* Details / Narrative if available */}
          {auditItem.details && !detailsJson && (
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase text-slate-500 dark:text-[#777] font-bold block">
                Details Summary
              </span>
              <p className="p-2.5 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222] rounded-xs text-slate-700 dark:text-[#bbb] break-words">
                {auditItem.details}
              </p>
            </div>
          )}

          {/* Note if available */}
          {auditItem.note && (
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-bold block">
                NOTE
              </span>
              <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 border-l-2 border-emerald-600 dark:border-emerald-400 text-emerald-900 dark:text-emerald-200 rounded-r-xs font-mono break-words">
                {auditItem.note}
              </div>
            </div>
          )}

          {/* Complete Raw Payload / JSON Inspector */}
          <div className="pt-2 border-t border-slate-200 dark:border-[#222]">
            <details className="group">
              <summary className="cursor-pointer select-none font-mono text-[11px] font-bold text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-white flex items-center justify-between">
                <span>COMPLETE PAYLOAD (RAW JSON)</span>
                <span className="text-[10px] font-normal text-slate-400 group-open:rotate-90 transition-transform">
                  ▶
                </span>
              </summary>
              <div className="mt-2">
                <pre className="p-3 bg-slate-100 dark:bg-[#080808] border border-slate-200 dark:border-[#222] rounded text-[10px] font-mono text-slate-700 dark:text-[#aaa] overflow-x-auto max-h-56 overflow-y-auto whitespace-pre-wrap sm:whitespace-pre break-all sm:break-normal">
                  {JSON.stringify(fullRawPayload, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        </div>

        {/* Modal Footer: Clear Close Button */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#222] bg-slate-50 dark:bg-[#121212] flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400 dark:text-[#666]">
            Immutable telemetry record
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 rounded cursor-pointer transition-colors shadow-xs"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
