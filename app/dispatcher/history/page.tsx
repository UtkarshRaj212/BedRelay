"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { getDispatcherSessionId } from "@/lib/dispatcher-session";

interface DispatchHistoryItem {
  id: string;
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalCity: string;
  hospitalState: string;
  hospitalPhone: string;
  ambulanceUnit: string;
  bedCategoryCode: string;
  requestedBeds: number;
  etaMinutes: number;
  patientCondition: string;
  status: string;
  distanceKm: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function DispatcherHistoryPage() {
  const [dispatches, setDispatches] = useState<DispatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAllSessions, setShowAllSessions] = useState<boolean>(false);

  useEffect(() => {
    const currentSession = getDispatcherSessionId();
    setSessionId(currentSession);
  }, []);

  const fetchHistory = async () => {
    try {
      const currentSession = sessionId || getDispatcherSessionId();
      const params = new URLSearchParams();
      if (!showAllSessions && currentSession) {
        params.set("sessionId", currentSession);
      } else if (showAllSessions) {
        params.set("all", "true");
      }

      const res = await fetch(`/api/dispatch-requests?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDispatches(data.dispatches || []);
        setLastSynced(formatDateTime(new Date(), true));
      }
    } catch (err) {
      console.error("Failed to fetch dispatcher request history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // Non-intrusive 5s near-real-time polling
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [sessionId, showAllSessions]);

  const filteredDispatches = useMemo(() => {
    return dispatches.filter((disp) => {
      if (statusFilter !== "ALL" && disp.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      if (categoryFilter !== "ALL" && disp.bedCategoryCode.toUpperCase() !== categoryFilter.toUpperCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesId = disp.id.toLowerCase().includes(query);
        const matchesAmbulance = disp.ambulanceUnit.toLowerCase().includes(query);
        const matchesHospital = disp.hospitalName.toLowerCase().includes(query);
        const matchesCity = disp.hospitalCity.toLowerCase().includes(query);
        if (!matchesId && !matchesAmbulance && !matchesHospital && !matchesCity) {
          return false;
        }
      }
      return true;
    });
  }, [dispatches, statusFilter, categoryFilter, searchQuery]);

  const pendingCount = dispatches.filter((d) => d.status === "PENDING").length;
  const acceptedCount = dispatches.filter((d) => d.status === "ACCEPTED").length;
  const completedCount = dispatches.filter((d) => d.status === "COMPLETED").length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* System Status Top Bar */}
      <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
          <span>AMBULANCE DISPATCH TELEMETRY CONSOLE</span>
          <span className="text-slate-500 dark:text-[#555]">|</span>
          <span className="text-slate-400 dark:text-[#888888]">REQUEST HISTORY</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 dark:text-[#888888]">
          <span className="hidden sm:inline">
            Last updated: {lastSynced || "Connecting..."}
          </span>
          <span className="hidden sm:inline text-slate-600 dark:text-[#555]">|</span>
          <span className="text-slate-300 dark:text-[#a1a1a1]">
            SESSION: {sessionId ? `${sessionId.substring(0, 16)}...` : "ACTIVE"}
          </span>
          <ThemeToggle />
        </div>
      </div>

      {/* Header Navigation */}
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
                Ambulance Dispatcher Console
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3 font-mono text-xs">
            <Link
              href="/dispatcher"
              className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm transition-colors"
            >
              DISPATCHER DASHBOARD
            </Link>
            <Link
              href="/find-beds"
              className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm transition-colors"
            >
              FIND HOSPITAL
            </Link>
            <Link
              href="/dispatcher/history"
              className="px-3 py-1.5 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold rounded-sm"
            >
              REQUEST HISTORY
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Banner & Overview Stats */}
        <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#181818] border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#a1a1a1] text-xs font-mono font-semibold rounded-sm uppercase">
                {showAllSessions ? "System-Wide Dispatches" : "Current Session History"}
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-[#777]">
                ({filteredDispatches.length} requests)
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">
              Ambulance Dispatch Request History
            </h1>
            <p className="text-xs text-slate-600 dark:text-[#888888] font-mono mt-0.5">
              Live log of pre-arrival alerts transmitted from this ambulance dispatcher console.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAllSessions(!showAllSessions)}
              className={`px-3 py-1.5 text-xs font-mono font-semibold border rounded-sm transition-colors cursor-pointer ${
                showAllSessions
                  ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800/60 text-blue-700 dark:text-blue-400"
                  : "bg-white dark:bg-[#111111] border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400"
              }`}
            >
              {showAllSessions ? "Showing: All System Dispatches" : "Showing: My Session Only"}
            </button>
            <Link
              href="/find-beds"
              className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-colors"
            >
              + Create New Dispatch
            </Link>
          </div>
        </div>

        {/* Metric Quick Glance Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm">
            <span className="text-[11px] font-mono text-slate-500 dark:text-[#777] uppercase">Total In Log</span>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-[#ededed] mt-1">
              {dispatches.length}
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm">
            <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 uppercase">Pending Review</span>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              {pendingCount}
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm">
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 uppercase">Accepted / En Route</span>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {acceptedCount}
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm">
            <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 uppercase">Completed</span>
            <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {completedCount}
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm mb-6 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-slate-600 dark:text-[#888] uppercase">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#141414] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-slate-600 dark:text-[#888] uppercase">Bed Category:</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#141414] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="ICU">ICU</option>
                <option value="GENERAL">GENERAL</option>
                <option value="VENTILATOR">VENTILATOR</option>
                <option value="NICU">NICU</option>
                <option value="EMERGENCY">EMERGENCY</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search Request ID, Ambulance, Hospital..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-72 px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#141414] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
            />
            {(statusFilter !== "ALL" || categoryFilter !== "ALL" || searchQuery.trim() !== "") && (
              <button
                onClick={() => {
                  setStatusFilter("ALL");
                  setCategoryFilter("ALL");
                  setSearchQuery("");
                }}
                className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Request ID</th>
                  <th className="py-3.5 px-4 font-semibold">Ambulance ID</th>
                  <th className="py-3.5 px-4 font-semibold">Selected Hospital</th>
                  <th className="py-3.5 px-4 font-semibold">Required Category</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Beds</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Distance</th>
                  <th className="py-3.5 px-4 font-semibold">Created Time</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] font-mono">
                {loading && dispatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-[#777]">
                      Loading dispatch request telemetry from Neon...
                    </td>
                  </tr>
                ) : filteredDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-[#777]">
                      <div className="text-sm font-semibold mb-1">No dispatch requests found</div>
                      <p className="text-xs text-slate-400 dark:text-[#666] mb-4">
                        {showAllSessions
                          ? "No dispatch requests match the current filters."
                          : "No dispatch requests recorded in this browser session yet."}
                      </p>
                      <div className="flex justify-center gap-3">
                        <Link
                          href="/find-beds"
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-sm text-xs font-semibold"
                        >
                          Find Hospital with Beds →
                        </Link>
                        {!showAllSessions && (
                          <button
                            onClick={() => setShowAllSessions(true)}
                            className="px-3 py-1.5 border border-slate-300 dark:border-[#333] text-slate-700 dark:text-[#ccc] rounded-sm text-xs"
                          >
                            View All System Dispatches
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDispatches.map((disp) => (
                    <tr
                      key={disp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-[#ededed] whitespace-nowrap">
                        <Link
                          href={`/dispatch-requests/${disp.id}`}
                          className="hover:text-blue-600 dark:hover:text-blue-400 underline decoration-slate-300"
                        >
                          {disp.id}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 dark:text-[#ccc] font-medium whitespace-nowrap">
                        {disp.ambulanceUnit}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-[#bbb]">
                        <div className="font-semibold text-slate-900 dark:text-[#ededed]">
                          {disp.hospitalName}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-[#666]">
                          {disp.hospitalCity}
                          {disp.hospitalState ? `, ${disp.hospitalState}` : ""}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                          {disp.bedCategoryCode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-[#ededed]">
                        {disp.requestedBeds}
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-slate-600 dark:text-[#aaa] whitespace-nowrap">
                        {disp.distanceKm !== null ? `${disp.distanceKm.toFixed(1)} km` : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-[#777] whitespace-nowrap">
                        <div>{formatDate(disp.createdAt)}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#666]">
                          {new Date(disp.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-sm text-[10px] font-bold border ${
                            disp.status === "ACCEPTED"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                              : disp.status === "COMPLETED"
                              ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 border-blue-300 dark:border-blue-800/60"
                              : disp.status === "REJECTED"
                              ? "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800/60"
                              : disp.status === "CANCELLED"
                              ? "bg-slate-100 dark:bg-[#1a1a1a] text-slate-700 dark:text-[#999] border-slate-300 dark:border-[#333]"
                              : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/60"
                          }`}
                        >
                          {disp.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/dispatch-requests/${disp.id}`}
                          className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 dark:hover:border-[#444] transition-colors"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
