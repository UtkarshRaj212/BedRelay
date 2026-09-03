"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BedCategory {
  id: string;
  categoryCode: string;
  name: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  lastUpdated: string;
}

interface HospitalResult {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  totalAvailable: number;
  totalBeds: number;
  beds: BedCategory[];
}

export default function FindBedsPage() {
  const [hospitals, setHospitals] = useState<HospitalResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  const fetchBeds = async (category: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hospitals/search?category=${category}`);
      if (res.ok) {
        const data = await res.json();
        setHospitals(data.hospitals || []);
      }
    } catch (err) {
      console.error("Failed to fetch beds:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeds(selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* System Status Banner */}
      <div className="bg-slate-900 text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>SYSTEM STATUS: AMBULANCE DISPATCH TELEMETRY CONSOLE</span>
        </div>
        <div className="text-slate-400 font-mono text-[11px]">MODE: PRE-HOSPITAL ROUTING</div>
      </div>

      {/* Header */}
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
                Dispatcher Search Console
              </span>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:text-slate-900 border border-slate-300 rounded-sm"
          >
            Hospital Staff Portal
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Category Filter Controls */}
        <div className="bg-white p-6 border border-slate-200 rounded-sm mb-8">
          <div className="border-l-2 border-blue-700 pl-3 mb-4">
            <span className="text-xs font-mono text-blue-700 uppercase tracking-widest block">TELEMETRY FILTER</span>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">Find Nearby Hospital Available Capacity</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-xs font-mono text-slate-500 uppercase">Filter Bed Category:</span>

            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-sm transition-colors ${
                selectedCategory === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
              }`}
            >
              ALL CATEGORIES
            </button>

            <button
              onClick={() => setSelectedCategory("ICU")}
              className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-sm transition-colors ${
                selectedCategory === "ICU"
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
              }`}
            >
              ICU BEDS
            </button>

            <button
              onClick={() => setSelectedCategory("GENERAL")}
              className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-sm transition-colors ${
                selectedCategory === "GENERAL"
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
              }`}
            >
              GENERAL WARD
            </button>

            <button
              onClick={() => setSelectedCategory("VENTILATOR")}
              className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-sm transition-colors ${
                selectedCategory === "VENTILATOR"
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
              }`}
            >
              VENTILATOR & CRITICAL
            </button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-slate-500 bg-white border border-slate-200 rounded-sm">
            SCANNING REGIONAL HOSPITAL CAPACITY TELEMETRY...
          </div>
        ) : hospitals.length === 0 ? (
          <div className="p-12 text-center text-sm font-mono text-slate-500 bg-white border border-slate-200 rounded-sm">
            NO HOSPITALS FOUND MATCHING SPECIFIED CRITERIA
          </div>
        ) : (
          <div className="space-y-6">
            {hospitals.map((hosp) => (
              <div key={hosp.id} className="bg-white border border-slate-200 rounded-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-mono font-semibold rounded-sm">
                        ACCEPTING INBOUND
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{hosp.city}</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-1">{hosp.name}</h2>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      {hosp.address} • Tel: {hosp.phone}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono text-slate-500 uppercase">Available Capacity</div>
                    <div className="text-2xl font-bold text-emerald-700 font-mono mt-0.5">
                      {hosp.totalAvailable} <span className="text-sm font-normal text-slate-500">/ {hosp.totalBeds} Beds</span>
                    </div>
                  </div>
                </div>

                {/* Bed Categories breakdown table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-mono text-xs uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Category Code</th>
                        <th className="py-2.5 px-4 font-semibold">Bed Category</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Available Beds</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Total Beds</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Last Telemetry Sync</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {hosp.beds.map((b) => (
                        <tr key={b.id}>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.categoryCode}</td>
                          <td className="py-3 px-4 text-slate-800 font-medium">{b.name}</td>
                          <td className="py-3 px-4 font-mono text-right font-bold text-emerald-700">{b.availableBeds}</td>
                          <td className="py-3 px-4 font-mono text-right text-slate-600">{b.totalBeds}</td>
                          <td className="py-3 px-4 font-mono text-xs text-right text-slate-500">
                            {new Date(b.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
