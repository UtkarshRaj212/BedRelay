"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string" && (parsed.startsWith("{") || parsed.startsWith("["))) {
      try {
        return JSON.parse(parsed);
      } catch {
        return parsed;
      }
    }
    return parsed;
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
    categorycode: "BED CATEGORY",
    category_code: "BED CATEGORY",
    totalbeds: "TOTAL BEDS",
    total_beds: "TOTAL BEDS",
    total: "TOTAL BEDS",
    availablebeds: "AVAILABLE BEDS",
    available_beds: "AVAILABLE BEDS",
    available: "AVAILABLE BEDS",
    occupiedbeds: "OCCUPIED BEDS",
    occupied_beds: "OCCUPIED BEDS",
    occupied: "OCCUPIED BEDS",
    eta: "ETA",
    etaminutes: "ETA",
    eta_minutes: "ETA",
    condition: "CONDITION",
    patientcondition: "CONDITION",
    patient_condition: "CONDITION",
    ambulance: "AMBULANCE ID",
    ambulanceid: "AMBULANCE ID",
    ambulance_id: "AMBULANCE ID",
    ambulanceunit: "AMBULANCE UNIT",
    ambulance_unit: "AMBULANCE UNIT",
    patientref: "PATIENT REFERENCE",
    patientreference: "PATIENT REFERENCE",
    patient_ref: "PATIENT REFERENCE",
    status: "STATUS",
    previousstatus: "PREVIOUS STATUS",
    newstatus: "NEW STATUS",
    reviewrequired: "REVIEW REQUIRED",
    reviewreason: "REVIEW REASON",
    rejectionreason: "REJECTION REASON",
    hospitalid: "HOSPITAL ID",
    hospital_id: "HOSPITAL ID",
    hospitalname: "HOSPITAL NAME",
    hospital_name: "HOSPITAL NAME",
    targetuserid: "TARGET USER ID",
    target_user_id: "TARGET USER ID",
    targetemail: "TARGET EMAIL",
    target_email: "TARGET EMAIL",
    assignedrole: "ASSIGNED ROLE",
    assigned_role: "ASSIGNED ROLE",
    revokedrole: "REVOKED ROLE",
    revoked_role: "REVOKED ROLE",
    role: "ROLE",
    code: "INVITATION CODE",
    invitecode: "INVITATION CODE",
    invite_code: "INVITATION CODE",
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
    const trimmed = val.trim();
    if (!trimmed) return "—";
    const lower = key.toLowerCase();
    if (lower.includes("eta") && !trimmed.includes("min") && !trimmed.includes("m") && !isNaN(Number(trimmed))) {
      return `${trimmed} min`;
    }
    return trimmed;
  }
  return JSON.stringify(val);
}

