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

interface HospitalResult {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  distanceKm: number | null;
  totalAvailable: number;
  totalBeds: number;
  targetCategoryBeds: number;
  isSuitable: boolean;
  beds: BedCategory[];
}

export default function FindHospitalPage() {
  const [selectedCity, setSelectedCity] = useState<string>("Mumbai");
  const [selectedCategory, setSelectedCategory] = useState<string>("ICU");
  const [minBeds, setMinBeds] = useState<number>(1);

  const [hospitals, setHospitals] = useState<HospitalResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Dispatch Request Modal State
  const [dispatchModalHospital, setDispatchModalHospital] = useState<HospitalResult | null>(null);
  const [ambulanceUnit, setAmbulanceUnit] = useState<string>("108 EMS Unit-101");
  const [etaMinutes, setEtaMinutes] = useState<number>(12);
  const [patientCondition, setPatientCondition] = useState<string>("Acute Respiratory Distress");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dispatchMsg, setDispatchMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchSuitableHospitals = async () => {
    try {
      setLoading(true);
      const url = `/api/hospitals/search?city=${encodeURIComponent(
        selectedCity
      )}&category=${selectedCategory}&minBeds=${minBeds}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHospitals(data.hospitals || []);
      }
    } catch (err) {
      console.error("Failed to fetch suitable hospitals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuitableHospitals();
  }, [selectedCity, selectedCategory, minBeds]);

  const suitableHospitals = hospitals.filter((h) => h.isSuitable);
  const unsuitableHospitals = hospitals.filter((h) => !h.isSuitable);

  const handleOpenDispatch = (hosp: HospitalResult) => {
    setDispatchModalHospital(hosp);
    setDispatchMsg(null);
  };

  const handleSendDispatch = async (e: React.FormEvent) => {
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
          requestedBeds: minBeds,
          etaMinutes,
          patientCondition,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to transmit dispatch alert");
      }

      setDispatchMsg({
        type: "success",
        text: `Pre-arrival dispatch alert transmitted to ${dispatchModalHospital.name}`,
      });

      setTimeout(() => {
        setDispatchModalHospital(null);
      }, 1500);

      await fetchSuitableHospitals();
    } catch (err: any) {
      setDispatchMsg({
        type: "error",
        text: err.message || "Failed to transmit dispatch request.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Top Bar */}
      <div className="bg-slate-900 text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>DISPATCH ROUTING & SUITABILITY SEARCH CONSOLE</span>
        </div>
        <div className="text-slate-400 font-mono text-[11px]">DISPATCHER MODE (READ-ONLY)</div>
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
            <Link
              href="/dispatcher"
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 rounded-sm"
            >
              DISPATCHER DASHBOARD
            </Link>
            <Link
              href="/find-beds"
              className="px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-sm"
            >
              FIND HOSPITAL
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Location & Capacity Requirement Filter Form */}
        <div className="bg-white p-6 border border-slate-200 rounded-sm mb-8">
          <div className="border-l-2 border-blue-700 pl-3 mb-6">
            <span className="text-xs font-mono text-blue-700 uppercase tracking-widest block">SUITABILITY FILTER</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">Find Suitable Inbound Hospitals</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-mono text-slate-700 uppercase font-semibold mb-2">
                01. Dispatch Location (India)
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 font-mono text-sm font-semibold focus:outline-none focus:border-slate-900 rounded-sm"
              >
                {INDIAN_CITIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}, {c.state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-700 uppercase font-semibold mb-2">
                02. Required Bed Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 font-mono text-sm font-semibold focus:outline-none focus:border-slate-900 rounded-sm"
              >
                <option value="ICU">Intensive Care Unit (ICU)</option>
                <option value="GENERAL">General Ward</option>
                <option value="VENTILATOR">Ventilator & Critical Care</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-700 uppercase font-semibold mb-2">
                03. Required Beds Count
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={minBeds}
                onChange={(e) => setMinBeds(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 font-mono text-sm font-semibold focus:outline-none focus:border-slate-900 rounded-sm"
              />
            </div>
          </div>
        </div>

        {/* Results Section */}
        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-slate-500 bg-white border border-slate-200 rounded-sm">
            EVALUATING HOSPITAL SUITABILITY & PROXIMITY...
          </div>
        ) : (
          <div className="space-y-8">
            {/* Suitable Hospitals List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">
                  Suitable Hospitals ({suitableHospitals.length} Facilities with ≥ {minBeds} {selectedCategory} Bed{minBeds > 1 ? "s" : ""})
                </h2>
                <span className="text-xs font-mono text-slate-500">SORTED BY PROXIMITY (KM)</span>
              </div>

              {suitableHospitals.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-sm">
                  <div className="text-xs font-mono text-amber-700 font-bold mb-1">NO SUITABLE FACILITIES FOUND</div>
                  <p className="text-sm text-slate-600">
                    No hospitals near {selectedCity} currently have at least {minBeds} available {selectedCategory} bed(s).
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suitableHospitals.map((hosp) => {
                    const catBed = hosp.beds.find((b) => b.categoryCode.toUpperCase() === selectedCategory.toUpperCase());
                    const availCount = catBed ? catBed.availableBeds : 0;

                    return (
                      <div key={hosp.id} className="bg-white border border-slate-200 rounded-sm p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-mono font-bold rounded-sm">
                                ✓ SUITABLE FACILITY
                              </span>
                              <span className="text-xs text-slate-500 font-mono">
                                {hosp.city}, {hosp.state || "India"}
                              </span>
                              {hosp.distanceKm !== null && (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-mono text-xs font-bold border border-blue-200 rounded-sm">
                                  {hosp.distanceKm} km away
                                </span>
                              )}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mt-1">{hosp.name}</h3>
                            <p className="text-xs text-slate-600 font-mono mt-0.5">
                              {hosp.address} • Phone: <span className="font-bold text-slate-900">{hosp.phone}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-xs font-mono text-slate-500 uppercase">{selectedCategory} Available</div>
                              <div className="text-2xl font-bold text-emerald-700 font-mono mt-0.5">
                                {availCount} <span className="text-xs font-normal text-slate-500">/ {catBed ? catBed.totalBeds : 0} Beds</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleOpenDispatch(hosp)}
                              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 rounded-sm transition-colors"
                            >
                              Send Dispatch Request
                            </button>
                          </div>
                        </div>

                        {/* Bed Categories breakdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {hosp.beds.map((b) => (
                            <div key={b.id} className="p-3 bg-slate-50 border border-slate-200 rounded-sm text-xs font-mono">
                              <div className="text-slate-500 uppercase font-semibold">{b.name}</div>
                              <div className="text-sm font-bold text-slate-900 mt-1">
                                <span className="text-emerald-700">{b.availableBeds}</span> / {b.totalBeds} Available
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Local hospitals that don't meet the bed requirement */}
            {unsuitableHospitals.length > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-mono text-slate-500 uppercase font-bold mb-3">
                  Nearby Hospitals with Insufficient {selectedCategory} Beds ({unsuitableHospitals.length})
                </h3>
                <div className="space-y-3">
                  {unsuitableHospitals.map((hosp) => {
                    const catBed = hosp.beds.find((b) => b.categoryCode.toUpperCase() === selectedCategory.toUpperCase());
                    const availCount = catBed ? catBed.availableBeds : 0;
                    const totalCount = catBed ? catBed.totalBeds : 0;

                    return (
                      <div key={hosp.id} className="bg-white p-4 border border-slate-200 rounded-sm flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-mono font-bold border border-amber-200 rounded-sm">
                              {availCount} / {totalCount} {selectedCategory}
                            </span>
                            <span className="text-sm font-semibold text-slate-800">{hosp.name}</span>
                            <span className="text-xs font-mono text-slate-500">{hosp.city}</span>
                            {hosp.distanceKm !== null && (
                              <span className="text-xs font-mono text-slate-400">{hosp.distanceKm} km</span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                          Need {minBeds}, only {availCount} available
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Send Dispatch Modal */}
      {dispatchModalHospital && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-lg w-full border border-slate-300 shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 uppercase font-semibold block">SEND DISPATCH REQUEST</span>
                <h3 className="text-lg font-bold text-slate-900">{dispatchModalHospital.name}</h3>
                <span className="text-xs font-mono text-slate-500">{dispatchModalHospital.city}, {dispatchModalHospital.state || "India"} • {dispatchModalHospital.address}</span>
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

            <form onSubmit={handleSendDispatch} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase mb-1">Ambulance Unit Identifier</label>
                <input
                  type="text"
                  value={ambulanceUnit}
                  onChange={(e) => setAmbulanceUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none rounded-sm"
                  placeholder="e.g. 108 EMS Unit-101"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-sm">
                  <div className="text-slate-500 uppercase">Category</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedCategory}</div>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-sm">
                  <div className="text-slate-500 uppercase">Requested Beds</div>
                  <div className="font-bold text-slate-900 mt-0.5">{minBeds}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase mb-1">Estimated Travel ETA (Minutes)</label>
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
                <label className="block text-xs font-mono text-slate-700 uppercase mb-1">Patient Clinical Condition & Notes</label>
                <textarea
                  value={patientCondition}
                  onChange={(e) => setPatientCondition(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 text-sm focus:outline-none rounded-sm"
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
                  {submitting ? "Transmitting..." : "Send Request to Hospital"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
