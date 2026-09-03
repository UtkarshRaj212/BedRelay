"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { INDIAN_CITIES } from "@/lib/geo";

interface BedCategory {
  id: string;
  categoryCode: string;
  name: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  lastUpdated: string;
}

interface HospitalItem {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  distanceKm: number | null;
  totalAvailable: number;
  totalBeds: number;
  beds: BedCategory[];
}

interface DispatchItem {
  id: string;
  ambulanceUnit: string;
  bedCategoryCode: string;
  requestedBeds: number;
  etaMinutes: number;
  patientCondition: string;
  status: string;
  createdAt: string;
}

export default function DispatcherDashboardPage() {
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [activeDispatches, setActiveDispatches] = useState<DispatchItem[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("Mumbai");
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<string>("");

  const [dispatchModalHospital, setDispatchModalHospital] = useState<HospitalItem | null>(null);
  const [ambulanceUnit, setAmbulanceUnit] = useState("108 EMS Unit-22");
  const [selectedCategory, setSelectedCategory] = useState("ICU");
  const [requestedBeds, setRequestedBeds] = useState(1);
  const [etaMinutes, setEtaMinutes] = useState(15);
  const [patientCondition, setPatientCondition] = useState("Severe Acute Cardiac Event");
  const [submitting, setSubmitting] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchLiveData = async () => {
    try {
      const res = await fetch(`/api/hospitals/search?city=${encodeURIComponent(selectedCity)}`);
      if (res.ok) {
        const data = await res.json();
        setHospitals(data.hospitals || []);
        setActiveDispatches(data.activeDispatches || []);
        setLastSynced(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to fetch live telemetry:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 10000); // Auto-refresh every 10 seconds
    return () => clearInterval(interval);
  }, [selectedCity]);

  const handleOpenDispatchModal = (hospital: HospitalItem) => {
    setDispatchModalHospital(hospital);
    setDispatchMsg(null);
  };

  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalHospital) return;

    try {
      setSubmitting(true);
      setDispatchMsg(null);

      const res = await fetch("/api/dispatch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: dispatchModalHospital.id,
          ambulanceUnit,
          bedCategoryCode: selectedCategory,
          requestedBeds,
          etaMinutes,
          patientCondition,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create dispatch request");
      }

      setDispatchMsg({
        type: "success",
        text: `Dispatch request transmitted successfully to ${dispatchModalHospital.name}`,
      });

      setTimeout(() => {
        setDispatchModalHospital(null);
      }, 1500);

      await fetchLiveData();
    } catch (err: any) {
      setDispatchMsg({
        type: "error",
        text: err.message || "Failed to send dispatch alert.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* System Status Top Bar */}
      <div className="bg-slate-900 text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>AMBULANCE DISPATCH TELEMETRY CONSOLE</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">LIVE SYNC (EVERY 10S)</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>LAST SYNC: {lastSynced || "CONNECTING..."}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">NO AUTH REQUIRED (DISPATCH READ-ONLY)</span>
        </div>
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
                Ambulance Dispatcher Console
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-4 font-mono text-xs">
            <Link href="/dispatcher" className="px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-sm">
              DISPATCHER DASHBOARD
            </Link>
            <Link href="/find-beds" className="px-3 py-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-sm">
              FIND HOSPITAL
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls Banner */}
        <div className="bg-white p-6 border border-slate-200 rounded-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 text-xs font-mono font-semibold rounded-sm">
                REGION / DISPATCH ZONE
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Live Regional Bed Availability Stream</h1>
            <p className="text-xs text-slate-600 font-mono mt-0.5">
              Live capacity auto-refreshes directly from hospital floor telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-mono text-slate-600 uppercase">Dispatch Base Location:</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-900 font-mono text-xs font-semibold focus:outline-none rounded-sm"
            >
              {INDIAN_CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}, {c.state}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Dispatch Requests Section */}
        <div className="bg-white border border-slate-200 rounded-sm mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Current Active Dispatch Requests</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Real-time ambulance pre-arrival alerts transmitted to receiving facilities
              </p>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 border border-slate-300 font-mono text-xs font-bold text-slate-700 rounded-sm">
              {activeDispatches.length} DISPATCHES IN PROGRESS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-mono text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Dispatch ID</th>
                  <th className="py-3.5 px-6 font-semibold">Ambulance Unit</th>
                  <th className="py-3.5 px-6 font-semibold">Bed Category Required</th>
                  <th className="py-3.5 px-6 font-semibold text-center">Beds Requested</th>
                  <th className="py-3.5 px-6 font-semibold">Patient Clinical Condition</th>
                  <th className="py-3.5 px-6 font-semibold text-center">ETA</th>
                  <th className="py-3.5 px-6 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Transmitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {activeDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 px-6 text-center text-xs font-mono text-slate-500">
                      NO ACTIVE DISPATCH ALERTS CURRENTLY BROADCASTING
                    </td>
                  </tr>
                ) : (
                  activeDispatches.map((disp) => (
                    <tr key={disp.id} className="hover:bg-slate-50">
                      <td className="py-4 px-6 font-mono text-xs text-slate-600">{disp.id}</td>
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">{disp.ambulanceUnit}</td>
                      <td className="py-4 px-6 font-mono text-xs font-semibold">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-sm">
                          {disp.bedCategoryCode}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-center font-bold text-slate-900">{disp.requestedBeds || 1}</td>
                      <td className="py-4 px-6 text-slate-800 font-medium">{disp.patientCondition}</td>
                      <td className="py-4 px-6 font-mono text-center font-bold text-slate-900">{disp.etaMinutes}m</td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`px-2.5 py-1 text-xs font-mono font-bold border rounded-sm ${
                            disp.status === "ACCEPTED"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : disp.status === "REJECTED"
                              ? "bg-red-100 text-red-800 border-red-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          }`}
                        >
                          {disp.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-right text-slate-500">
                        {new Date(disp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Overview of Hospitals with Beds */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Hospital Bed Capacity Overview ({selectedCity} Base)</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Calculated straight-line distance (km) and real-time category breakdown
              </p>
            </div>
            <Link
              href="/find-beds"
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 rounded-sm transition-colors"
            >
              Search & Filter Hospitals →
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm font-mono text-slate-500">FETCHING REAL-TIME TELEMETRY...</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {hospitals.map((hosp) => {
                const icuBed = hosp.beds.find((b) => b.categoryCode === "ICU");
                const genBed = hosp.beds.find((b) => b.categoryCode === "GENERAL");
                const ventBed = hosp.beds.find((b) => b.categoryCode === "VENTILATOR");

                return (
                  <div key={hosp.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs font-semibold border border-slate-300 rounded-sm">
                            {hosp.city}, {hosp.state || "India"}
                          </span>
                          {hosp.distanceKm !== null && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-mono text-xs font-semibold border border-blue-200 rounded-sm">
                              {hosp.distanceKm} km from {selectedCity}
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mt-1">{hosp.name}</h3>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">
                          {hosp.address} • Contact: {hosp.phone}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleOpenDispatchModal(hosp)}
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 rounded-sm transition-colors"
                        >
                          Initiate Dispatch Alert
                        </button>
                      </div>
                    </div>

                    {/* Bed Capacity Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-mono text-slate-500 uppercase font-semibold">ICU BEDS</div>
                          <div className="text-lg font-bold font-mono text-emerald-700 mt-0.5">
                            {icuBed ? icuBed.availableBeds : 0} <span className="text-xs font-normal text-slate-500">/ {icuBed ? icuBed.totalBeds : 0} Available</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 text-right">
                          {icuBed ? new Date(icuBed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-mono text-slate-500 uppercase font-semibold">GENERAL WARD</div>
                          <div className="text-lg font-bold font-mono text-emerald-700 mt-0.5">
                            {genBed ? genBed.availableBeds : 0} <span className="text-xs font-normal text-slate-500">/ {genBed ? genBed.totalBeds : 0} Available</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 text-right">
                          {genBed ? new Date(genBed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-mono text-slate-500 uppercase font-semibold">VENTILATOR BEDS</div>
                          <div className="text-lg font-bold font-mono text-emerald-700 mt-0.5">
                            {ventBed ? ventBed.availableBeds : 0} <span className="text-xs font-normal text-slate-500">/ {ventBed ? ventBed.totalBeds : 0} Available</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 text-right">
                          {ventBed ? new Date(ventBed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Initiate Dispatch Modal */}
      {dispatchModalHospital && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-lg w-full border border-slate-300 shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 uppercase font-semibold block">AMBULANCE PRE-ARRIVAL ALERT</span>
                <h3 className="text-lg font-bold text-slate-900">{dispatchModalHospital.name}</h3>
              </div>
              <button onClick={() => setDispatchModalHospital(null)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            {dispatchMsg && (
              <div
                className={`p-3 mb-4 text-xs font-mono rounded-sm ${
                  dispatchMsg.type === "success"
                    ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
                    : "bg-red-50 border border-red-300 text-red-800"
                }`}
              >
                {dispatchMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmitDispatch} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase mb-1">Ambulance Unit / Vehicle Identifier</label>
                <input
                  type="text"
                  value={ambulanceUnit}
                  onChange={(e) => setAmbulanceUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none rounded-sm"
                  placeholder="e.g. 108 EMS Unit-22"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-700 uppercase mb-1">Required Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none rounded-sm"
                  >
                    <option value="ICU">ICU (Intensive Care)</option>
                    <option value="GENERAL">General Ward</option>
                    <option value="VENTILATOR">Ventilator Care</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-700 uppercase mb-1">Requested Beds</label>
                  <input
                    type="number"
                    min="1"
                    value={requestedBeds}
                    onChange={(e) => setRequestedBeds(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none rounded-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase mb-1">ETA (Estimated Minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={etaMinutes}
                  onChange={(e) => setEtaMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none rounded-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase mb-1">Patient Clinical Condition</label>
                <textarea
                  value={patientCondition}
                  onChange={(e) => setPatientCondition(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 text-sm focus:outline-none rounded-sm"
                  placeholder="e.g. Acute Trauma / Cardiac distress"
                  required
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDispatchModalHospital(null)}
                  className="px-4 py-2 text-xs font-semibold uppercase text-slate-600 hover:text-slate-900 border border-slate-300 rounded-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 rounded-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? "Transmitting Alert..." : "Transmit Dispatch Alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