export function extractAuditDiffRows(auditItem: AuditPayloadItem): {
  activeDiffRows: DiffRow[];
  effectiveNote: string | null;
  narrative: string | null;
  fullRawPayload: any;
} {
  const requestId = auditItem.dispatchId || auditItem.requestId || auditItem.resourceId || "N/A";

  // Parse Old & New values
  const oldJson = tryParseJson(auditItem.oldValue);
  const newJson = tryParseJson(auditItem.newValue);
  const detailsJson = tryParseJson(auditItem.details);

  const effectiveNote =
    auditItem.note ||
    (detailsJson && typeof detailsJson === "object" && typeof detailsJson.note === "string"
      ? detailsJson.note
      : null);

  const narrative =
    (!detailsJson && auditItem.details) ||
    (detailsJson && typeof detailsJson === "object" && typeof detailsJson.details === "string"
      ? detailsJson.details
      : null) ||
    (detailsJson && typeof detailsJson === "object" && typeof detailsJson.message === "string"
      ? detailsJson.message
      : null) ||
    (detailsJson && typeof detailsJson === "object" && typeof detailsJson.description === "string"
      ? detailsJson.description
      : null);

  const diffRows: DiffRow[] = [];

  // 1. Both oldValue and newValue are structured JSON objects
  if (
    oldJson &&
    typeof oldJson === "object" &&
    !Array.isArray(oldJson) &&
    newJson &&
    typeof newJson === "object" &&
    !Array.isArray(newJson)
  ) {
    const allKeys = Array.from(new Set([...Object.keys(oldJson), ...Object.keys(newJson)]));
    for (const key of allKeys) {
      const oldVal = oldJson[key];
      const newVal = newJson[key];
      const isNested = Boolean((oldVal && typeof oldVal === "object") || (newVal && typeof newVal === "object"));
      diffRows.push({
        label: formatLabel(key),
        previous: isNested ? null : (oldVal !== undefined ? formatValue(key, oldVal) : "—"),
        next: isNested ? null : (newVal !== undefined ? formatValue(key, newVal) : "—"),
        isNestedJson: isNested,
        previousJson: isNested ? oldVal : null,
        nextJson: isNested ? newVal : null,
      });
    }
  } else {
    // 2. Direct oldValue or newValue provided as primitives/strings
    const hasDirectOld =
      auditItem.oldValue !== null &&
      auditItem.oldValue !== undefined &&
      String(auditItem.oldValue).trim() !== "";
    const hasDirectNew =
      auditItem.newValue !== null &&
      auditItem.newValue !== undefined &&
      String(auditItem.newValue).trim() !== "";

    if (hasDirectOld || hasDirectNew) {
      let label = "CHANGE DETAILS";
      const action = (auditItem.action || "").toUpperCase();

      if (action.includes("BEDS")) label = "REQUESTED BEDS";
      else if (action.includes("CATEGORY")) label = "BED CATEGORY";
      else if (action.includes("ETA")) label = "ETA";
      else if (action.includes("CONDITION")) label = "CONDITION";
      else if (action.includes("AMBULANCE")) label = "AMBULANCE ID";
      else if (action.includes("PATIENT_REF")) label = "PATIENT REFERENCE";
      else if (
        action.includes("STATUS") ||
        action.includes("ACCEPTED") ||
        action.includes("CANCELLED") ||
        action.includes("REJECTED") ||
        action.includes("COMPLETED") ||
        action.includes("PENDING")
      ) {
        label = "STATUS";
      }

      diffRows.push({
        label,
        previous: hasDirectOld ? formatValue(label, auditItem.oldValue) : "—",
        next: hasDirectNew ? formatValue(label, auditItem.newValue) : "—",
      });
    }

    // 3. Extract and parse detailsJson if available
    if (detailsJson && typeof detailsJson === "object" && !Array.isArray(detailsJson)) {
      const consumedKeys = new Set<string>();

      if (detailsJson.note && typeof detailsJson.note === "string") consumedKeys.add("note");
      if (detailsJson.details && typeof detailsJson.details === "string") consumedKeys.add("details");
      if (detailsJson.message && typeof detailsJson.message === "string") consumedKeys.add("message");
      if (detailsJson.description && typeof detailsJson.description === "string") consumedKeys.add("description");

      // Sub-case 3A: Explicit nested comparison objects like { previous: {...}, updated: {...} }
      const prevObj = detailsJson.previous ?? detailsJson.before ?? detailsJson.old ?? detailsJson.prev;
      const nextObj = detailsJson.updated ?? detailsJson.new ?? detailsJson.next ?? detailsJson.after ?? detailsJson.current;

      if (prevObj !== undefined || nextObj !== undefined) {
        for (const k of ["previous", "before", "old", "prev", "updated", "new", "next", "after", "current"]) {
          if (k in detailsJson) consumedKeys.add(k);
        }

        if (
          (prevObj && typeof prevObj === "object" && !Array.isArray(prevObj)) ||
          (nextObj && typeof nextObj === "object" && !Array.isArray(nextObj))
        ) {
          const p = (prevObj && typeof prevObj === "object" ? prevObj : {}) as Record<string, any>;
          const n = (nextObj && typeof nextObj === "object" ? nextObj : {}) as Record<string, any>;
          const allKeys = Array.from(new Set([...Object.keys(p), ...Object.keys(n)]));

          for (const k of allKeys) {
            const oldVal = p[k];
            const newVal = n[k];
            const isNested = Boolean((oldVal && typeof oldVal === "object") || (newVal && typeof newVal === "object"));
            diffRows.push({
              label: formatLabel(k),
              previous: isNested ? null : (oldVal !== undefined ? formatValue(k, oldVal) : "—"),
              next: isNested ? null : (newVal !== undefined ? formatValue(k, newVal) : "—"),
              isNestedJson: isNested,
              previousJson: isNested ? oldVal : null,
              nextJson: isNested ? newVal : null,
            });
          }
        } else {
          diffRows.push({
            label: "PAYLOAD UPDATE",
            previous: prevObj !== undefined ? (typeof prevObj === "string" ? prevObj : JSON.stringify(prevObj, null, 2)) : "—",
            next: nextObj !== undefined ? (typeof nextObj === "string" ? nextObj : JSON.stringify(nextObj, null, 2)) : "—",
          });
        }
      }

      // Sub-case 3B: Paired transition fields (e.g., previousStatus & newStatus)
      const pairPatterns = [
        {
          label: "STATUS",
          prevKeys: ["previousStatus", "prevStatus", "oldStatus", "fromStatus"],
          nextKeys: ["newStatus", "nextStatus", "toStatus"],
        },
        {
          label: "ROLE",
          prevKeys: ["previousRole", "prevRole", "oldRole", "revokedRole"],
          nextKeys: ["newRole", "nextRole", "assignedRole"],
        },
        {
          label: "STATE",
          prevKeys: ["previousState", "prevState", "oldState"],
          nextKeys: ["newState", "nextState"],
        },
        {
          label: "BED CAPACITY",
          prevKeys: ["previousCapacity", "oldCapacity"],
          nextKeys: ["newCapacity", "updatedCapacity"],
        },
        {
          label: "VALUE",
          prevKeys: ["previousValue", "prevValue", "oldValue"],
          nextKeys: ["newValue", "nextValue"],
        },
      ];

      for (const pattern of pairPatterns) {
        const foundPrevKey = pattern.prevKeys.find((k) => k in detailsJson);
        const foundNextKey = pattern.nextKeys.find((k) => k in detailsJson);

        if (foundPrevKey || foundNextKey) {
          const prevVal = foundPrevKey ? detailsJson[foundPrevKey] : undefined;
          const nextVal = foundNextKey ? detailsJson[foundNextKey] : undefined;

          if (foundPrevKey) consumedKeys.add(foundPrevKey);
          if (foundNextKey) consumedKeys.add(foundNextKey);

          diffRows.unshift({
            label: pattern.label,
            previous: prevVal !== undefined ? formatValue(pattern.label, prevVal) : "—",
            next: nextVal !== undefined ? formatValue(pattern.label, nextVal) : "—",
          });
        }
      }

      // Sub-case 3C: Any remaining contextual fields in detailsJson
      for (const [k, v] of Object.entries(detailsJson)) {
        if (consumedKeys.has(k)) continue;

        const isNested = Boolean(v && typeof v === "object");
        diffRows.push({
          label: formatLabel(k),
          previous: null,
          next: isNested ? null : formatValue(k, v),
          isNestedJson: isNested,
          previousJson: null,
          nextJson: isNested ? v : null,
        });
      }
    }
  }

  // Filter out any completely empty dummy diff rows (where previous is empty/dash and next is empty/dash)
  const activeDiffRows = diffRows.filter((r) => {
    if (r.isNestedJson) return true;
    const hasP = r.previous !== null && r.previous !== "—" && r.previous.trim() !== "";
    const hasN = r.next !== null && r.next !== "—" && r.next.trim() !== "";
    return hasP || hasN;
  });

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
    oldValue: oldJson || auditItem.oldValue || undefined,
    newValue: newJson || auditItem.newValue || undefined,
    details: detailsJson || auditItem.details,
    note: effectiveNote || null,
  };

  return { activeDiffRows, effectiveNote, narrative, fullRawPayload };
}

