"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";

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

  const fetchBeds = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/hospital/beds");
      if (res.ok) {
        const data = await res.json();
        setHospital(data.hospital);
        setBeds(data.beds || []);
      }
    } catch (err) {
      console.error("Failed to load hospital beds:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchBeds();
    }
  }, [session]);

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-sm text-slate-600">
        VERIFYING AUTHENTICATION SESSION...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex items-center justify-center p-4">
        <div className="bg-white p-8 border border-slate-200 rounded-sm max-w-md w-full">
          <div className="text-xs font-mono text-slate-500 uppercase mb-2">AUTH REQUIRED</div>
          <h1 className="text-xl font-bold text-slate-900">Hospital Staff Access Only</h1>
          <p className="mt-2 text-sm text-slate-600">
            You must be logged in with a hospital account to manage bed capacity.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block w-full text-center px-4 py-2 bg-slate-900 text-white font-semibold text-sm rounded-sm"
          >
            Go to Staff Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* Top Status Header */}
      <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>BED CAPACITY MANAGEMENT CONSOLE</span>
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
                className="px-3 py-1.5 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold rounded-sm"
              >
                BED MANAGEMENT
              </Link>
              <Link
                href="/dashboard/dispatches"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors"
              >
                DISPATCH REQUESTS
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
              {hospital?.address} • Tel: {hospital?.phone} • Updates broadcast immediately to regional dispatchers.
            </p>
          </div>

          <button
            onClick={fetchBeds}
            className="px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-[#ededed] border border-slate-300 dark:border-[#2a2a2a] hover:bg-slate-50 dark:hover:bg-[#141414] rounded-sm transition-colors cursor-pointer"
          >
            Refresh Telemetry Data
          </button>
        </div>

        {successMsg && (
          <div className="p-4 mb-6 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-400 text-xs font-mono rounded-sm flex items-center justify-between">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-900 dark:text-emerald-300 font-bold cursor-pointer">✕</button>
          </div>
        )}

        {/* Main Bed Categories Table */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#222222]">
            <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Bed Categories Telemetry & Capacity</h2>
            <p className="text-xs text-slate-500 dark:text-[#737373] font-mono mt-0.5">
              Strictly authorized to {hospital?.name || "your hospital"}
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm font-mono text-slate-500 dark:text-[#737373]">LOADING BED CAPACITY TELEMETRY...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-[#888888] font-mono text-xs uppercase border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3.5 px-6 font-semibold">Code</th>
                    <th className="py-3.5 px-6 font-semibold">Category Name</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Total Capacity</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Available Beds</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Occupied Beds</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Occupancy %</th>
                    <th className="py-3.5 px-6 font-semibold">Last Updated</th>
                    <th className="py-3.5 px-6 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f] bg-white dark:bg-[#0f0f0f]">
                  {beds.map((bed) => {
                    const occPct = bed.totalBeds > 0 ? Math.round((bed.occupiedBeds / bed.totalBeds) * 100) : 0;
                    return (
                      <tr key={bed.id} className="hover:bg-slate-50 dark:hover:bg-[#141414] transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-[#ededed]">{bed.categoryCode}</td>
                        <td className="py-4 px-6 font-semibold text-slate-900 dark:text-[#ededed]">{bed.name}</td>
                        <td className="py-4 px-6 font-mono text-right text-slate-900 dark:text-[#ededed] font-semibold">{bed.totalBeds}</td>
                        <td className="py-4 px-6 font-mono text-right font-bold text-emerald-700 dark:text-emerald-400">{bed.availableBeds}</td>
                        <td className="py-4 px-6 font-mono text-right text-slate-600 dark:text-[#a1a1a1]">{bed.occupiedBeds}</td>
                        <td className="py-4 px-6 font-mono text-right font-semibold text-slate-900 dark:text-[#ededed]">{occPct}%</td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500 dark:text-[#737373]">
                          {new Date(bed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => handleOpenModal(bed)}
                            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-colors cursor-pointer"
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
