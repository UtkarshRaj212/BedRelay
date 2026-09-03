"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

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
  phone: string;
}

export default function BedManagementPage() {
  const { data: session, isPending } = authClient.useSession();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [beds, setBeds] = useState<BedCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingCategory, setEditingCategory] = useState<BedCategory | null>(null);
  const [editAvailable, setEditAvailable] = useState<number>(0);
  const [editTotal, setEditTotal] = useState<number>(0);
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
    setEditTotal(bed.totalBeds);
    setValidationError(null);
    setSuccessMsg(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    // Client-side Validation Checks
    if (editAvailable < 0) {
      setValidationError("Available beds cannot be negative.");
      return;
    }
    if (editTotal < 0) {
      setValidationError("Total capacity cannot be negative.");
      return;
    }
    if (editAvailable > editTotal) {
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
          availableBeds: editAvailable,
          totalBeds: editTotal,
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Top Status Header */}
      <div className="bg-slate-900 text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>BED CAPACITY MANAGEMENT CONSOLE</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">STAFF: {session.user.email}</span>
        </div>
        <button
          onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
          className="text-slate-400 hover:text-white transition-colors underline font-mono text-[11px]"
        >
          Sign Out
        </button>
      </div>

      {/* Main Header & Nav Tabs */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 text-white font-bold flex items-center justify-center text-sm font-mono rounded-sm">
              BR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 font-mono tracking-tight">
                BED<span className="text-blue-700">RELAY</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">
                Hospital Control Console
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-2 font-mono text-xs">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 rounded-sm"
              >
                OVERVIEW
              </Link>
              <Link
                href="/dashboard/beds"
                className="px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-sm"
              >
                BED MANAGEMENT
              </Link>
              <Link
                href="/dashboard/dispatches"
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 rounded-sm"
              >
                DISPATCH REQUESTS
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hospital Header Banner */}
        <div className="bg-white p-6 border border-slate-200 rounded-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-mono font-semibold rounded-sm">
                SCOPED AUTHENTICATED HOSPITAL
              </span>
              <span className="text-xs text-slate-500 font-mono">ID: {hospital?.id}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{hospital?.name || "Loading Hospital..."}</h1>
            <p className="text-xs text-slate-600 font-mono mt-0.5">
              Updates made here broadcast immediately to regional ambulance dispatchers.
            </p>
          </div>

          <button
            onClick={fetchBeds}
            className="px-3 py-1.5 text-xs font-mono text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
          >
            Refresh Telemetry Data
          </button>
        </div>

        {successMsg && (
          <div className="p-4 mb-6 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-mono rounded-sm flex items-center justify-between">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-900 font-bold">✕</button>
          </div>
        )}

        {/* Main Bed Categories Table */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Bed Categories Telemetry & Capacity</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Strictly authorized to {hospital?.name || "your hospital"}
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm font-mono text-slate-500">LOADING BED CAPACITY TELEMETRY...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-mono text-xs uppercase border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-200 bg-white">
                  {beds.map((bed) => {
                    const occPct = bed.totalBeds > 0 ? Math.round((bed.occupiedBeds / bed.totalBeds) * 100) : 0;
                    return (
                      <tr key={bed.id} className="hover:bg-slate-50">
                        <td className="py-4 px-6 font-mono font-bold text-slate-900">{bed.categoryCode}</td>
                        <td className="py-4 px-6 font-semibold text-slate-900">{bed.name}</td>
                        <td className="py-4 px-6 font-mono text-right text-slate-900 font-semibold">{bed.totalBeds}</td>
                        <td className="py-4 px-6 font-mono text-right font-bold text-emerald-700">{bed.availableBeds}</td>
                        <td className="py-4 px-6 font-mono text-right text-slate-600">{bed.occupiedBeds}</td>
                        <td className="py-4 px-6 font-mono text-right font-semibold text-slate-900">{occPct}%</td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">
                          {new Date(bed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => handleOpenModal(bed)}
                            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 rounded-sm transition-colors"
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
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full border border-slate-300 shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 uppercase font-semibold block">VALIDATED UPDATE</span>
                <h3 className="text-lg font-bold text-slate-900">{editingCategory.name}</h3>
              </div>
              <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            {validationError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs font-mono rounded-sm">
                ⚠ {validationError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase mb-1">
                  Available Beds (Ready for Patients)
                </label>
                <input
                  type="number"
                  min="0"
                  max={editTotal}
                  value={editAvailable}
                  onChange={(e) => setEditAvailable(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-slate-900 rounded-sm"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono block mt-1">
                  Must be between 0 and total capacity ({editTotal})
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase mb-1">
                  Total Capacity (Total Unit Beds)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editTotal}
                  onChange={(e) => setEditTotal(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-slate-900 rounded-sm"
                  required
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
                Calculated Occupied Beds: <span className="font-bold text-slate-900">{Math.max(0, editTotal - editAvailable)}</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 text-xs font-semibold uppercase text-slate-600 hover:text-slate-900 border border-slate-300 rounded-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 rounded-sm transition-colors disabled:opacity-50"
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