export function AuditPayloadModal({ isOpen, onClose, auditItem }: AuditPayloadModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || !isOpen || !auditItem) return null;

  const actorLabel = normalizeActor(auditItem);
  const requestId = auditItem.dispatchId || auditItem.requestId || auditItem.resourceId || "N/A";

  const { activeDiffRows, effectiveNote, narrative, fullRawPayload } = extractAuditDiffRows(auditItem);

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-[#0c0c0c] border border-slate-300 dark:border-[#262626] rounded-sm shadow-2xl overflow-hidden font-sans text-slate-900 dark:text-[#f0f0f0] animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-[#222] bg-slate-50 dark:bg-[#121212] shrink-0">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-mono font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase block truncate">
              AUDIT RECORD INSPECTOR
            </span>
            <h2 id="audit-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
              AUDIT PAYLOAD DETAILS
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white rounded hover:bg-slate-200/50 dark:hover:bg-[#222] transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body: Scrollable Internally */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Metadata Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 p-3 sm:p-3.5 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222] rounded-xs font-mono">
            <div>
              <span className="text-[10px] uppercase text-slate-500 dark:text-[#777] font-bold block">
                Action
              </span>
              <span className="font-bold text-blue-700 dark:text-blue-400 break-all">
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
                {activeDiffRows.length} field{activeDiffRows.length === 1 ? "" : "s"} recorded
              </span>
            </div>

            {activeDiffRows.length > 0 ? (
              <div className="space-y-3 font-mono">
                {activeDiffRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-xs space-y-1.5"
                  >
                    <div className="font-bold text-[11px] text-slate-900 dark:text-white uppercase tracking-wide">
                      {row.label}
                    </div>

                    {row.isNestedJson ? (
                      <div className={row.previousJson !== null && row.previousJson !== undefined ? "grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]" : "space-y-1 text-[11px]"}>
                        {row.previousJson !== null && row.previousJson !== undefined && (
                          <div>
                            <span className="text-slate-400 dark:text-[#666] text-[10px] uppercase block mb-1">
                              Previous:
                            </span>
                            <pre className="p-2 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#292929] rounded text-[10px] text-slate-600 dark:text-[#aaa] overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
                              {JSON.stringify(row.previousJson, null, 2)}
                            </pre>
                          </div>
                        )}
                        {row.nextJson !== null && row.nextJson !== undefined && (
                          <div>
                            <span className={`text-[10px] uppercase font-bold block mb-1 ${row.previousJson !== null && row.previousJson !== undefined ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-[#666]"}`}>
                              {row.previousJson !== null && row.previousJson !== undefined ? "New:" : "Payload Value:"}
                            </span>
                            <pre className={`p-2 rounded text-[10px] overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-all ${row.previousJson !== null && row.previousJson !== undefined ? "bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-300 font-bold" : "bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#292929] text-slate-800 dark:text-[#ccc]"}`}>
                              {JSON.stringify(row.nextJson, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 text-xs">
                        {row.previous !== null && row.previous !== undefined ? (
                          <>
                            <div className="flex items-baseline gap-2 flex-wrap sm:flex-nowrap">
                              <span className="text-slate-400 dark:text-[#666] font-mono text-[10px] uppercase w-16 shrink-0">
                                Previous:
                              </span>
                              <span className="text-slate-600 dark:text-[#999] break-all sm:break-words">
                                {row.previous}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-2 flex-wrap sm:flex-nowrap">
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px] uppercase font-bold w-16 shrink-0">
                                New:
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white break-all sm:break-words">
                                {row.next || "—"}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-baseline gap-2 flex-wrap sm:flex-nowrap">
                            <span className="text-slate-400 dark:text-[#666] font-mono text-[10px] uppercase w-16 shrink-0">
                              Value:
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white break-all sm:break-words">
                              {row.next || "—"}
                            </span>
                          </div>
                        )}
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
          {narrative && (
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase text-slate-500 dark:text-[#777] font-bold block">
                Details Summary
              </span>
              <p className="p-2.5 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222] rounded-xs text-slate-700 dark:text-[#bbb] break-all sm:break-words">
                {narrative}
              </p>
            </div>
          )}

          {/* Note if available */}
          {effectiveNote && (
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-bold block">
                NOTE
              </span>
              <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 border-l-2 border-emerald-600 dark:border-emerald-400 text-emerald-900 dark:text-emerald-200 rounded-r-xs font-mono break-all sm:break-words">
                {effectiveNote}
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
                <pre className="p-3 bg-slate-100 dark:bg-[#080808] border border-slate-200 dark:border-[#222] rounded text-[10px] font-mono text-slate-700 dark:text-[#aaa] overflow-x-auto max-h-56 overflow-y-auto whitespace-pre-wrap break-all sm:break-normal">
                  {JSON.stringify(fullRawPayload, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        </div>

        {/* Modal Footer: Clear Close Button */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-[#222] bg-slate-50 dark:bg-[#121212] flex items-center justify-between shrink-0">
          <span className="text-[10px] font-mono text-slate-400 dark:text-[#666] truncate mr-2">
            Immutable telemetry record
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 rounded cursor-pointer transition-colors shadow-xs shrink-0"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
