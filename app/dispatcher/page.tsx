"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { INDIAN_CITIES } from "@/lib/geo";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { getDispatcherSessionId } from "@/lib/dispatcher-session";

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
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string;
  hospitalState: string;
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
  const [requestedBeds, setRequestedBeds] = useState<string | number>(1);
  const prevRequestedBedsRef = useRef<number>(1);
  const [etaMinutes, setEtaMinutes] = useState<string | number>(15);
  const prevEtaMinutesRef = useRef<number>(15);
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
        setLastSynced(formatDateTime(new Date(), true));
      }
    } catch (err) {
      console.error("Failed to fetch live telemetry:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 5000); // Near-real-time refresh every 5 seconds
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

      const finalRequestedBeds =
        typeof requestedBeds === "number"
          ? requestedBeds
          : parseInt(requestedBeds, 10) || prevRequestedBedsRef.current || 1;
      const finalEtaMinutes =
        typeof etaMinutes === "number"
          ? etaMinutes
          : parseInt(etaMinutes, 10) || prevEtaMinutesRef.current || 15;

      const res = await fetch("/api/dispatch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: dispatchModalHospital.id,
          ambulanceUnit,
          bedCategoryCode: selectedCategory,
          requestedBeds: finalRequestedBeds,
          etaMinutes: finalEtaMinutes,
          patientCondition,
          dispatcherSessionId: getDispatcherSessionId(),
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* System Status Top Bar */}
      <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
          <span>AMBULANCE DISPATCH TELEMETRY CONSOLE</span>
          <span className="text-slate-500 dark:text-[#555]">|</span>
          <span className="text-slate-400 dark:text-[#888888]">NEAR-REAL-TIME SYNC (5S)</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-slate-400 dark:text-[#888888]">
          <span className="text-[11px]">LAST UPDATED: {lastSynced || "CONNECTING..."}</span>
          <span className="text-slate-600 dark:text-[#555]">|</span>
          <span className="hidden sm:inline text-slate-300 dark:text-[#a1a1a1]">NO AUTH REQUIRED</span>
          <ThemeToggle />
        </div>
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
                Ambulance Dispatcher Console
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3 font-mono text-xs">
            <Link href="/dispatcher" className="px-3 py-1.5 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold rounded-sm">
              DISPATCHER DASHBOARD
            </Link>
            <Link href="/find-beds" className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm transition-colors">
              FIND HOSPITAL
            </Link>
            <Link href="/dispatcher/history" className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm transition-colors">
              REQUEST HISTORY
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls Banner */}
        <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#181818] border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#a1a1a1] text-xs font-mono font-semibold rounded-sm">
                REGION / DISPATCH ZONE
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">Live Regional Bed Availability Stream</h1>
            <p className="text-xs text-slate-600 dark:text-[#888888] font-mono mt-0.5">
              Live capacity auto-refreshes directly from hospital floor telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-mono text-slate-600 dark:text-[#888888] uppercase">Dispatch Base Location:</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] font-mono text-xs font-semibold focus:outline-none rounded-sm"
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
        <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#222222] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Current Active Dispatch Requests</h2>
              <p className="text-xs text-slate-500 dark:text-[#737373] font-mono mt-0.5">
                Real-time ambulance pre-arrival alerts transmitted to receiving facilities
              </p>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 dark:bg-[#181818] border border-slate-300 dark:border-[#2a2a2a] font-mono text-xs font-bold text-slate-700 dark:text-[#a1a1a1] rounded-sm">
              {activeDispatches.length} DISPATCHES IN PROGRESS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-[#888888] font-mono text-xs uppercase border-b border-slate-200 dark:border-[#222222]">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Dispatch ID</th>
                  <th className="py-3.5 px-6 font-semibold">Receiving Hospital</th>
                  <th className="py-3.5 px-6 font-semibold">Ambulance Unit</th>
                  <th className="py-3.5 px-6 font-semibold">Bed Category Required</th>
                  <th className="py-3.5 px-6 font-semibold text-center">Beds Requested</th>
                  <th className="py-3.5 px-6 font-semibold">Patient Clinical Condition</th>
                  <th className="py-3.5 px-6 font-semibold text-center">ETA</th>
                  <th className="py-3.5 px-6 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Transmitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f] bg-white dark:bg-[#0f0f0f]">
                {activeDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 px-6 text-center text-xs font-mono text-slate-500 dark:text-[#737373]">
                      NO ACTIVE DISPATCH ALERTS CURRENTLY BROADCASTING
                    </td>
                  </tr>
                ) : (
                  activeDispatches.map((disp) => (
                    <tr key={disp.id} className="hover:bg-slate-50 dark:hover:bg-[#141414] transition-colors">
                      <td className="py-4 px-6 font-mono text-xs text-slate-600 dark:text-[#888888]">{disp.id}</td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-900 dark:text-[#ededed] text-sm">{disp.hospitalName}</div>
                        <div className="text-xs font-mono text-slate-500 dark:text-[#737373] mt-0.5">{disp.hospitalCity}{disp.hospitalState ? `, ${disp.hospitalState}` : ""}</div>
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-[#ededed]">{disp.ambulanceUnit}</td>
                      <td className="py-4 px-6 font-mono text-xs font-semibold">
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 rounded-sm">
                          {disp.bedCategoryCode}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-center font-bold text-slate-900 dark:text-[#ededed]">{disp.requestedBeds || 1}</td>
                      <td className="py-4 px-6 text-slate-800 dark:text-[#a1a1a1] font-medium">{disp.patientCondition}</td>
                      <td className="py-4 px-6 font-mono text-center font-bold text-slate-900 dark:text-[#ededed]">{disp.etaMinutes}m</td>
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

        {/* Live Overview of Hospitals with Beds */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#222222] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Hospital Bed Capacity Overview ({selectedCity} Base)</h2>
              <p className="text-xs text-slate-500 dark:text-[#737373] font-mono mt-0.5">
                Calculated straight-line distance (km) and real-time category breakdown
              </p>
            </div>
            <Link
              href="/find-beds"
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-colors"
            >
              Search & Filter Hospitals →
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm font-mono text-slate-500 dark:text-[#737373]">FETCHING REAL-TIME TELEMETRY...</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-[#1f1f1f]">
              {hospitals.map((hosp) => {
                const icuBed = hosp.beds.find((b) => b.categoryCode === "ICU");
                const genBed = hosp.beds.find((b) => b.categoryCode === "GENERAL");
                const ventBed = hosp.beds.find((b) => b.categoryCode === "VENTILATOR");

                return (
                  <div key={hosp.id} className="p-6 hover:bg-slate-50 dark:hover:bg-[#141414] transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#181818] text-slate-700 dark:text-[#a1a1a1] font-mono text-xs font-semibold border border-slate-300 dark:border-[#2a2a2a] rounded-sm">
                            {hosp.city}, {hosp.state || "India"}
                          </span>
                          {hosp.distanceKm !== null && (
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-400 font-mono text-xs font-semibold border border-blue-200 dark:border-blue-900/60 rounded-sm">
                              {hosp.distanceKm} km from {selectedCity}
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-[#ededed] mt-1">{hosp.name}</h3>
                        <p className="text-xs text-slate-600 dark:text-[#888888] font-mono mt-0.5">
                          {hosp.address} • Contact: {hosp.phone}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleOpenDispatchModal(hosp)}
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 dark:bg-[#ededed] dark:text-black dark:hover:bg-white rounded-sm transition-colors cursor-pointer"
                        >
                          Initiate Dispatch Alert
                        </button>
                      </div>
                    </div>

                    {/* Bed Capacity Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-sm flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-[#737373] uppercase font-semibold">ICU BEDS</div>
                          <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {icuBed ? icuBed.availableBeds : 0} <span className="text-xs font-normal text-slate-500 dark:text-[#737373]">/ {icuBed ? icuBed.totalBeds : 0} Available</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 dark:text-[#666] text-right">
                          {icuBed ? (
                            <>
                              <div>{formatDate(icuBed.lastUpdated)}</div>
                              <div>{new Date(icuBed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </>
                          ) : "—"}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-sm flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-[#737373] uppercase font-semibold">GENERAL WARD</div>
                          <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {genBed ? genBed.availableBeds : 0} <span className="text-xs font-normal text-slate-500 dark:text-[#737373]">/ {genBed ? genBed.totalBeds : 0} Available</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 dark:text-[#666] text-right">
                          {genBed ? (
                            <>
                              <div>{formatDate(genBed.lastUpdated)}</div>
                              <div>{new Date(genBed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </>
                          ) : "—"}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-sm flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-[#737373] uppercase font-semibold">VENTILATOR BEDS</div>
                          <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {ventBed ? ventBed.availableBeds : 0} <span className="text-xs font-normal text-slate-500 dark:text-[#737373]">/ {ventBed ? ventBed.totalBeds : 0} Available</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 dark:text-[#666] text-right">
                          {ventBed ? (
                            <>
                              <div>{formatDate(ventBed.lastUpdated)}</div>
                              <div>{new Date(ventBed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </>
                          ) : "—"}
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
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f0f0f] max-w-lg w-full border border-slate-300 dark:border-[#2a2a2a] shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-semibold block">AMBULANCE PRE-ARRIVAL ALERT</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">{dispatchModalHospital.name}</h3>
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373]">{dispatchModalHospital.city}, {dispatchModalHospital.state || "India"} • {dispatchModalHospital.address}</span>
              </div>
              <button onClick={() => setDispatchModalHospital(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            {dispatchMsg && (
              <div
                className={`p-3 mb-4 text-xs font-mono rounded-sm ${
                  dispatchMsg.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-400"
                    : "bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/60 text-red-800 dark:text-red-400"
                }`}
              >
                {dispatchMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmitDispatch} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">Ambulance Unit / Vehicle Identifier</label>
                <input
                  type="text"
                  value={ambulanceUnit}
                  onChange={(e) => setAmbulanceUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] font-mono text-sm focus:outline-none rounded-sm"
                  placeholder="e.g. 108 EMS Unit-22"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">Required Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] font-mono text-sm focus:outline-none rounded-sm"
                  >
                    <option value="ICU">ICU (Intensive Care)</option>
                    <option value="GENERAL">General Ward</option>
                    <option value="VENTILATOR">Ventilator Care</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">Requested Beds</label>
                  <input
                    type="number"
                    min="1"
                    value={requestedBeds}
                    onFocus={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val >= 1) prevRequestedBedsRef.current = val;
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setRequestedBeds("");
                        return;
                      }
                      const parsed = parseInt(val, 10);
                      if (!isNaN(parsed)) {
                        setRequestedBeds(val);
                        if (parsed >= 1) prevRequestedBedsRef.current = parsed;
                      }
                    }}
                    onBlur={() => {
                      if (requestedBeds === "" || isNaN(Number(requestedBeds)) || Number(requestedBeds) < 1) {
                        setRequestedBeds(prevRequestedBedsRef.current || 1);
                      } else {
                        const parsed = Number(requestedBeds);
                        setRequestedBeds(parsed);
                        prevRequestedBedsRef.current = parsed;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] font-mono text-sm focus:outline-none rounded-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">ETA (Estimated Minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={etaMinutes}
                  onFocus={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val >= 1) prevEtaMinutesRef.current = val;
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setEtaMinutes("");
                      return;
                    }
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      setEtaMinutes(val);
                      if (parsed >= 1) prevEtaMinutesRef.current = parsed;
                    }
                  }}
                  onBlur={() => {
                    if (etaMinutes === "" || isNaN(Number(etaMinutes)) || Number(etaMinutes) < 1) {
                      setEtaMinutes(prevEtaMinutesRef.current || 15);
                    } else {
                      const parsed = Number(etaMinutes);
                      setEtaMinutes(parsed);
                      prevEtaMinutesRef.current = parsed;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] font-mono text-sm focus:outline-none rounded-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">Patient Clinical Condition</label>
                <textarea
                  value={patientCondition}
                  onChange={(e) => setPatientCondition(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] text-sm focus:outline-none rounded-sm"
                  placeholder="e.g. Acute Trauma / Cardiac distress"
                  required
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#222222]">
                <button
                  type="button"
                  onClick={() => setDispatchModalHospital(null)}
                  className="px-4 py-2 text-xs font-semibold uppercase text-slate-600 dark:text-[#a1a1a1] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-colors disabled:opacity-50 cursor-pointer"
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
