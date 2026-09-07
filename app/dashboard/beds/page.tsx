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

interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  status?: string;
}

export default function BedManagementPage() {
  const { data: session, isPending } = authClient.useSession();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [beds, setBeds] = useState<BedCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingCategory, setEditingCategory] = useState<BedCategory | null>(null);
  const [editAvailable, setEditAvailable] = useState<string | number>(0);
  const prevEditAvailableRef = useRef<number>(0);
  const [editTotal, setEditTotal] = useState<string | number>(0);
  const prevEditTotalRef = useRef<number>(0);
  const [updating, setUpdating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isFetchingRef = useRef(false);

  const fetchBeds = async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/hospital/beds", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHospital(data.hospital);
        setBeds(data.beds || []);
      }
    } catch (err) {
      console.error("Failed to load hospital beds:", err);
    } finally {
      isFetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchBeds();
      const interval = setInterval(() => {
        if (!editingCategory) {
          fetchBeds(true);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [session, editingCategory]);

  const handleOpenModal = (bed: BedCategory) => {
    setEditingCategory(bed);
    setEditAvailable(bed.availableBeds);
    prevEditAvailableRef.current = bed.availableBeds;
    setEditTotal(bed.totalBeds);
    prevEditTotalRef.current = bed.totalBeds;
    setValidationError(null);
    setSuccessMsg(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
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

    // Client-side Validation Checks
    if (finalAvailable < 0) {
      setValidationError("Available beds cannot be negative.");
      return;
    }
    if (finalTotal < 0) {
      setValidationError("Total capacity cannot be negative.");
      return;
    }
    if (finalAvailable > finalTotal) {
      setValidationError("Available beds cannot exceed total capacity.");
      return;
    }

    try {
      setUpdating(true);
      setValidationError(null);

      const res = await fetch("/api/hospital/beds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: editingCategory.id,
          availableBeds: finalAvailable,
          totalBeds: finalTotal,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update bed capacity");
      }

      setSuccessMsg(`Successfully updated capacity for ${editingCategory.name}`);
      setEditingCategory(null);
      await fetchBeds();
    } catch (err: any) {
      setValidationError(err.message || "An error occurred while updating.");
    } finally {
      setUpdating(false);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased flex flex-col items-center justify-center font-mono text-sm p-4 transition-colors duration-150">
        <div className="w-10 h-10 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm shadow-md mb-4">
          BR
        </div>
        <div className="text-xs text-slate-600 dark:text-[#888888]">
          Loading bed management...
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
          <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm">
                BR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] font-mono tracking-tight">
                  BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                  Hospital Bed Management
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
              You must be logged in with an authorized hospital staff account to manage live bed capacity.
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* Top Status Header */}
      <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-2 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">BED MANAGEMENT</span>
          <span className="text-slate-500 dark:text-[#555] hidden sm:inline">|</span>
          <span className="text-slate-300 dark:text-[#a1a1a1] break-all">STAFF: {session.user.email}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
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
        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 min-h-16 py-2.5 sm:py-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm shrink-0">
              BR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] font-mono tracking-tight leading-tight">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase">
                Hospital Control Console
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-6 w-full md:w-auto">
            <nav className="flex items-center gap-2 font-mono text-xs overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap py-1 w-full md:w-auto">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors shrink-0"
              >
                OVERVIEW
              </Link>
              <Link
                href="/dashboard/beds"
                className="px-3 py-1.5 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold rounded-sm shrink-0"
              >
                BED MANAGEMENT
              </Link>
              <Link
                href="/dashboard/dispatches"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors shrink-0"
              >
                DISPATCH REQUESTS
              </Link>
              <Link
                href="/dashboard/staff"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors shrink-0"
              >
                STAFF MANAGEMENT
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {hospital?.status === "DEACTIVATED" && (
        <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 px-4 py-3 text-center text-xs font-mono text-red-700 dark:text-red-300 font-bold flex flex-wrap items-center justify-center gap-2">
          <span>⚠️ FACILITY DEACTIVATED BY NATIONAL SUPERADMIN</span>
          <span className="hidden sm:inline">•</span>
          <span>This hospital is temporarily hidden from dispatcher routing. Bed updates are disabled.</span>
        </div>
      )}

      <main className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-8">
        {/* Hospital Header Banner */}
        <div className="bg-white dark:bg-[#0f0f0f] p-4 sm:p-6 border border-slate-200 dark:border-[#222222] rounded-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="w-full md:w-auto">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 text-[11px] font-mono font-semibold rounded-sm">
                SCOPED AUTHENTICATED HOSPITAL
              </span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#181818] text-slate-700 dark:text-[#a1a1a1] text-[11px] font-mono font-semibold border border-slate-300 dark:border-[#2a2a2a] rounded-sm">
                {hospital?.city}, {hospital?.state || "India"}
              </span>
              <span className="text-xs text-slate-500 dark:text-[#737373] font-mono break-all">{hospital?.name} • {hospital?.id}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">{hospital?.name || "Loading Hospital..."}</h1>
            <p className="text-xs text-slate-600 dark:text-[#888888] font-mono mt-0.5 break-words">
              {hospital?.address} • Tel: {hospital?.phone} • Updates broadcast immediately to regional dispatchers.
            </p>
          </div>

          <button
            onClick={() => fetchBeds()}
            className="w-full md:w-auto px-4 py-2 text-xs font-mono text-slate-700 dark:text-[#ededed] border border-slate-300 dark:border-[#2a2a2a] hover:bg-slate-50 dark:hover:bg-[#141414] rounded-sm transition-colors cursor-pointer text-center shrink-0"
          >
            Refresh Telemetry Data
          </button>
        </div>

        {successMsg && (
          <div className="p-4 mb-6 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-400 text-xs font-mono rounded-sm flex items-center justify-between gap-2">
            <span className="break-words">✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-900 dark:text-emerald-300 font-bold cursor-pointer shrink-0">✕</button>
          </div>
        )}

        {/* Main Bed Categories Table */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-[#222222]">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#ededed]">Bed Categories & Capacity</h2>
            <p className="text-xs text-slate-500 dark:text-[#737373] font-mono mt-0.5">
              Strictly authorized to {hospital?.name || "your hospital"}
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm font-mono text-slate-500 dark:text-[#737373]">Loading bed capacity...</div>
          ) : (
            <>
              {/* Mobile Card View (< md) */}
              <div className="block md:hidden divide-y divide-slate-200 dark:divide-[#1f1f1f] bg-white dark:bg-[#0f0f0f]">
                {beds.map((bed) => {
                  const occPct = bed.totalBeds > 0 ? Math.round((bed.occupiedBeds / bed.totalBeds) * 100) : 0;
                  return (
                    <div key={bed.id} className="p-4 space-y-3 font-sans">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-[#ededed]">
                          {bed.categoryCode} · {bed.name}
                        </span>
                        <span
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded-sm border ${
                            occPct >= 90
                              ? "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/60"
                              : occPct >= 70
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/60"
                              : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60"
                          }`}
                        >
                          {occPct}% Occ
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-slate-50 dark:bg-[#141414] p-3 rounded-sm border border-slate-200 dark:border-[#222222]">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Available</div>
                          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{bed.availableBeds}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Occupied</div>
                          <div className="text-lg font-bold text-slate-600 dark:text-[#a1a1a1] mt-0.5">{bed.occupiedBeds}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Total</div>
                          <div className="text-lg font-bold text-slate-900 dark:text-[#ededed] mt-0.5">{bed.totalBeds}</div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full bg-slate-200 dark:bg-[#222222] h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              occPct >= 90
                                ? "bg-red-500"
                                : occPct >= 70
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, occPct))}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 dark:text-[#666]">
                          <span>Last Updated</span>
                          <span>{formatDate(bed.lastUpdated)} {new Date(bed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenModal(bed)}
                        disabled={hospital?.status === "DEACTIVATED"}
                        className={`w-full py-2.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors text-center ${
                          hospital?.status === "DEACTIVATED"
                            ? "bg-slate-200 dark:bg-[#222222] text-slate-400 dark:text-[#666] cursor-not-allowed"
                            : "text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 cursor-pointer shadow-xs"
                        }`}
                        title={hospital?.status === "DEACTIVATED" ? "Updates disabled while facility is deactivated by SuperAdmin" : "Edit bed availability"}
                      >
                        Edit Availability
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table: Bed Categories */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-[#888888] font-mono text-xs uppercase border-b border-slate-200 dark:border-[#222222]">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Code</th>
                      <th className="py-3.5 px-4 font-semibold">Category Name</th>
                      <th className="py-3.5 px-4 font-semibold text-right whitespace-nowrap">Total Capacity</th>
                      <th className="py-3.5 px-4 font-semibold text-right whitespace-nowrap">Available Beds</th>
                      <th className="py-3.5 px-4 font-semibold text-right whitespace-nowrap">Occupied Beds</th>
                      <th className="py-3.5 px-4 font-semibold text-right whitespace-nowrap">Occupancy %</th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Last Updated</th>
                      <th className="py-3.5 px-4 font-semibold text-center whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f] bg-white dark:bg-[#0f0f0f]">
                    {beds.map((bed) => {
                      const occPct = bed.totalBeds > 0 ? Math.round((bed.occupiedBeds / bed.totalBeds) * 100) : 0;
                      return (
                        <tr key={bed.id} className="hover:bg-slate-50 dark:hover:bg-[#141414] transition-colors">
                          <td className="py-4 px-4 font-mono font-bold text-slate-900 dark:text-[#ededed] whitespace-nowrap">{bed.categoryCode}</td>
                          <td className="py-4 px-4 font-semibold text-slate-900 dark:text-[#ededed]">{bed.name}</td>
                          <td className="py-4 px-4 font-mono text-right text-slate-900 dark:text-[#ededed] font-semibold whitespace-nowrap">{bed.totalBeds}</td>
                          <td className="py-4 px-4 font-mono text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{bed.availableBeds}</td>
                          <td className="py-4 px-4 font-mono text-right text-slate-600 dark:text-[#a1a1a1] whitespace-nowrap">{bed.occupiedBeds}</td>
                          <td className="py-4 px-4 font-mono text-right font-semibold text-slate-900 dark:text-[#ededed] whitespace-nowrap">{occPct}%</td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-500 dark:text-[#737373] whitespace-nowrap">
                            <div>{formatDate(bed.lastUpdated)}</div>
                            <div className="text-[10px] text-slate-400">{new Date(bed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                          </td>
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleOpenModal(bed)}
                              disabled={hospital?.status === "DEACTIVATED"}
                              className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap ${
                                hospital?.status === "DEACTIVATED"
                                  ? "bg-slate-200 dark:bg-[#222222] text-slate-400 dark:text-[#666] cursor-not-allowed"
                                  : "text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 cursor-pointer shadow-2xs"
                              }`}
                              title={hospital?.status === "DEACTIVATED" ? "Updates disabled while facility is deactivated by SuperAdmin" : "Edit bed availability"}
                            >
                              Edit Availability
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f0f0f] max-w-md w-full border border-slate-300 dark:border-[#2a2a2a] shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-semibold block">VALIDATED UPDATE</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">{editingCategory.name}</h3>
              </div>
              <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            {validationError && (
              <div className="p-3 mb-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs font-mono rounded-sm">
                ⚠ {validationError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">
                  Available Beds (Ready for Patients)
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
                <span className="text-[11px] text-slate-500 dark:text-[#737373] font-mono block mt-1">
                  Must be between 0 and total capacity ({typeof editTotal === "number" ? editTotal : (parseInt(editTotal, 10) || 0)})
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">
                  Total Capacity (Total Unit Beds)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editTotal}
                  onFocus={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val >= 0) prevEditTotalRef.current = val;
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
                      if (parsed >= 0) prevEditTotalRef.current = parsed;
                    }
                  }}
                  onBlur={() => {
                    if (editTotal === "" || isNaN(Number(editTotal)) || Number(editTotal) < 0) {
                      setEditTotal(prevEditTotalRef.current ?? 0);
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

              <div className="p-3 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] text-xs font-mono text-slate-700 dark:text-[#a1a1a1]">
                Calculated Occupied Beds: <span className="font-bold text-slate-900 dark:text-[#ededed]">{Math.max(0, (typeof editTotal === "number" ? editTotal : (parseInt(editTotal, 10) || 0)) - (typeof editAvailable === "number" ? editAvailable : (parseInt(editAvailable, 10) || 0)))}</span>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#222222]">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold uppercase text-slate-600 dark:text-[#a1a1a1] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-colors disabled:opacity-50 cursor-pointer text-center"
                >
                  {updating ? "Saving to Neon..." : "Save Bed Capacity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
