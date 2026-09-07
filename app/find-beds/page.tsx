"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { INDIAN_CITIES, calculateDistanceKm, formatDistanceKm, isValidCoordinates, buildGoogleMapsDirectionsUrl, findNearestCity } from "@/lib/geo";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDateTime } from "@/lib/format-date";
import { getDispatcherSessionId } from "@/lib/dispatcher-session";
import { DynamicOSMMapView } from "@/components/map/dynamic-map";
import { useActiveDispatch } from "@/hooks/use-active-dispatch";
import { ActiveDispatchBanner } from "@/components/active-dispatch-banner";
import { SwitchHospitalModal } from "@/components/switch-hospital-modal";
import { RejectedDispatchBanner } from "@/components/rejected-dispatch-banner";
import { ModifyRequestModal } from "@/components/modify-request-modal";

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
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  totalAvailable: number;
  totalBeds: number;
  targetCategoryBeds: number;
  isSuitable: boolean;
  beds: BedCategory[];
}

export default function FindHospitalPage() {
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState<string>("Chennai");
  const [selectedCategory, setSelectedCategory] = useState<string>("ICU");
  const [minBeds, setMinBeds] = useState<string | number>(1);
  const prevMinBedsRef = useRef<number>(1);
  const isFetchingRef = useRef<boolean>(false);

  const [hospitals, setHospitals] = useState<HospitalResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSynced, setLastSynced] = useState<string>("");

  // Ambulance GPS State & Geolocation Lifecycle
  type LocationStatus = "detecting" | "granted" | "denied" | "unavailable" | "timeout" | "manual" | "idle";
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("detecting");
  const [ambulanceCoordinates, setAmbulanceCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState("28.6139");
  const [manualLng, setManualLng] = useState("77.2090");
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [selectedHospitalMapId, setSelectedHospitalMapId] = useState<string | null>(null);

  // Auto-detect user geolocation on initial page load
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      setLocationStatus("detecting");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: Math.round(pos.coords.latitude * 10000) / 10000,
            lng: Math.round(pos.coords.longitude * 10000) / 10000,
          };
          setAmbulanceCoordinates(coords);
          setManualLat(coords.lat.toString());
          setManualLng(coords.lng.toString());
          setLocationStatus("granted");
          setGpsError(null);

          // Proactively sync city dropdown if near a registered city, without restricting search coordinates
          const nearest = findNearestCity(coords.lat, coords.lng);
          if (nearest) {
            setSelectedCity(nearest.name);
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus("denied");
            setGpsError("Location permission denied. Please enable GPS or enter coordinates manually.");
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setLocationStatus("unavailable");
            setGpsError("Ambulance GPS position unavailable. Please enter coordinates manually.");
          } else if (err.code === err.TIMEOUT) {
            setLocationStatus("timeout");
            setGpsError("Ambulance GPS acquisition timed out. Please enter coordinates manually.");
          } else {
            setLocationStatus("unavailable");
            setGpsError(`GPS Error: ${err.message}. Please enter coordinates manually.`);
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLocationStatus("unavailable");
      setGpsError("Geolocation is not supported by your browser environment.");
    }
  }, []);

  // Active Dispatch Hook & Switch Modal State
  const {
    activeDispatch,
    lastRejectedDispatch,
    lastUpdated: activeLastUpdated,
    refresh: refreshActive,
    switchHospital,
    dismissRejectedDispatch,
  } = useActiveDispatch(1000);

  const [isModifyModalOpen, setIsModifyModalOpen] = useState<boolean>(false);
  const [switchTargetHospital, setSwitchTargetHospital] = useState<HospitalResult | null>(null);
  const [switching, setSwitching] = useState<boolean>(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const [dispatchModalHospital, setDispatchModalHospital] = useState<HospitalResult | null>(null);
  const [ambulanceUnit, setAmbulanceUnit] = useState<string>("108 EMS Unit-101");
  const [etaMinutes, setEtaMinutes] = useState<string | number>(12);
  const prevEtaRef = useRef<number>(12);
  const [patientCondition, setPatientCondition] = useState<string>("Acute Respiratory Distress");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dispatchMsg, setDispatchMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Send Dispatch Modal form state
  const [modalCategory, setModalCategory] = useState<string>("ICU");
  const [modalRequestedBeds, setModalRequestedBeds] = useState<string | number>(1);
  const prevModalRequestedBedsRef = useRef<number>(1);

  // Sync category and beds when landing on ?switch=true (Requirement 5 & 6)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("switch=true") && activeDispatch) {
      setSelectedCategory(activeDispatch.bedCategoryCode);
      setMinBeds(activeDispatch.requestedBeds);
      prevMinBedsRef.current = activeDispatch.requestedBeds;
      setTimeout(() => {
        const el = document.getElementById("hospital-results-section");
        el?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, [activeDispatch]);

  const handleConfirmSwitch = async (customParams?: { bedCategoryCode: string; requestedBeds: number }) => {
    if (!switchTargetHospital) return;
    try {
      setSwitching(true);
      setSwitchError(null);
      // Send real latest values from activeDispatch or custom switch parameters
      const res = await switchHospital({
        targetHospitalId: switchTargetHospital.id,
        bedCategoryCode: customParams?.bedCategoryCode || (activeDispatch ? activeDispatch.bedCategoryCode : selectedCategory),
        requestedBeds: customParams?.requestedBeds || (activeDispatch ? activeDispatch.requestedBeds : activeMinBedsNumber),
        etaMinutes: activeDispatch ? activeDispatch.etaMinutes : 15,
        ambulanceLat: ambulanceCoordinates ? ambulanceCoordinates.lat : null,
        ambulanceLng: ambulanceCoordinates ? ambulanceCoordinates.lng : null,
        patientCondition: activeDispatch ? activeDispatch.patientCondition : "Emergency Dispatch Transfer",
        ambulanceUnit: activeDispatch?.ambulanceUnit,
        ambulanceId: activeDispatch?.ambulanceId,
        patientRef: activeDispatch?.patientRef,
        patientReference: activeDispatch?.patientReference,
      });

      if (res.success) {
        setSwitchTargetHospital(null);
        if (res.dispatch?.id) {
          router.push(`/dispatch-requests/${res.dispatch.id}`);
        } else {
          await fetchSuitableHospitals(true);
        }
      } else {
        setSwitchError(res.error || "Failed to switch receiving hospital.");
      }
    } catch (err: any) {
      setSwitchError(err.message || "Failed to switch hospital.");
    } finally {
      setSwitching(false);
    }
  };

  const activeMinBedsNumber =
    minBeds !== "" && !isNaN(Number(minBeds)) && Number(minBeds) >= 1
      ? Number(minBeds)
      : prevMinBedsRef.current || 1;

  const handleDetectGPS = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationStatus("unavailable");
      setGpsError("Geolocation is not supported by your browser environment.");
      return;
    }
    setDetectingGps(true);
    setLocationStatus("detecting");
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: Math.round(pos.coords.latitude * 10000) / 10000,
          lng: Math.round(pos.coords.longitude * 10000) / 10000,
        };
        setAmbulanceCoordinates(coords);
        setManualLat(coords.lat.toString());
        setManualLng(coords.lng.toString());
        setLocationStatus("granted");
        setDetectingGps(false);
        setGpsError(null);
        const nearest = findNearestCity(coords.lat, coords.lng);
        if (nearest) {
          setSelectedCity(nearest.name);
        }
      },
      (err) => {
        setDetectingGps(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus("denied");
          setGpsError("Location permission denied. Please allow location access or enter manual coordinates below.");
        } else if (err.code === err.TIMEOUT) {
          setLocationStatus("timeout");
          setGpsError("Ambulance GPS acquisition timed out. Please enter coordinates below.");
        } else {
          setLocationStatus("unavailable");
          setGpsError(`GPS unavailable (${err.message}). Please enter manual coordinates below.`);
        }
        setShowManualCoords(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleApplyManualCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isValidCoordinates(lat, lng)) {
      setAmbulanceCoordinates({ lat, lng });
      setLocationStatus("manual");
      setGpsError(null);
      const nearest = findNearestCity(lat, lng);
      if (nearest) {
        setSelectedCity(nearest.name);
      }
    } else {
      setGpsError("Invalid coordinates. Latitude (-90 to 90), Longitude (-180 to 180).");
    }
  };

  const handleClearGPS = () => {
    setAmbulanceCoordinates(null);
    setLocationStatus("manual");
    setGpsError(null);
  };

  const fetchSuitableHospitals = async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (!silent) setLoading(true);
      let url = `/api/hospitals/search?category=${selectedCategory}&minBeds=${activeMinBedsNumber}`;
      if (ambulanceCoordinates) {
        // Exact coordinates take absolute precedence for proximity calculation
        url += `&lat=${ambulanceCoordinates.lat}&lng=${ambulanceCoordinates.lng}`;
      } else {
        url += `&city=${encodeURIComponent(selectedCity)}`;
      }
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHospitals(data.hospitals || []);
        setLastSynced(formatDateTime(new Date(), true));
      }
    } catch (err) {
      console.error("Failed to fetch suitable hospitals:", err);
    } finally {
      isFetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // Only search if not in middle of empty backspace state
    if (minBeds !== "") {
      fetchSuitableHospitals();
      const interval = setInterval(() => {
        // Skip background refresh if user is actively filling dispatch or switch forms
        if (!dispatchModalHospital && !switchTargetHospital && !isModifyModalOpen) {
          fetchSuitableHospitals(true);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [selectedCity, selectedCategory, minBeds, ambulanceCoordinates, dispatchModalHospital, switchTargetHospital, isModifyModalOpen]);

  const activeCityData =
    INDIAN_CITIES.find((c) => c.name.toLowerCase() === selectedCity.toLowerCase()) || INDIAN_CITIES[0];
  const suitableHospitals = hospitals.filter((h) => h.isSuitable);
  const unsuitableHospitals = hospitals.filter((h) => !h.isSuitable);

  const handleOpenDispatch = (hosp: HospitalResult) => {
    setDispatchModalHospital(hosp);
    setSelectedHospitalMapId(hosp.id);
    setDispatchMsg(null);
    const initialCategory = selectedCategory !== "ALL" ? selectedCategory : "ICU";
    setModalCategory(initialCategory);
    const initialBeds = activeMinBedsNumber >= 1 ? activeMinBedsNumber : 1;
    setModalRequestedBeds(initialBeds);
    prevModalRequestedBedsRef.current = initialBeds;
  };

  const modalCatBed = dispatchModalHospital?.beds?.find(
    (b) => b.categoryCode.toUpperCase() === modalCategory.toUpperCase()
  );
  const modalMaxAvailableBeds = modalCatBed ? modalCatBed.availableBeds : 0;

  const handleSendDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalHospital) return;

    try {
      setSubmitting(true);
      setDispatchMsg(null);

      const activeEta =
        etaMinutes !== "" && !isNaN(Number(etaMinutes)) && Number(etaMinutes) >= 1
          ? Number(etaMinutes)
          : prevEtaRef.current || 12;

      // Validate beds
      if (modalRequestedBeds !== "") {
        const rawBeds = Number(modalRequestedBeds);
        if (isNaN(rawBeds) || rawBeds < 1) {
          throw new Error("Requested beds count must be at least 1.");
        }
      }

      const finalBeds =
        modalRequestedBeds === "" || isNaN(Number(modalRequestedBeds))
          ? prevModalRequestedBedsRef.current || 1
          : Number(modalRequestedBeds);

      if (finalBeds < 1) {
        throw new Error("Requested beds count must be at least 1.");
      }

      if (modalMaxAvailableBeds > 0 && finalBeds > modalMaxAvailableBeds) {
        throw new Error(
          `Selected hospital only has ${modalMaxAvailableBeds} available ${modalCategory} bed(s). Cannot request ${finalBeds}.`
        );
      }

      const res = await fetch("/api/dispatch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: dispatchModalHospital.id,
          ambulanceUnit,
          ambulanceLat: ambulanceCoordinates ? ambulanceCoordinates.lat : null,
          ambulanceLng: ambulanceCoordinates ? ambulanceCoordinates.lng : null,
          bedCategoryCode: modalCategory,
          requestedBeds: finalBeds,
          etaMinutes: activeEta,
          patientCondition,
          dispatcherSessionId: getDispatcherSessionId(),
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

      await refreshActive();
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* Header */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-40">
        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 min-h-16 py-2.5 sm:py-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm shrink-0">
              BR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] font-mono tracking-tight leading-none">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                Ambulance Dispatcher Console
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5 sm:gap-2 font-mono text-xs overflow-x-auto no-scrollbar py-0.5 max-w-full">
            <Link
              href="/dispatcher"
              className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm transition-colors whitespace-nowrap shrink-0"
            >
              DISPATCHER DASHBOARD
            </Link>
            <Link
              href="/find-beds"
              className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold rounded-sm whitespace-nowrap shrink-0"
            >
              FIND HOSPITAL
            </Link>
            <Link
              href="/dispatcher/history"
              className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm transition-colors whitespace-nowrap shrink-0"
            >
              REQUEST HISTORY
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Persistent Rejected Dispatch Alert Banner */}
      <RejectedDispatchBanner
        rejectedDispatch={lastRejectedDispatch}
        onDismiss={() => {
          if (lastRejectedDispatch) dismissRejectedDispatch(lastRejectedDispatch.id);
        }}
      />

      {/* Persistent Active Dispatch Banner */}
      <ActiveDispatchBanner
        activeDispatch={activeDispatch}
        lastUpdated={activeLastUpdated}
        onModifyClick={() => setIsModifyModalOpen(true)}
        onSwitchClick={() => {
          if (activeDispatch) {
            setSelectedCategory(activeDispatch.bedCategoryCode);
            setMinBeds(activeDispatch.requestedBeds);
            prevMinBedsRef.current = activeDispatch.requestedBeds;
          }
          const el = document.getElementById("hospital-results-section");
          el?.scrollIntoView({ behavior: "smooth" });
        }}
      />

      <main className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-8">
        {/* Location & Capacity Requirement Filter Form */}
        <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm mb-8">
          <div className="border-l-2 border-blue-700 dark:border-blue-500 pl-3 mb-6">
            <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase tracking-widest block">SUITABILITY FILTER</span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-0.5">Find Suitable Inbound Hospitals</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase font-semibold mb-2">
                01. Dispatch Location (India)
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] font-mono text-sm font-semibold focus:outline-none rounded-sm"
              >
                {INDIAN_CITIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}, {c.state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase font-semibold mb-2">
                02. Required Bed Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] font-mono text-sm font-semibold focus:outline-none rounded-sm"
              >
                <option value="ICU">Intensive Care Unit (ICU)</option>
                <option value="GENERAL">General Ward</option>
                <option value="VENTILATOR">Ventilator & Critical Care</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase font-semibold mb-2">
                03. Required Beds Count
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={minBeds}
                onFocus={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val) && val >= 1) {
                    prevMinBedsRef.current = val;
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setMinBeds("");
                    return;
                  }
                  const parsed = parseInt(val, 10);
                  if (!isNaN(parsed)) {
                    setMinBeds(val);
                    if (parsed >= 1) {
                      prevMinBedsRef.current = parsed;
                    }
                  }
                }}
                onBlur={() => {
                  if (minBeds === "" || isNaN(Number(minBeds)) || Number(minBeds) < 1) {
                    setMinBeds(prevMinBedsRef.current || 1);
                  } else {
                    const parsed = Number(minBeds);
                    setMinBeds(parsed);
                    prevMinBedsRef.current = parsed;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-slate-900 dark:text-[#ededed] font-mono text-sm font-semibold focus:outline-none rounded-sm"
              />
            </div>
          </div>

          {/* Ambulance GPS Telemetry & Manual Coordinate Fallback */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#222222]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase text-slate-700 dark:text-[#a1a1a1]">
                  Ambulance Telemetry Origin:
                </span>
                {locationStatus === "detecting" ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 font-mono text-xs font-bold border border-amber-300 dark:border-amber-800/60 rounded-sm animate-pulse">
                    ● ACQUIRING GPS...
                  </span>
                ) : ambulanceCoordinates ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-mono text-xs font-bold border rounded-sm ${
                        locationStatus === "granted"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                          : "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 border-blue-300 dark:border-blue-800/60"
                      }`}
                    >
                      ● {locationStatus === "granted" ? "LIVE GPS" : "MANUAL COORDS"}:{" "}
                      {ambulanceCoordinates.lat.toFixed(4)}, {ambulanceCoordinates.lng.toFixed(4)}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearGPS}
                      className="text-xs text-slate-400 hover:text-red-600 font-mono underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-slate-500 italic">
                    No GPS signal active. Filtered by selected city: {selectedCity}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  disabled={detectingGps}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-mono text-xs font-semibold rounded-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>{detectingGps ? "Acquiring GPS..." : "Detect Ambulance GPS"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualCoords(!showManualCoords)}
                  className="px-3 py-1.5 bg-white dark:bg-[#111111] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] text-slate-700 dark:text-[#ccc] border border-slate-300 dark:border-[#2a2a2a] font-mono text-xs rounded-sm transition-colors cursor-pointer"
                >
                  {showManualCoords ? "Hide Coords" : "Manual Coords"}
                </button>
              </div>
            </div>

            {gpsError && (
              <div className="mt-2 text-xs font-mono text-amber-700 dark:text-amber-400">
                Notice: {gpsError}
              </div>
            )}

            {/* Manual Coordinate Form */}
            {showManualCoords && (
              <form onSubmit={handleApplyManualCoords} className="mt-3 p-3 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm flex flex-wrap items-center gap-3 font-mono text-xs">
                <span className="text-slate-600 dark:text-[#888] uppercase">Set Testing Coordinates:</span>
                <div className="flex items-center gap-1">
                  <span>Lat:</span>
                  <input
                    type="number"
                    step="any"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-24 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-xs"
                    required
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span>Lng:</span>
                  <input
                    type="number"
                    step="any"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    className="w-24 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-xs"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1 bg-slate-900 dark:bg-white text-white dark:text-black font-semibold rounded-sm hover:opacity-90 cursor-pointer"
                >
                  Apply
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Results Section - Split Layout */}
        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-slate-500 dark:text-[#737373] bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm">
            EVALUATING HOSPITAL SUITABILITY & PROXIMITY...
          </div>
        ) : (
          <div id="hospital-results-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 scroll-mt-20">
            {/* Map Column (Sticky on desktop) */}
            <div className="lg:col-span-5 xl:col-span-5">
              <div className="sticky top-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase text-slate-700 dark:text-[#a1a1a1]">
                    PROXIMITY MAP (OSM)
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Click pin to view details
                  </span>
                </div>
                <div className="h-[340px] sm:h-[420px] lg:h-[560px] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden shadow-sm">
                  {(() => {
                    const activeCityData =
                      INDIAN_CITIES.find(
                        (c) => c.name.toLowerCase() === selectedCity.toLowerCase()
                      ) || INDIAN_CITIES[0];
                    const currentUserLocation = ambulanceCoordinates
                      ? {
                          lat: ambulanceCoordinates.lat,
                          lng: ambulanceCoordinates.lng,
                          label: ambulanceUnit
                            ? `${ambulanceUnit} (${locationStatus === "granted" ? "Live GPS" : "Manual Coords"})`
                            : `Ambulance Origin (${ambulanceCoordinates.lat.toFixed(4)}, ${ambulanceCoordinates.lng.toFixed(4)})`,
                          isLiveGPS: locationStatus === "granted",
                        }
                      : {
                          lat: activeCityData.lat,
                          lng: activeCityData.lng,
                          label: `Dispatcher Base (${activeCityData.name})`,
                          isLiveGPS: false,
                        };

                    return (
                      <DynamicOSMMapView
                        userLocation={currentUserLocation}
                        ambulanceLocation={currentUserLocation}
                        hospitals={hospitals
                          .filter((h) => h.latitude !== null && h.longitude !== null)
                          .map((h) => {
                            const catBed = h.beds.find(
                              (b) => b.categoryCode.toUpperCase() === selectedCategory.toUpperCase()
                            );
                            return {
                              id: h.id,
                              name: h.name,
                              latitude: h.latitude!,
                              longitude: h.longitude!,
                              address: h.address,
                              city: h.city,
                              state: h.state,
                              phone: h.phone,
                              distanceKm: h.distanceKm,
                              availableBeds: h.totalAvailable,
                              totalBeds: h.totalBeds,
                              targetCategoryBeds: catBed ? catBed.availableBeds : 0,
                              isSuitable: h.isSuitable,
                              isSelected: selectedHospitalMapId === h.id,
                            };
                          })}
                        center={[currentUserLocation.lat, currentUserLocation.lng]}
                        selectedHospitalId={selectedHospitalMapId}
                        onSelectHospital={(pin) => setSelectedHospitalMapId(pin.id)}
                        onInitiateDispatch={(pin) => {
                          const target = hospitals.find((h) => h.id === pin.id);
                          if (target) handleOpenDispatch(target);
                        }}
                        className="h-full w-full"
                      />
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* List Column */}
            <div className="lg:col-span-7 xl:col-span-7 space-y-6">
              {/* Suitable Hospitals List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">
                    Suitable Hospitals ({suitableHospitals.length})
                  </h2>
                  <span className="text-xs font-mono text-slate-500 dark:text-[#737373]">
                    SORTED BY PROXIMITY (KM)
                  </span>
                </div>

                {suitableHospitals.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm">
                    <div className="text-xs font-mono text-amber-700 dark:text-amber-400 font-bold mb-1">
                      NO SUITABLE FACILITIES FOUND
                    </div>
                    <p className="text-sm text-slate-600 dark:text-[#888888]">
                      No hospitals near {selectedCity} currently have at least {activeMinBedsNumber}{" "}
                      available {selectedCategory} bed(s).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {suitableHospitals.map((hosp) => {
                      const catBed = hosp.beds.find(
                        (b) => b.categoryCode.toUpperCase() === selectedCategory.toUpperCase()
                      );
                      const availCount = catBed ? catBed.availableBeds : 0;
                      const isSelected = selectedHospitalMapId === hosp.id;

                      return (
                        <div
                          key={hosp.id}
                          onClick={() => setSelectedHospitalMapId(hosp.id)}
                          className={`bg-white dark:bg-[#0f0f0f] border rounded-sm p-4 sm:p-5 transition-colors cursor-pointer ${
                            isSelected
                              ? "border-blue-600 dark:border-blue-500 ring-1 ring-blue-500/30"
                              : "border-slate-200 dark:border-[#222222] hover:border-slate-300 dark:hover:border-[#333333]"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1e1e1e] pb-3 mb-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 text-xs font-mono font-bold rounded-sm">
                                  SUITABLE
                                </span>
                                <span className="text-xs text-slate-500 dark:text-[#737373] font-mono">
                                  {hosp.city}, {hosp.state || "India"}
                                </span>
                                {hosp.distanceKm !== null && (
                                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-400 font-mono text-xs font-bold border border-blue-200 dark:border-blue-900/60 rounded-sm">
                                    {formatDistanceKm(hosp.distanceKm)} away
                                  </span>
                                )}
                              </div>
                              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#ededed] mt-1 break-words">
                                {hosp.name}
                              </h3>
                              <p className="text-xs text-slate-600 dark:text-[#888888] font-mono mt-0.5 break-words">
                                <span>{hosp.address}</span>
                                {hosp.phone && (
                                  <>
                                    <span className="mx-1.5 text-slate-400 dark:text-[#555]">•</span>
                                    <span className="inline-block whitespace-nowrap">
                                      Ph.: <span className="font-bold text-slate-900 dark:text-[#ededed]">{hosp.phone}</span>
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between sm:justify-end gap-2 sm:gap-3 pt-2 sm:pt-0 border-t border-slate-100 sm:border-t-0 dark:border-[#1e1e1e]">
                              <div className="text-left sm:text-right">
                                <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-[#737373] uppercase">
                                  {selectedCategory}
                                </div>
                                <div className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono leading-tight">
                                  {availCount}{" "}
                                  <span className="text-xs font-normal text-slate-500">
                                    / {catBed ? catBed.totalBeds : 0}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                                {hosp.latitude !== null && hosp.longitude !== null && (
                                  <a
                                    href={buildGoogleMapsDirectionsUrl({
                                      lat: hosp.latitude,
                                      lng: hosp.longitude,
                                      name: hosp.name,
                                      address: hosp.address,
                                      city: hosp.city,
                                    })}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 sm:flex-none px-2.5 py-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900/60 rounded-xs transition-colors text-center inline-flex items-center justify-center gap-1 cursor-pointer"
                                    title="Open driving directions in Google Maps"
                                  >
                                    <span>GET DIRECTIONS</span>
                                    <span className="text-[10px]">↗</span>
                                  </a>
                                )}

                                {activeDispatch && activeDispatch.hospitalId === hosp.id ? (
                                  <>
                                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-mono text-[10px] font-bold border border-blue-300 dark:border-blue-800 rounded-xs">
                                      CURRENT REQUEST
                                    </span>
                                    <Link
                                      href={`/dispatch-requests/${activeDispatch.id}`}
                                      className="flex-1 sm:flex-none px-2.5 py-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ccc] bg-slate-100 hover:bg-slate-200 dark:bg-[#1f1f1f] dark:hover:bg-[#2a2a2a] border border-slate-300 dark:border-[#333] rounded-xs transition-colors text-center"
                                    >
                                      VIEW REQUEST
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsModifyModalOpen(true);
                                      }}
                                      className="flex-1 sm:flex-none px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer text-center shadow-xs bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
                                    >
                                      MODIFY REQUEST
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedHospitalMapId(hosp.id);
                                      }}
                                      className="flex-1 sm:flex-none px-2.5 py-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ccc] bg-slate-100 hover:bg-slate-200 dark:bg-[#1f1f1f] dark:hover:bg-[#2a2a2a] border border-slate-300 dark:border-[#333] rounded-xs transition-colors cursor-pointer text-center"
                                    >
                                      VIEW HOSPITAL
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (activeDispatch) {
                                          setSwitchTargetHospital(hosp);
                                        } else {
                                          handleOpenDispatch(hosp);
                                        }
                                      }}
                                      className={`flex-1 sm:flex-none px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-wider rounded-xs transition-colors cursor-pointer text-center shadow-xs ${
                                        activeDispatch
                                          ? "bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-slate-950 dark:text-black font-bold border border-amber-600 dark:border-amber-500"
                                          : "text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                                      }`}
                                    >
                                      {activeDispatch ? "SWITCH TO THIS HOSPITAL" : "SEND REQUEST"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Bed Categories breakdown */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {hosp.beds.map((b) => (
                              <div
                                key={b.id}
                                className="p-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-sm text-xs font-mono"
                              >
                                <div className="text-slate-500 dark:text-[#737373] uppercase text-[10px] truncate">
                                  {b.name}
                                </div>
                                <div className="text-xs font-bold text-slate-900 dark:text-[#ededed] mt-0.5">
                                  <span className="text-emerald-700 dark:text-emerald-400">
                                    {b.availableBeds}
                                  </span>{" "}
                                  / {b.totalBeds}
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

              {/* Unsuitable Hospitals List */}
              {unsuitableHospitals.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-[#222222]">
                  <h3 className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase font-bold mb-3">
                    Nearby Hospitals with Insufficient {selectedCategory} Beds ({unsuitableHospitals.length})
                  </h3>
                  <div className="space-y-2">
                    {unsuitableHospitals.map((hosp) => {
                      const catBed = hosp.beds.find(
                        (b) => b.categoryCode.toUpperCase() === selectedCategory.toUpperCase()
                      );
                      const availCount = catBed ? catBed.availableBeds : 0;
                      const totalCount = catBed ? catBed.totalBeds : 0;

                      return (
                        <div
                          key={hosp.id}
                          onClick={() => setSelectedHospitalMapId(hosp.id)}
                          className="bg-white dark:bg-[#0f0f0f] p-3 border border-slate-200 dark:border-[#222222] rounded-sm flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-[#333333]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 text-[10px] font-mono font-bold border border-amber-200 dark:border-amber-900/60 rounded-sm">
                              {availCount}/{totalCount} {selectedCategory}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-[#ededed]">
                              {hosp.name}
                            </span>
                            {hosp.distanceKm !== null && (
                              <span className="text-[11px] font-mono text-slate-400 dark:text-[#666]">
                                • {formatDistanceKm(hosp.distanceKm)}
                              </span>
                            )}
                            {hosp.latitude !== null && hosp.longitude !== null && (
                              <a
                                href={buildGoogleMapsDirectionsUrl({
                                  lat: hosp.latitude,
                                  lng: hosp.longitude,
                                  name: hosp.name,
                                  address: hosp.address,
                                  city: hosp.city,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 ml-1"
                                title="Open driving directions in Google Maps"
                              >
                                Directions ↗
                              </a>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-[#737373]">
                            Need {activeMinBedsNumber}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Send Dispatch Modal */}
      {dispatchModalHospital && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f0f0f] max-w-lg w-full border border-slate-300 dark:border-[#2a2a2a] shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-semibold block">SEND DISPATCH REQUEST</span>
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

            <form onSubmit={handleSendDispatch} className="space-y-4">
              {/* Telemetry & Proximity Route Summary */}
              <div className="p-3 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-sm space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 uppercase">Ambulance Origin:</span>
                  <span className="font-semibold text-slate-800 dark:text-[#ededed]">
                    {ambulanceCoordinates
                      ? `${ambulanceCoordinates.lat.toFixed(4)}, ${ambulanceCoordinates.lng.toFixed(4)} (${locationStatus === "granted" ? "Live GPS" : "Manual"})`
                      : `City Center (${selectedCity})`}
                  </span>
                </div>
                {dispatchModalHospital.distanceKm !== null && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-[#222222]">
                    <span className="text-blue-700 dark:text-blue-400 font-semibold uppercase">Straight-Line Distance:</span>
                    <span className="font-bold text-blue-900 dark:text-blue-300">
                      {formatDistanceKm(dispatchModalHospital.distanceKm)}
                    </span>
                  </div>
                )}
                {dispatchModalHospital.latitude !== null && dispatchModalHospital.longitude !== null && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-[#222222]">
                    <span className="text-slate-500 uppercase">Turn-by-Turn Navigation:</span>
                    <a
                      href={buildGoogleMapsDirectionsUrl({
                        lat: dispatchModalHospital.latitude,
                        lng: dispatchModalHospital.longitude,
                        name: dispatchModalHospital.name,
                        address: dispatchModalHospital.address,
                        city: dispatchModalHospital.city,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Google Maps Directions</span>
                      <span>↗</span>
                    </a>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">AMBULANCE UNIT IDENTIFIER</label>
                <input
                  type="text"
                  value={ambulanceUnit}
                  onChange={(e) => setAmbulanceUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] font-mono text-sm focus:outline-none rounded-sm"
                  placeholder="e.g. 108 EMS Unit-101"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">
                    CATEGORY
                  </label>
                  <select
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] font-mono text-sm focus:outline-none rounded-sm"
                  >
                    <option value="ICU">ICU (Intensive Care)</option>
                    <option value="GENERAL">General Ward</option>
                    <option value="VENTILATOR">Ventilator Care</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase">
                      REQUESTED BEDS
                    </label>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-[#737373]">
                      Max: <strong className="text-emerald-700 dark:text-emerald-400">{modalMaxAvailableBeds}</strong>
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={modalMaxAvailableBeds > 0 ? modalMaxAvailableBeds : undefined}
                    value={modalRequestedBeds}
                    onFocus={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val >= 1) prevModalRequestedBedsRef.current = val;
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setModalRequestedBeds("");
                        return;
                      }
                      const parsed = parseInt(val, 10);
                      if (!isNaN(parsed)) {
                        setModalRequestedBeds(val);
                        if (parsed >= 1) prevModalRequestedBedsRef.current = parsed;
                      }
                    }}
                    onBlur={() => {
                      if (modalRequestedBeds === "" || isNaN(Number(modalRequestedBeds)) || Number(modalRequestedBeds) < 1) {
                        setModalRequestedBeds(prevModalRequestedBedsRef.current || 1);
                      } else {
                        const parsed = Number(modalRequestedBeds);
                        setModalRequestedBeds(parsed);
                        prevModalRequestedBedsRef.current = parsed;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] font-mono text-sm focus:outline-none rounded-sm"
                    required
                  />
                  <span className="text-[11px] font-mono text-slate-500 dark:text-[#737373] block mt-1">
                    Available in {modalCategory}: <span className="font-bold text-emerald-700 dark:text-emerald-400">{modalMaxAvailableBeds}</span>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">ESTIMATED TRAVEL ETA (MINUTES)</label>
                <input
                  type="number"
                  min="1"
                  value={etaMinutes}
                  onFocus={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val >= 1) prevEtaRef.current = val;
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setEtaMinutes("");
                      return;
                    }
                    const num = parseInt(val, 10);
                    if (!isNaN(num)) {
                      setEtaMinutes(val);
                      if (num >= 1) prevEtaRef.current = num;
                    }
                  }}
                  onBlur={() => {
                    if (etaMinutes === "" || isNaN(Number(etaMinutes)) || Number(etaMinutes) < 1) {
                      setEtaMinutes(prevEtaRef.current || 12);
                    } else {
                      const num = Number(etaMinutes);
                      setEtaMinutes(num);
                      prevEtaRef.current = num;
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
                <label className="block text-xs font-mono text-slate-700 dark:text-[#a1a1a1] uppercase mb-1">PATIENT CLINICAL CONDITION & NOTES</label>
                <textarea
                  value={patientCondition}
                  onChange={(e) => setPatientCondition(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#ededed] text-sm focus:outline-none rounded-sm"
                  required
                ></textarea>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-200 dark:border-[#222222]">
                <button
                  type="button"
                  onClick={() => setDispatchModalHospital(null)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold uppercase text-slate-600 dark:text-[#a1a1a1] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-colors disabled:opacity-50 cursor-pointer text-center"
                >
                  {submitting ? "Transmitting..." : "Send Request to Hospital"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Switch Receiving Hospital Modal */}
      <SwitchHospitalModal
        isOpen={Boolean(switchTargetHospital)}
        onClose={() => {
          setSwitchTargetHospital(null);
          setSwitchError(null);
        }}
        currentDispatch={activeDispatch}
        targetHospital={switchTargetHospital}
        onConfirmSwitch={handleConfirmSwitch}
        isSubmitting={switching}
        error={switchError}
      />

      {/* Modify Active Dispatch Modal */}
      <ModifyRequestModal
        isOpen={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
        dispatch={activeDispatch}
        hospitalBeds={activeDispatch?.hospitalBeds}
        onSuccess={() => {
          refreshActive();
          fetchSuitableHospitals(true);
        }}
      />
    </div>
  );
}
