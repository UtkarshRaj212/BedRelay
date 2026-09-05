"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { INDIAN_CITIES, isValidCoordinates } from "@/lib/geo";
import { getDispatcherSessionId } from "@/lib/dispatcher-session";
import { DynamicOSMLocationPicker } from "@/components/map/dynamic-map";

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

function CreateDispatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedHospitalId = searchParams.get("hospitalId");

  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(preselectedHospitalId || "");
  const [ambulanceUnit, setAmbulanceUnit] = useState<string>("108 EMS Unit-402");
  const [lat, setLat] = useState<number>(13.0827); // Default Chennai
  const [lng, setLng] = useState<number>(80.2707);
  const [bedCategory, setBedCategory] = useState<string>("ICU");
  const [requestedBeds, setRequestedBeds] = useState<number>(1);
  const [patientRef, setPatientRef] = useState<string>(`PAT-${Math.floor(1000 + Math.random() * 9000)}`);
  const [patientCondition, setPatientCondition] = useState<string>("Acute Myocardial Infarction");
  const [etaMinutes, setEtaMinutes] = useState<number>(15);

  const [loadingHospitals, setLoadingHospitals] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<any | null>(null);

  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const handleDetectGPS = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setDetectingGps(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 10000) / 10000);
        setLng(Math.round(pos.coords.longitude * 10000) / 10000);
        setDetectingGps(false);
      },
      (err) => {
        setGpsError(`GPS Access Denied (${err.message}).`);
        setDetectingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        setLoadingHospitals(true);
        const res = await fetch("/api/hospitals/search");
        if (res.ok) {
          const data = await res.json();
          const list: HospitalItem[] = data.hospitals || [];
          setHospitals(list);
          if (!selectedHospitalId && list.length > 0) {
            setSelectedHospitalId(list[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load hospitals:", err);
      } finally {
        setLoadingHospitals(false);
      }
    };
    fetchHospitals();
  }, []);

  const selectedHospital = hospitals.find((h) => h.id === selectedHospitalId);
  const selectedBedCategory = selectedHospital?.beds.find(
    (b) => b.categoryCode.toUpperCase() === bedCategory.toUpperCase()
  );
  const availableBeds = selectedBedCategory ? selectedBedCategory.availableBeds : 0;

  const handleCityPresetSelect = (cityName: string) => {
    const preset = INDIAN_CITIES.find((c) => c.name === cityName);
    if (preset) {
      setLat(preset.lat);
      setLng(preset.lng);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation checks
    if (!ambulanceUnit.trim()) {
      setValidationError("Ambulance/Vehicle ID is required.");
      return;
    }

    if (!selectedHospitalId) {
      setValidationError("Please select a target hospital facility.");
      return;
    }

    if (requestedBeds <= 0) {
      setValidationError("Requested beds count must be at least 1.");
      return;
    }

    if (requestedBeds > availableBeds) {
      setValidationError(
        `Selected hospital only has ${availableBeds} available ${bedCategory} bed(s). Cannot request ${requestedBeds}.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setValidationError(null);

      const res = await fetch("/api/dispatch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: selectedHospitalId,
          ambulanceUnit,
          ambulanceLat: lat,
          ambulanceLng: lng,
          patientRef,
          bedCategoryCode: bedCategory,
          requestedBeds,
          etaMinutes,
          patientCondition,
          dispatcherSessionId: getDispatcherSessionId(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create dispatch request");
      }

      setCreatedRequest(data.dispatch);
    } catch (err: any) {
      setValidationError(err.message || "Failed to create dispatch request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (createdRequest) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 text-white font-bold flex items-center justify-center text-sm font-mono rounded-sm">
                BR
              </div>
              <span className="font-bold text-lg text-slate-900 font-mono tracking-tight">
                BED<span className="text-blue-700">RELAY</span>
              </span>
            </Link>
          </div>
        </header>

        <main className="max-w-xl mx-auto my-16 px-4">
          <div className="bg-white p-8 border border-emerald-300 rounded-sm shadow-sm">
            <div className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 font-mono text-xs font-bold mb-4 rounded-sm">
              DISPATCH REQUEST CREATED & TRANSMITTED
            </div>

            <h1 className="text-2xl font-bold text-slate-900">Pre-Arrival Alert Sent</h1>
            <p className="mt-2 text-sm text-slate-600">
              The dispatch request has been saved to Neon database and broadcasted to {selectedHospital?.name}.
            </p>

            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 font-mono text-xs space-y-2">
              <div>
                <span className="text-slate-500 uppercase">Request ID:</span>{" "}
                <span className="font-bold text-slate-900">{createdRequest.id}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase">Ambulance Unit:</span>{" "}
                <span className="font-bold text-slate-900">{createdRequest.ambulanceUnit}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase">Patient Ref:</span>{" "}
                <span className="font-bold text-slate-900">{createdRequest.patientRef}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase">Hospital:</span>{" "}
                <span className="font-bold text-slate-900">{selectedHospital?.name}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase">Category / Beds:</span>{" "}
                <span className="font-bold text-blue-700">
                  {createdRequest.bedCategoryCode} ({createdRequest.requestedBeds} bed)
                </span>
              </div>
              <div>
                <span className="text-slate-500 uppercase">Status:</span>{" "}
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold border border-amber-300 rounded-sm">
                  {createdRequest.status}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/dispatch-requests/${createdRequest.id}`}
                className="w-full text-center px-4 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm rounded-sm transition-colors"
              >
                Track Live Request Details →
              </Link>
              <Link
                href="/dispatcher/history"
                className="w-full text-center px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-sm transition-colors"
              >
                View Request History
              </Link>
              <Link
                href="/dispatcher"
                className="w-full text-center px-4 py-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 font-semibold text-sm rounded-sm transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* System Bar */}
      <div className="bg-slate-900 text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>CREATE AMBULANCE DISPATCH REQUEST</span>
        </div>
        <div className="text-slate-400 text-[11px] font-mono">DISPATCHER CONSOLE</div>
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

          <nav className="flex items-center gap-3 font-mono text-xs">
            <Link
              href="/dispatcher"
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 rounded-sm"
            >
              DISPATCHER DASHBOARD
            </Link>
            <Link
              href="/find-beds"
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 rounded-sm"
            >
              FIND HOSPITAL
            </Link>
            <Link
              href="/dispatcher/history"
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 rounded-sm"
            >
              REQUEST HISTORY
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white p-8 border border-slate-200 rounded-sm">
          <div className="border-l-2 border-blue-700 pl-3 mb-6">
            <span className="text-xs font-mono text-blue-700 uppercase tracking-widest block">PRE-ARRIVAL ALERT TRANSMISSION</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">Create New Dispatch Request</h1>
          </div>

          {validationError && (
            <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-700 text-xs font-mono rounded-sm">
              Notice: {validationError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 01. Select Target Hospital & Show Real Availability */}
            <div>
              <label className="block text-xs font-mono text-slate-700 uppercase font-semibold mb-1">
                01. Select Destination Hospital
              </label>
              {loadingHospitals ? (
                <div className="p-3 text-xs font-mono text-slate-500 bg-slate-50 border border-slate-300">
                  Loading hospitals...
                </div>
              ) : (
                <select
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 font-mono text-sm font-semibold focus:outline-none focus:border-slate-900 rounded-sm"
                  required
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city}) — {h.totalAvailable} total beds avail
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected Hospital Availability Summary Box */}
            {selectedHospital && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-sm">
                <div className="text-xs font-mono text-slate-500 uppercase font-semibold mb-2">
                  Real-Time Availability at {selectedHospital.name}:
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {selectedHospital.beds.map((b) => (
                    <div
                      key={b.id}
                      className={`p-2.5 border rounded-sm ${
                        b.categoryCode.toUpperCase() === bedCategory.toUpperCase()
                          ? "bg-blue-50 border-blue-300"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="text-[10px] font-mono text-slate-500 uppercase">{b.name}</div>
                      <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                        <span className="text-emerald-700">{b.availableBeds}</span> / {b.totalBeds}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 02. Ambulance Vehicle ID & Patient Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase font-semibold mb-1">
                  02. Ambulance / Vehicle ID
                </label>
                <input
                  type="text"
                  value={ambulanceUnit}
                  onChange={(e) => setAmbulanceUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-slate-900 rounded-sm"
                  placeholder="e.g. 108 EMS Unit-402"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase font-semibold mb-1">
                  03. Patient Reference ID
                </label>
                <input
                  type="text"
                  value={patientRef}
                  onChange={(e) => setPatientRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-slate-900 rounded-sm"
                  placeholder="e.g. PAT-9204"
                  required
                />
              </div>
            </div>

            {/* 03. Required Bed Category & Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase font-semibold mb-1">
                  04. Required Bed Category
                </label>
                <select
                  value={bedCategory}
                  onChange={(e) => setBedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 font-mono text-sm font-semibold focus:outline-none focus:border-slate-900 rounded-sm"
                >
                  <option value="ICU">Intensive Care Unit (ICU)</option>
                  <option value="GENERAL">General Ward</option>
                  <option value="VENTILATOR">Ventilator & Critical Care</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase font-semibold mb-1">
                  05. Number of Beds Required
                </label>
                <input
                  type="number"
                  min="1"
                  max={availableBeds || 1}
                  value={requestedBeds}
                  onChange={(e) => setRequestedBeds(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-slate-900 rounded-sm"
                  required
                />
                <span className="text-[11px] font-mono text-slate-500 block mt-1">
                  Currently available in {bedCategory}: <span className="font-bold text-emerald-700">{availableBeds}</span>
                </span>
              </div>
            </div>

            {/* 04. Current Location Coordinates */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono text-slate-700 uppercase font-semibold">
                  06. Ambulance GPS Coordinates (India)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDetectGPS}
                    disabled={detectingGps}
                    className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white font-mono text-xs rounded-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {detectingGps ? "Acquiring GPS..." : "Detect Ambulance GPS"}
                  </button>
                  <span className="text-[11px] font-mono text-slate-500">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleCityPresetSelect("Mumbai")}
                    className="text-[11px] font-mono text-blue-700 hover:underline"
                  >
                    Mumbai
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCityPresetSelect("New Delhi")}
                    className="text-[11px] font-mono text-blue-700 hover:underline"
                  >
                    Delhi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCityPresetSelect("Bengaluru")}
                    className="text-[11px] font-mono text-blue-700 hover:underline"
                  >
                    Bengaluru
                  </button>
                </div>
              </div>

              {gpsError && (
                <div className="mb-2 text-xs font-mono text-amber-700">
                  Notice: {gpsError}
                </div>
              )}

              <div className="mb-3">
                <DynamicOSMLocationPicker
                  latitude={lat}
                  longitude={lng}
                  onChange={(newLat, newLng) => {
                    setLat(newLat);
                    setLng(newLng);
                  }}
                  className="h-[260px] w-full border border-slate-200 rounded-sm overflow-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 block">Latitude</span>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none rounded-sm"
                    required
                  />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-500 block">Longitude</span>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none rounded-sm"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 05. ETA & Clinical Condition Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 uppercase font-semibold mb-1">
                  07. Travel ETA (Mins)
                </label>
                <input
                  type="number"
                  min="1"
                  value={etaMinutes}
                  onChange={(e) => setEtaMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none rounded-sm"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-mono text-slate-700 uppercase font-semibold mb-1">
                  08. Patient Clinical Condition
                </label>
                <input
                  type="text"
                  value={patientCondition}
                  onChange={(e) => setPatientCondition(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 text-slate-900 text-sm focus:outline-none rounded-sm"
                  placeholder="e.g. Acute Trauma / Cardiac distress"
                  required
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <Link
                href="/find-beds"
                className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-600 hover:text-slate-900 border border-slate-300 rounded-sm"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 rounded-sm transition-colors disabled:opacity-50"
              >
                {submitting ? "Transmitting to Neon..." : "Submit Dispatch Request"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function CreateDispatchRequestPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-mono text-xs text-slate-500">Loading form...</div>}>
      <CreateDispatchContent />
    </Suspense>
  );
}
