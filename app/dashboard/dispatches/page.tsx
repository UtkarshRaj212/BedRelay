"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDate } from "@/lib/format-date";

interface DispatchRequest {
  id: string;
  ambulanceUnit: string;
  bedCategoryCode: string;
  requestedBeds: number;
  etaMinutes: number;
  patientCondition: string;
  status: string;
  createdAt: string;
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
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDispatches = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/hospital/dispatches");
      if (res.ok) {
        const data = await res.json();
        setHospital(data.hospital);
        setDispatches(data.dispatches || []);
      }
    } catch (err) {
      console.error("Failed to load dispatch requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchDispatches();
    }
  }, [session]);

  const handleUpdateStatus = async (requestId: string, newStatus: "ACCEPTED" | "REJECTED") => {
    try {
      setUpdatingId(requestId);
      setFeedbackMsg(null);

      const res = await fetch("/api/hospital/dispatches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status: newStatus }),
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
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased flex flex-col transition-colors duration-150">
        <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 inline-block animate-pulse"></span>
            <span>BEDRELAY TELEMETRY SYSTEM</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center font-mono text-sm p-4">
          <div className="w-10 h-10 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm shadow-md animate-pulse mb-4">
            BR
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-[#888888]">
            <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-ping"></span>
            <span>VERIFYING AUTHENTICATION SESSION...</span>
          </div>
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
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>INBOUND DISPATCH CONTROL CONSOLE</span>
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
                Hospital Control Console
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-2 font-mono text-xs">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors"
              >
                OVERVIEW
              </Link>
              <Link
                href="/dashboard/beds"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors"
              >
                BED MANAGEMENT
              </Link>
              <Link
                href="/dashboard/dispatches"
                className="px-3 py-1.5 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold rounded-sm"
              >
                DISPATCH REQUESTS
              </Link>
              <Link
                href="/dashboard/staff"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors"
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
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 text-xs font-mono font-semibold rounded-sm">
                SCOPED AUTHENTICATED HOSPITAL
              </span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#181818] text-slate-700 dark:text-[#a1a1a1] text-xs font-mono font-semibold border border-slate-300 dark:border-[#2a2a2a] rounded-sm">
                {hospital?.city}, {hospital?.state || "India"}
              </span>
              <span className="text-xs text-slate-500 dark:text-[#737373] font-mono">{hospital?.name} • {hospital?.id}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">{hospital?.name || "Loading Hospital..."}</h1>
            <p className="text-xs text-slate-600 dark:text-[#888888] font-mono mt-0.5">
              {hospital?.address} • Tel: {hospital?.phone} • Review and manage inbound dispatch pre-arrival alerts.
            </p>
          </div>

          <button
            onClick={fetchDispatches}
            className="px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-[#ededed] border border-slate-300 dark:border-[#2a2a2a] hover:bg-slate-50 dark:hover:bg-[#141414] rounded-sm transition-colors cursor-pointer"
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
        <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-500 dark:text-[#737373] uppercase mr-2">Filter Status:</span>
            {["ALL", "PENDING", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                  statusFilter === st
                    ? "bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold"
                    : "bg-slate-100 dark:bg-[#181818] text-slate-700 dark:text-[#a1a1a1] hover:bg-slate-200 dark:hover:bg-[#242424]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="text-xs font-mono text-slate-500 dark:text-[#737373]">
            SHOWING <span className="font-bold text-slate-900 dark:text-[#ededed]">{filteredDispatches.length}</span> REQUESTS
          </div>
        </div>

        {/* Dispatch Requests Table */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#222222]">
            <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Inbound Ambulance Pre-Arrival Requests</h2>
            <p className="text-xs text-slate-500 dark:text-[#737373] font-mono mt-0.5">
              Strictly scoped to {hospital?.name || "your facility"}
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm font-mono text-slate-500 dark:text-[#737373]">LOADING DISPATCH REQUEST STREAM...</div>
          ) : (
            <div className="overflow-x-auto">
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
                        <td className="py-4 px-6 text-center font-mono text-xs font-bold">
                          <span
                            className={`px-2.5 py-1 rounded-sm border ${
                              disp.status === "ACCEPTED" || disp.status === "COMPLETED"
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                                : disp.status === "REJECTED" || disp.status === "CANCELLED"
                                ? "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800/60"
                                : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/60"
                            }`}
                          >
                            {disp.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {disp.status === "PENDING" ? (
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
          )}
        </div>
      </main>
    </div>
  );
}
