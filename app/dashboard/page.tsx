"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDate } from "@/lib/format-date";

interface BedCategory {
  id: string;
  categoryCode: string;
  name: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  lastUpdated: string;
}

interface DispatchRequest {
  id: string;
  ambulanceUnit: string;
  bedCategoryCode: string;
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
  status?: string;
}

export default function DashboardPage() {
  const { data: session, isPending } = authClient.useSession();
  const [hospitalData, setHospitalData] = useState<{
    hospital: Hospital | null;
    beds: BedCategory[];
    dispatches: DispatchRequest[];
  }>({ hospital: null, beds: [], dispatches: [] });

  const [loadingData, setLoadingData] = useState(true);
  const [editingCategory, setEditingCategory] = useState<BedCategory | null>(null);
  const [editAvailable, setEditAvailable] = useState<string | number>(0);
  const prevEditAvailableRef = useRef<number>(0);
  const [editTotal, setEditTotal] = useState<string | number>(0);
  const prevEditTotalRef = useRef<number>(0);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchTelemetry = async (silent = false) => {
    try {
      if (!silent) setLoadingData(true);
      const res = await fetch("/api/hospital");
      if (res.ok) {
        const data = await res.json();
        if (data.needsOnboarding) {
          window.location.href = "/hospital-setup";
          return;
        }
        setHospitalData(data);
      }

    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      if (!silent) setLoadingData(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchTelemetry();
      const interval = setInterval(() => {
        if (!editingCategory) {
          fetchTelemetry(true);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [session, editingCategory]);

  const handleOpenEdit = (category: BedCategory) => {
    setEditingCategory(category);
    setEditAvailable(category.availableBeds);
    prevEditAvailableRef.current = category.availableBeds;
    setEditTotal(category.totalBeds);
    prevEditTotalRef.current = category.totalBeds;
    setUpdateError(null);
  };

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    const finalAvailable =
      typeof editAvailable === "number"
        ? editAvailable
        : parseInt(editAvailable, 10) ?? prevEditAvailableRef.current ?? 0;
    const finalTotal =
      typeof editTotal === "number"
        ? editTotal
        : parseInt(editTotal, 10) ?? prevEditTotalRef.current ?? 0;

    try {
      setUpdating(true);
      setUpdateError(null);

      const res = await fetch("/api/hospital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: editingCategory.id,
          availableBeds: finalAvailable,
          totalBeds: finalTotal,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update availability");
      }

      setEditingCategory(null);
      await fetchTelemetry();
    } catch (err: any) {
      setUpdateError(err.message || "An error occurred");
    } finally {
      setUpdating(false);
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
            <span>INITIALIZING AUTHENTICATION SESSION...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
        {/* Top Status Header */}
        <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
            <span>AUTHENTICATION GATEWAY // RESTRICTED ACCESS</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Header */}
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
                  Hospital Staff Portal
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/dispatcher"
                className="text-xs font-mono text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                DISPATCHER CONSOLE →
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-xl mx-auto my-16 px-4">
          <div className="bg-white dark:bg-[#0a0a0a] p-8 border border-slate-200 dark:border-[#222222] rounded-sm shadow-sm">
            <div className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-[#181818] border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#a1a1a1] font-mono text-xs font-semibold mb-4 rounded-sm">
              RESTRICTED ACCESS
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#ededed]">Hospital Staff Portal</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-[#888888]">
              Please authenticate with your official hospital staff credentials to access the bed availability control console.
            </p>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-[#222222]">
              <button
                onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-[#ededed] dark:hover:bg-white text-white dark:text-black font-semibold text-sm rounded-sm transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign In with Google Staff Account
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { hospital, beds, dispatches } = hospitalData;

  const totalCapacity = beds.reduce((acc, item) => acc + item.totalBeds, 0);
  const totalAvailable = beds.reduce((acc, item) => acc + item.availableBeds, 0);
  const totalOccupied = beds.reduce((acc, item) => acc + item.occupiedBeds, 0);
  const occupancyPercent = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* System Status Top Header */}
      <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>LIVE TELEMETRY FEED: ONLINE</span>
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

      {/* Navigation Header */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm">
                BR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] tracking-tight leading-none font-mono">
                  BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                  Hospital Control Console
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-2 font-mono text-xs">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold rounded-sm"
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
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors"
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


            <button
              onClick={() => fetchTelemetry()}
              className="px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-[#ededed] border border-slate-300 dark:border-[#2a2a2a] hover:bg-slate-50 dark:hover:bg-[#141414] rounded-sm transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      {hospital?.status === "DEACTIVATED" && (
        <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 px-4 py-3 text-center text-xs font-mono text-red-700 dark:text-red-300 font-bold flex items-center justify-center gap-2">
          <span>⚠️ FACILITY DEACTIVATED BY NATIONAL SUPERADMIN</span>
          <span>•</span>
          <span>This hospital is temporarily hidden from dispatcher routing. Bed updates are disabled.</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hospital Info & Status Summary Header */}
        <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 text-xs font-mono font-semibold rounded-sm">
                  VERIFIED FACILITY
                </span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#181818] text-slate-700 dark:text-[#a1a1a1] text-xs font-mono font-semibold border border-slate-300 dark:border-[#2a2a2a] rounded-sm">
                  {hospital?.city || "New Delhi"}, {hospital?.state || "Delhi"}
                </span>
                <span className="text-xs text-slate-500 dark:text-[#737373] font-mono">{hospital?.name || "Hospital"} • {hospital?.id}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">
                {hospital?.name || "Regional Emergency Hospital"}
              </h1>
              <p className="text-sm text-slate-600 dark:text-[#888888] mt-0.5">
                {hospital?.address || "Sector 14, Dwarka"} • Tel: {hospital?.phone || "+91 11 2671 0000"}
              </p>
            </div>

            <div className="flex items-center gap-6 pt-4 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-[#222222]">
              <div className="text-right">
                <div className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Overall Occupancy</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-[#ededed] font-mono mt-0.5">{occupancyPercent}%</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Total Available Beds</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 font-mono mt-0.5">{totalAvailable} / {totalCapacity}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Capacity Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-[#0f0f0f] p-4 border border-slate-200 dark:border-[#222222] rounded-sm">
            <div className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Total Tracked Beds</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-[#ededed] font-mono mt-1">{totalCapacity}</div>
            <div className="text-xs text-slate-500 dark:text-[#737373] mt-1 font-mono">Capacity across 3 units</div>
          </div>

          <div className="bg-white dark:bg-[#0f0f0f] p-4 border border-slate-200 dark:border-[#222222] rounded-sm border-l-4 border-l-emerald-600">
            <div className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Available Beds</div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-1">{totalAvailable}</div>
            <div className="text-xs text-slate-500 dark:text-[#737373] mt-1 font-mono">Immediate placement capacity</div>
          </div>

          <div className="bg-white dark:bg-[#0f0f0f] p-4 border border-slate-200 dark:border-[#222222] rounded-sm border-l-4 border-l-amber-500">
            <div className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Occupied Beds</div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 font-mono mt-1">{totalOccupied}</div>
            <div className="text-xs text-slate-500 dark:text-[#737373] mt-1 font-mono">Currently admitted</div>
          </div>

          <div className="bg-white dark:bg-[#0f0f0f] p-4 border border-slate-200 dark:border-[#222222] rounded-sm border-l-4 border-l-blue-600">
            <div className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Active Dispatch Alerts</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 font-mono mt-1">{dispatches.length}</div>
            <div className="text-xs text-slate-500 dark:text-[#737373] mt-1 font-mono">Inbound ambulances</div>
          </div>
        </div>

        {/* Main Bed Availability Table */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#222222] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Bed Categories Availability Telemetry</h2>
              <p className="text-xs text-slate-500 dark:text-[#737373] font-mono mt-0.5">
                Real-time unit capacity broadcasted to regional ambulance dispatchers
              </p>
            </div>
          </div>

          {loadingData ? (
            <div className="p-8 text-center text-sm font-mono text-slate-500 dark:text-[#737373]">FETCHING REAL-TIME BED TELEMETRY...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-[#888888] font-mono text-xs uppercase border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3.5 px-6 font-semibold">Category Code</th>
                    <th className="py-3.5 px-6 font-semibold">Bed Category</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Total Beds</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Available Beds</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Occupied Beds</th>
                    <th className="py-3.5 px-6 font-semibold">Last Updated</th>
                    <th className="py-3.5 px-6 font-semibold text-center">Operational Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f] bg-white dark:bg-[#0f0f0f]">
                  {beds.map((bed) => {
                    return (
                      <tr key={bed.id} className="hover:bg-slate-50 dark:hover:bg-[#141414] transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-[#ededed]">{bed.categoryCode}</td>
                        <td className="py-4 px-6 font-semibold text-slate-900 dark:text-[#ededed]">{bed.name}</td>
                        <td className="py-4 px-6 font-mono text-right text-slate-900 dark:text-[#ededed] font-semibold">{bed.totalBeds}</td>
                        <td className="py-4 px-6 font-mono text-right font-bold text-emerald-700 dark:text-emerald-400">{bed.availableBeds}</td>
                        <td className="py-4 px-6 font-mono text-right text-slate-600 dark:text-[#a1a1a1]">{bed.occupiedBeds}</td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500 dark:text-[#737373]">
                          <div>{formatDate(bed.lastUpdated)}</div>
                          <div className="text-[10px] text-slate-400">{new Date(bed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => handleOpenEdit(bed)}
                            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-colors cursor-pointer"
                          >
                            Update Availability
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Incoming Dispatch Requests Section */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#222222] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Recent Inbound Dispatch Requests</h2>
              <p className="text-xs text-slate-500 dark:text-[#737373] font-mono mt-0.5">
                Pre-arrival notifications transmitted by approaching ambulance units
              </p>
            </div>
            <span className="px-2 py-1 bg-slate-100 dark:bg-[#181818] text-slate-700 dark:text-[#a1a1a1] text-xs font-mono border border-slate-300 dark:border-[#2a2a2a] rounded-sm">
              {dispatches.length} DISPATCHES LOGGED
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-[#888888] font-mono text-xs uppercase border-b border-slate-200 dark:border-[#222222]">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Request ID</th>
                  <th className="py-3.5 px-6 font-semibold">Ambulance Unit</th>
                  <th className="py-3.5 px-6 font-semibold">Bed Category</th>
                  <th className="py-3.5 px-6 font-semibold">Patient Condition</th>
                  <th className="py-3.5 px-6 font-semibold text-center">ETA</th>
                  <th className="py-3.5 px-6 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Received At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f] bg-white dark:bg-[#0f0f0f]">
                {dispatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 px-6 text-center text-xs font-mono text-slate-500 dark:text-[#737373]">
                      NO INBOUND DISPATCH REQUESTS CURRENTLY LOGGED
                    </td>
                  </tr>
                ) : (
                  dispatches.map((disp) => (
                    <tr key={disp.id} className="hover:bg-slate-50 dark:hover:bg-[#141414] transition-colors">
                      <td className="py-4 px-6 font-mono text-xs text-slate-600 dark:text-[#888888]">{disp.id}</td>
                      <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-[#ededed]">{disp.ambulanceUnit}</td>
                      <td className="py-4 px-6 font-mono text-xs font-semibold text-blue-800 dark:text-blue-400">
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 rounded-sm">
                          {disp.bedCategoryCode}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-700 dark:text-[#a1a1a1] font-medium">{disp.patientCondition}</td>
                      <td className="py-4 px-6 font-mono text-center font-bold text-slate-900 dark:text-[#ededed]">{disp.etaMinutes} mins</td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`px-2.5 py-1 text-xs font-mono font-bold border rounded-sm ${
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
                      <td className="py-4 px-6 font-mono text-xs text-right text-slate-500 dark:text-[#737373]">
                        <div>{formatDate(disp.createdAt)}</div>
                        <div className="text-[10px] text-slate-400">{new Date(disp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Action Modal for Updating Availability */}
      {editingCategory && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f0f0f] max-w-md w-full border border-slate-300 dark:border-[#2a2a2a] shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-semibold block">TELEMETRY UPDATE</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">{editingCategory.name}</h3>
              </div>
              <button
                onClick={() => setEditingCategory(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {updateError && (
              <div className="p-3 mb-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs font-mono rounded-sm">
                {updateError}
              </div>
            )}

            <form onSubmit={handleSaveUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">
                  Available Beds (Ready for Admission)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editAvailable}
                  onFocus={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val >= 0) prevEditAvailableRef.current = val;
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setEditAvailable("");
                      return;
                    }
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      setEditAvailable(val);
                      if (parsed >= 0) prevEditAvailableRef.current = parsed;
                    }
                  }}
                  onBlur={() => {
                    if (editAvailable === "" || isNaN(Number(editAvailable)) || Number(editAvailable) < 0) {
                      setEditAvailable(prevEditAvailableRef.current ?? 0);
                    } else {
                      const parsed = Number(editAvailable);
                      setEditAvailable(parsed);
                      prevEditAvailableRef.current = parsed;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] font-mono text-sm focus:outline-none focus:border-slate-900 dark:focus:border-white rounded-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">
                  Total Managed Unit Beds
                </label>
                <input
                  type="number"
                  min="1"
                  value={editTotal}
                  onFocus={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val >= 1) prevEditTotalRef.current = val;
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setEditTotal("");
                      return;
                    }
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      setEditTotal(val);
                      if (parsed >= 1) prevEditTotalRef.current = parsed;
                    }
                  }}
                  onBlur={() => {
                    if (editTotal === "" || isNaN(Number(editTotal)) || Number(editTotal) < 1) {
                      setEditTotal(prevEditTotalRef.current || 1);
                    } else {
                      const parsed = Number(editTotal);
                      setEditTotal(parsed);
                      prevEditTotalRef.current = parsed;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] font-mono text-sm focus:outline-none focus:border-slate-900 dark:focus:border-white rounded-sm"
                  required
                />
              </div>

              <div className="pt-2 text-xs font-mono text-slate-500 dark:text-[#737373]">
                Calculated Occupied: <span className="font-bold text-slate-900 dark:text-[#ededed]">{Math.max(0, (typeof editTotal === "number" ? editTotal : (parseInt(editTotal, 10) || 0)) - (typeof editAvailable === "number" ? editAvailable : (parseInt(editAvailable, 10) || 0)))}</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#222222]">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 text-xs font-semibold uppercase text-slate-600 dark:text-[#a1a1a1] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {updating ? "Publishing..." : "Broadcast Capacity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

