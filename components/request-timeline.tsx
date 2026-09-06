"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format-date";

export interface ActivityItem {
  id: string;
  dispatchId: string;
  timestamp: string;
  actorType: "DISPATCHER" | "HOSPITAL" | "SYSTEM";
  actorName: string | null;
  action: string;
  details: string | null;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
}

interface RequestTimelineProps {
  dispatchId: string;
  refreshTrigger?: any;
}

export function RequestTimeline({ dispatchId, refreshTrigger }: RequestTimelineProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isArchived, setIsArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = async () => {
    try {
      const res = await fetch(`/api/dispatch-requests/${dispatchId}/timeline`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
        setIsArchived(!data.isVisible);
        setError(null);
      }
    } catch (err: any) {
      setError("Failed to load request timeline.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dispatchId) {
      fetchTimeline();
      const interval = setInterval(fetchTimeline, 5000);
      return () => clearInterval(interval);
    }
  }, [dispatchId, refreshTrigger]);

  if (isArchived) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-xs text-xs font-mono text-slate-500 dark:text-[#777]">
        Activity log retention window expired. Telemetry archived.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-xs p-4 sm:p-6 font-sans">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-[#222222]">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400 block">
            SHARED AUDIT LOG & TELEMETRY
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-[#ededed]">
            REQUEST ACTIVITY TIMELINE
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400 dark:text-[#666]">
          Live Synchronization
        </span>
      </div>

      {loading && activities.length === 0 ? (
        <div className="py-6 text-center text-xs font-mono text-slate-500 dark:text-[#777]">
          SYNCING ACTIVITY LOG...
        </div>
      ) : activities.length === 0 ? (
        <div className="py-6 text-center text-xs font-mono text-slate-500 dark:text-[#777]">
          No recorded activity yet for this request.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-[#222]">
          {activities.map((act) => {
            const timeStr = new Date(act.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });

            const isHospital = act.actorType === "HOSPITAL";
            const isReview = act.action === "HOSPITAL_REVIEWED";
            const isCritical = act.action === "CONDITION_CHANGED" || act.action === "BEDS_INCREASED";

            return (
              <div key={act.id} className="relative group text-xs font-mono">
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-[#0f0f0f] ${
                    isHospital
                      ? "border-emerald-600 dark:border-emerald-400"
                      : isCritical
                      ? "border-amber-600 dark:border-amber-400"
                      : "border-blue-600 dark:border-blue-400"
                  }`}
                />

                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-bold text-slate-900 dark:text-[#ededed]">{timeStr}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-xs uppercase ${
                      isHospital
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400"
                        : "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400"
                    }`}
                  >
                    {act.actorName || act.actorType}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-[#ccc]">
                    {act.action.replace(/_/g, " ")}
                  </span>
                </div>

                {act.details && (
                  <p className="text-slate-600 dark:text-[#999] mt-0.5 break-words font-sans text-xs">
                    {act.details}
                  </p>
                )}

                {act.oldValue && act.newValue && (
                  <div className="text-[11px] text-slate-500 dark:text-[#777] mt-0.5">
                    {act.oldValue} → <span className="font-bold text-slate-800 dark:text-[#ccc]">{act.newValue}</span>
                  </div>
                )}

                {act.note && (
                  <div className="mt-1 p-2 bg-slate-50 dark:bg-[#161616] border-l-2 border-emerald-600 dark:border-emerald-400 text-[11px] text-slate-800 dark:text-[#ddd] rounded-r-xs font-sans">
                    <span className="font-mono text-[10px] uppercase text-emerald-700 dark:text-emerald-400 font-bold block">
                      Note:
                    </span>
                    {act.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
