"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDate } from "@/lib/format-date";
import { HospitalReviewModal } from "@/components/hospital-review-modal";

interface DispatchRequest {
  id: string;
  ambulanceUnit: string;
  bedCategoryCode: string;
  requestedBeds: number;
  approvedBeds?: number | null;
  reviewRequired?: boolean;
  reviewReason?: string | null;
  rejectionReason?: string | null;
  etaMinutes: number;
  patientCondition: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
}

export default function HospitalDispatchesPage() {
  const { data: session, isPending } = authClient.useSession();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [dispatches, setDispatches] = useState<DispatchRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reviewDispatch, setReviewDispatch] = useState<DispatchRequest | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const isFetchingRef = useRef(false);

  const fetchDispatches = async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/hospital/dispatches", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setHospital(data.hospital);
        setDispatches(data.dispatches || []);
      }
    } catch (err) {
      console.error("Failed to load dispatch requests:", err);
    } finally {
      isFetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchDispatches();
      const interval = setInterval(() => fetchDispatches(true), 1000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const handleUpdateStatus = async (requestId: string, newStatus: "ACCEPTED" | "REJECTED") => {
    try {
      let rejectionReason: string | undefined = undefined;
      if (newStatus === "REJECTED") {
        const entered = prompt("Enter reason for rejecting this dispatch request:", "ICU capacity unavailable.");
        if (entered === null) return; // cancelled
        rejectionReason = entered.trim() || "ICU capacity unavailable.";
      }

      setUpdatingId(requestId);
      setFeedbackMsg(null);

      const res = await fetch("/api/hospital/dispatches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status: newStatus, rejectionReason }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      setFeedbackMsg({
        type: "success",
        text: `Dispatch request ${requestId} marked as ${newStatus}`,
      });

      await fetchDispatches();
    } catch (err: any) {
      setFeedbackMsg({
        type: "error",
        text: err.message || "Failed to update dispatch request",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased flex flex-col items-center justify-center font-mono text-sm p-4 transition-colors duration-150">
        <div className="w-10 h-10 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm shadow-md mb-4">
          BR
        </div>
        <div className="text-xs text-slate-600 dark:text-[#888888]">
          Loading dispatch console...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
        <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
            <span>AUTHENTICATION GATEWAY // RESTRICTED ACCESS</span>
          </div>
          <ThemeToggle />
        </div>

        <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm">
                BR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] font-mono tracking-tight">
                  BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                  Hospital Dispatch Management
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-xs font-mono text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                STAFF PORTAL →
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-xl mx-auto my-16 px-4">
          <div className="bg-white dark:bg-[#0a0a0a] p-8 border border-slate-200 dark:border-[#222222] rounded-sm shadow-sm">
            <div className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-[#181818] border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#a1a1a1] font-mono text-xs font-semibold mb-4 rounded-sm">
              AUTH REQUIRED
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#ededed]">Hospital Staff Access Only</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-[#888888]">
              You must be logged in with an authorized hospital staff account to manage dispatch requests.
            </p>
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-[#222222]">
              <Link
                href="/dashboard"
                className="w-full flex items-center justify-center px-4 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-[#ededed] dark:hover:bg-white text-white dark:text-black font-semibold text-sm rounded-sm transition-colors"
              >
                Go to Staff Portal
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const filteredDispatches = statusFilter === "ALL"
    ? dispatches
    : dispatches.filter((d) => d.status.toUpperCase() === statusFilter);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* Top Status Header */}
      <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span>INBOUND DISPATCH CONSOLE</span>
          <span className="text-slate-500 dark:text-[#555]">|</span>
          <span className="text-slate-300 dark:text-[#a1a1a1]">STAFF: {session.user.email}</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button
            onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
            className="text-slate-400 hover:text-white transition-colors underline font-mono text-[11px]"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Header & Nav Tabs */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2.5 sm:py-0 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm">
              BR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] font-mono tracking-tight">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                Hospital Control Console
              </span>
            </div>
          </Link>

          <div className="w-full sm:w-auto overflow-x-auto no-scrollbar scroll-smooth">
            <nav className="flex items-center gap-2 font-mono text-xs py-1">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors whitespace-nowrap shrink-0"
              >
                OVERVIEW
              </Link>
              <Link
                href="/dashboard/beds"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors whitespace-nowrap shrink-0"
              >
                BED MANAGEMENT
              </Link>
              <Link
                href="/dashboard/dispatches"
                className="px-3 py-1.5 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold rounded-sm whitespace-nowrap shrink-0"
              >
                DISPATCH REQUESTS
              </Link>
              <Link
                href="/dashboard/staff"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors whitespace-nowrap shrink-0"
              >
                STAFF MANAGEMENT
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hospital Header Banner */}
        <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 text-xs font-mono font-semibold rounded-sm">
                SCOPED AUTHENTICATED HOSPITAL
              </span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#181818] text-slate-700 dark:text-[#a1a1a1] text-xs font-mono font-semibold border border-slate-300 dark:border-[#2a2a2a] rounded-sm">
                {hospital?.city}, {hospital?.state || "India"}
              </span>
              <span className="text-xs text-slate-500 dark:text-[#737373] font-mono break-all">{hospital?.name} • {hospital?.id}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">{hospital?.name || "Loading Hospital..."}</h1>
            <p className="text-xs text-slate-600 dark:text-[#888888] font-mono mt-0.5 break-words">
              <span>{hospital?.address}</span> • <span className="inline-block whitespace-nowrap">Ph.: {hospital?.phone}</span> • Review and manage inbound dispatch pre-arrival alerts.
            </p>
          </div>

          <button
            onClick={() => fetchDispatches()}
            className="px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-[#ededed] border border-slate-300 dark:border-[#2a2a2a] hover:bg-slate-50 dark:hover:bg-[#141414] rounded-sm transition-colors cursor-pointer shrink-0"
          >
            Refresh Dispatch Stream
          </button>
        </div>

        {feedbackMsg && (
          <div
            className={`p-4 mb-6 text-xs font-mono rounded-sm flex items-center justify-between ${
              feedbackMsg.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-400"
                : "bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/60 text-red-800 dark:text-red-400"
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="font-bold cursor-pointer">✕</button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs overflow-x-auto no-scrollbar scroll-smooth w-full sm:w-auto pb-1 sm:pb-0">
            <span className="text-slate-500 dark:text-[#737373] uppercase mr-1 whitespace-nowrap shrink-0">Filter Status:</span>
            {["ALL", "PENDING", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? "bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold"
                    : "bg-slate-100 dark:bg-[#181818] text-slate-700 dark:text-[#a1a1a1] hover:bg-slate-200 dark:hover:bg-[#242424]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="text-xs font-mono text-slate-500 dark:text-[#737373] shrink-0">
            SHOWING <span className="font-bold text-slate-900 dark:text-[#ededed]">{filteredDispatches.length}</span> REQUESTS
          </div>
        </div>

        {/* Dispatch Requests Table / Cards */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-[#222222]">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#ededed]">Inbound Ambulance Pre-Arrival Requests</h2>
            <p className="text-xs text-slate-500 dark:text-[#737373] font-mono mt-0.5">
              Strictly scoped to {hospital?.name || "your facility"}
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm font-mono text-slate-500 dark:text-[#737373]">LOADING DISPATCH REQUEST STREAM...</div>
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="block md:hidden divide-y divide-slate-200 dark:divide-[#1f1f1f] bg-white dark:bg-[#0f0f0f]">
                {filteredDispatches.length === 0 ? (
                  <div className="py-8 px-4 text-center text-xs font-mono text-slate-500 dark:text-[#737373]">
                    NO DISPATCH REQUESTS LOGGED FOR THIS FILTER
                  </div>
                ) : (
                  filteredDispatches.map((disp) => (
                    <div key={disp.id} className="p-4 space-y-3 font-sans">
                      {/* Status & ID */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-mono font-medium border ${
                                disp.status === "ACCEPTED" || disp.status === "COMPLETED"
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                                  : disp.status === "REJECTED" || disp.status === "CANCELLED"
                                  ? "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800/60"
                                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/60"
                              }`}
                            >
                              {disp.status}
                            </span>
                            {disp.reviewRequired && (
                              <span className="inline-block px-2 py-0.5 rounded-sm text-[11px] font-mono font-medium border bg-amber-50 dark:bg-[#1a1708] text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60">
                                REVIEW REQUIRED
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-xs text-slate-600 dark:text-[#888888] mt-1.5 break-all font-semibold">
                            {disp.id}
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 dark:text-[#666] text-right shrink-0">
                          <div>{formatDate(disp.createdAt)}</div>
                          <div>{new Date(disp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>

                      {/* Ambulance Unit */}
                      <div>
                        <div className="font-bold text-slate-900 dark:text-[#ededed] text-sm font-mono">
                          {disp.ambulanceUnit}
                        </div>
                      </div>

                      {/* Requirement & ETA */}
                      <div className="bg-slate-50 dark:bg-[#141414] p-3 rounded-sm border border-slate-200 dark:border-[#222222] space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-slate-500 dark:text-[#777] uppercase text-[11px]">Requirement</span>
                          <span className="font-semibold text-blue-700 dark:text-blue-400 text-right">
                            {disp.bedCategoryCode} · {disp.requestedBeds || 1} bed{Number(disp.requestedBeds) > 1 ? "s" : ""}
                            {disp.approvedBeds !== undefined && disp.approvedBeds !== null && disp.approvedBeds < disp.requestedBeds && (
                              <span className="text-amber-600 dark:text-amber-400 font-normal ml-1">
                                ({disp.approvedBeds} appr)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-slate-500 dark:text-[#777] uppercase text-[11px]">ETA</span>
                          <span className="font-bold text-slate-900 dark:text-[#ededed] text-right">~{disp.etaMinutes} min</span>
                        </div>
                        {disp.reviewReason && (
                          <div className="pt-1.5 border-t border-slate-200 dark:border-[#222222] text-[11px] text-amber-800 dark:text-amber-400 font-sans">
                            <span className="font-mono font-bold text-[10px] uppercase">⚠️ Review Trigger: </span>
                            {disp.reviewReason}
                          </div>
                        )}
                        {disp.patientCondition && (
                          <div className="pt-1.5 border-t border-slate-200 dark:border-[#222222] text-[11px] text-slate-600 dark:text-[#999] font-sans">
                            <span className="font-mono text-slate-500 dark:text-[#777]">Condition: </span>
                            {disp.patientCondition}
                          </div>
                        )}
                      </div>

                      {/* Decision Actions */}
                      {disp.status === "PENDING" && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => handleUpdateStatus(disp.id, "ACCEPTED")}
                            disabled={updatingId === disp.id}
                            className="w-full py-2 px-3 text-xs font-semibold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 rounded-sm transition-colors disabled:opacity-50 cursor-pointer text-center"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(disp.id, "REJECTED")}
                            disabled={updatingId === disp.id}
                            className="w-full py-2 px-3 text-xs font-semibold uppercase tracking-wider text-white bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 rounded-sm transition-colors disabled:opacity-50 cursor-pointer text-center"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {disp.reviewRequired && (
                        <div className="pt-1">
                          <button
                            onClick={() => setReviewDispatch(disp)}
                            className="w-full py-2 px-3 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 dark:bg-[#1f1f1f] dark:hover:bg-[#282828] border border-slate-700 dark:border-[#3a3a3a] rounded-sm transition-colors cursor-pointer text-center"
                          >
                            Review Update
                          </button>
                        </div>
                      )}

                      <div>
                        <Link
                          href={`/dispatch-requests/${disp.id}`}
                          className="w-full inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] hover:border-slate-400 bg-slate-50 dark:bg-[#141414] rounded-sm transition-colors"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-[#888888] font-mono text-xs uppercase border-b border-slate-200 dark:border-[#222222]">
                    <tr>
                      <th className="py-3.5 px-6 font-semibold">Request ID</th>
                      <th className="py-3.5 px-6 font-semibold">Ambulance Unit</th>
                      <th className="py-3.5 px-6 font-semibold">Bed Category</th>
                      <th className="py-3.5 px-6 font-semibold text-center">Beds Requested</th>
                      <th className="py-3.5 px-6 font-semibold">Patient Clinical Condition</th>
                      <th className="py-3.5 px-6 font-semibold text-center">ETA</th>
                      <th className="py-3.5 px-6 font-semibold">Request Time</th>
                      <th className="py-3.5 px-6 font-semibold text-center">Status</th>
                      <th className="py-3.5 px-6 font-semibold text-center">Decision Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f] bg-white dark:bg-[#0f0f0f]">
                    {filteredDispatches.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 px-6 text-center text-xs font-mono text-slate-500 dark:text-[#737373]">
                          NO DISPATCH REQUESTS LOGGED FOR THIS FILTER
                        </td>
                      </tr>
                    ) : (
                      filteredDispatches.map((disp) => (
                        <tr key={disp.id} className="hover:bg-slate-50 dark:hover:bg-[#141414] transition-colors">
                          <td className="py-4 px-6 font-mono text-xs text-slate-600 dark:text-[#888888] font-semibold">{disp.id}</td>
                          <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-[#ededed]">{disp.ambulanceUnit}</td>
                          <td className="py-4 px-6 font-mono text-xs font-semibold">
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 rounded-sm">
                              {disp.bedCategoryCode}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-mono text-center font-bold text-slate-900 dark:text-[#ededed]">
                            {disp.requestedBeds || 1}
                          </td>
                          <td className="py-4 px-6 text-slate-800 dark:text-[#a1a1a1] font-medium max-w-xs">{disp.patientCondition}</td>
                          <td className="py-4 px-6 font-mono text-center font-bold text-slate-900 dark:text-[#ededed]">{disp.etaMinutes}m</td>
                          <td className="py-4 px-6 font-mono text-xs text-slate-500 dark:text-[#737373]">
                            <div>{formatDate(disp.createdAt)}</div>
                            <div className="text-[10px] text-slate-400">{new Date(disp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="inline-flex items-center justify-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2.5 py-1 rounded-sm border text-xs font-mono font-medium ${
                                  disp.status === "ACCEPTED" || disp.status === "COMPLETED"
                                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                                    : disp.status === "REJECTED" || disp.status === "CANCELLED"
                                    ? "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800/60"
                                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/60"
                                }`}
                              >
                                {disp.status}
                              </span>
                              {disp.reviewRequired && (
                                <span className="px-2 py-1 rounded-sm border bg-amber-50 dark:bg-[#1a1708] text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60 text-xs font-mono font-medium">
                                  REVIEW REQUIRED
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {disp.reviewRequired ? (
                              <button
                                onClick={() => setReviewDispatch(disp)}
                                className="px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 dark:bg-[#1f1f1f] dark:hover:bg-[#282828] border border-slate-700 dark:border-[#3a3a3a] rounded-sm transition-colors cursor-pointer"
                              >
                                Review Update
                              </button>
                            ) : disp.status === "PENDING" ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleUpdateStatus(disp.id, "ACCEPTED")}
                                  disabled={updatingId === disp.id}
                                  className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 rounded-sm transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(disp.id, "REJECTED")}
                                  disabled={updatingId === disp.id}
                                  className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 rounded-sm transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-mono text-slate-400 dark:text-[#666]">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Hospital Review Update Modal */}
      <HospitalReviewModal
        isOpen={Boolean(reviewDispatch)}
        onClose={() => setReviewDispatch(null)}
        dispatch={reviewDispatch}
        onSuccess={() => fetchDispatches(true)}
      />
    </div>
  );
}

