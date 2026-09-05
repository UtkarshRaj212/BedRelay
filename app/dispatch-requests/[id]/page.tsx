"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format-date";
import { formatDistanceKm } from "@/lib/geo";
import { ThemeToggle } from "@/components/theme-toggle";
import { DynamicOSMMapView } from "@/components/map/dynamic-map";

interface DispatchDetails {
  id: string;
  hospitalId: string;
  ambulanceUnit: string;
  ambulanceLat: number | null;
  ambulanceLng: number | null;
  patientRef: string | null;
  bedCategoryCode: string;
  requestedBeds: number;
  etaMinutes: number;
  patientCondition: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface HospitalDetails {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
}

export default function DispatchRequestDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [dispatch, setDispatch] = useState<DispatchDetails | null>(null);
  const [hospital, setHospital] = useState<HospitalDetails | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string>("");

  const [cancelling, setCancelling] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  const fetchDetails = async () => {
    try {
      const res = await fetch(`/api/dispatch-requests/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDispatch(data.dispatch);
        setHospital(data.hospital);
        setDistanceKm(data.distanceKm);
        setLastSynced(new Date().toLocaleTimeString());
        setErrorMsg(null);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || "Dispatch request not found");
      }
    } catch (err) {
      console.error("Failed to fetch request details:", err);
      setErrorMsg("Network error loading request details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    const interval = setInterval(fetchDetails, 5000); // Auto-refresh status every 5 seconds
    return () => clearInterval(interval);
  }, [id]);

  const handleCancelRequest = async () => {
    if (!dispatch || dispatch.status !== "PENDING") return;
    if (!confirm("Are you sure you want to cancel this pending dispatch request?")) return;

    try {
      setCancelling(true);
      setCancelFeedback(null);

      const res = await fetch(`/api/dispatch-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel request");
      }

      setCancelFeedback("Dispatch request cancelled successfully.");
      await fetchDetails();
    } catch (err: any) {
      setCancelFeedback(err.message || "Failed to cancel request.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-sm text-slate-600">
        LOADING DISPATCH REQUEST TELEMETRY...
      </div>
    );
  }

  if (errorMsg || !dispatch) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex items-center justify-center p-4">
        <div className="bg-white p-8 border border-slate-200 rounded-sm max-w-md w-full text-center">
          <div className="text-xs font-mono text-red-700 font-bold uppercase mb-2">ERROR</div>
          <h1 className="text-xl font-bold text-slate-900">{errorMsg || "Request Not Found"}</h1>
          <p className="mt-2 text-sm text-slate-600">
            The requested dispatch request ID could not be located in the Neon database.
          </p>
          <Link
            href="/dispatcher"
            className="mt-6 inline-block w-full text-center px-4 py-2 bg-slate-900 text-white font-semibold text-sm rounded-sm"
          >
            Return to Dispatcher Dashboard
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
          <span>LIVE REQUEST TRACKING CONSOLE</span>
          <span className="text-slate-500 dark:text-[#555]">|</span>
          <span className="text-slate-300 dark:text-[#888]">AUTO-REFRESH ACTIVE (EVERY 5S)</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400 dark:text-[#888] text-[11px] font-mono">
          <span>LAST SYNCED: {lastSynced}</span>
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
                Dispatch Request Details
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3 font-mono text-xs">
            <Link
              href="/dispatcher"
              className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm"
            >
              DISPATCHER DASHBOARD
            </Link>
            <Link
              href="/find-beds"
              className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm"
            >
              FIND HOSPITAL
            </Link>
            <Link
              href="/dispatcher/history"
              className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm"
            >
              REQUEST HISTORY
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Status & Header Banner */}
        <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">REQUEST ID: {dispatch.id}</span>
              <span className="text-slate-300 dark:text-[#333]">|</span>
              <span className="text-xs font-mono text-slate-500 dark:text-[#737373]">
                TRANSMITTED: {formatDateTime(dispatch.createdAt, true)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">
              Ambulance Pre-Arrival Dispatch Alert
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right font-mono">
              <div className="text-[10px] text-slate-500 dark:text-[#737373] uppercase font-semibold">CURRENT LIVE STATUS</div>
              <span
                className={`inline-block px-3 py-1 text-sm font-bold border rounded-sm mt-0.5 ${
                  dispatch.status === "ACCEPTED"
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                    : dispatch.status === "REJECTED"
                    ? "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800/60"
                    : dispatch.status === "CANCELLED"
                    ? "bg-slate-200 dark:bg-[#1f1f1f] text-slate-800 dark:text-[#aaa] border-slate-400 dark:border-[#333]"
                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/60"
                }`}
              >
                {dispatch.status}
              </span>
            </div>
          </div>
        </div>

        {cancelFeedback && (
          <div className="p-4 mb-6 bg-slate-100 dark:bg-[#141414] border border-slate-300 dark:border-[#222222] text-slate-800 dark:text-[#ededed] text-xs font-mono rounded-sm">
            {cancelFeedback}
          </div>
        )}

        {/* OpenStreetMap Live Dispatch Route & Telemetry Card */}
        {hospital?.latitude !== null && hospital?.latitude !== undefined && hospital?.longitude !== null && hospital?.longitude !== undefined && (
          <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm p-5 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-[#1e1e1e]">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-bold block">
                  LIVE ROUTE TELEMETRY (OPENSTREETMAP)
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed]">
                  {dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null
                    ? `Vector Route: ${dispatch.ambulanceUnit} → ${hospital.name}`
                    : `Destination Facility: ${hospital.name}`}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {distanceKm !== null && (
                  <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-mono text-xs font-bold border border-blue-200 dark:border-blue-900/60 rounded-sm">
                    {formatDistanceKm(distanceKm)} straight-line
                  </span>
                )}
                <span className="px-2 py-1 bg-slate-100 dark:bg-[#1a1a1a] text-slate-700 dark:text-[#aaa] font-mono text-xs font-semibold rounded-sm">
                  ETA: ~{dispatch.etaMinutes} min
                </span>
              </div>
            </div>

            {/* Map Container */}
            <div className="h-[360px] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden">
              <DynamicOSMMapView
                ambulanceLocation={
                  dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null
                    ? {
                        lat: dispatch.ambulanceLat,
                        lng: dispatch.ambulanceLng,
                        unitId: dispatch.ambulanceUnit,
                        condition: dispatch.patientCondition,
                      }
                    : null
                }
                hospitals={[
                  {
                    id: hospital.id,
                    name: hospital.name,
                    latitude: hospital.latitude,
                    longitude: hospital.longitude,
                    address: hospital.address,
                    city: hospital.city,
                    state: hospital.state,
                    phone: hospital.phone,
                    distanceKm: distanceKm,
                    availableBeds: 1,
                    isSuitable: true,
                    isSelected: true,
                  },
                ]}
                center={[hospital.latitude, hospital.longitude]}
                showRoute={dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null}
                className="h-full w-full"
              />
            </div>

            {/* Origin & Destination Coordinates Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-[#1e1e1e] font-mono text-xs">
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-sm">
                <span className="text-slate-500 uppercase">Ambulance Origin:</span>
                <span className="font-bold text-slate-800 dark:text-[#ededed]">
                  {dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null
                    ? `${dispatch.ambulanceLat}, ${dispatch.ambulanceLng}`
                    : "No GPS reported"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-sm">
                <span className="text-slate-500 uppercase">Hospital Destination:</span>
                <span className="font-bold text-slate-800 dark:text-[#ededed]">
                  {hospital.latitude.toFixed(4)}, {hospital.longitude.toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Ambulance & Patient Section */}
          <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-bold">01. AMBULANCE & PATIENT</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Vehicle & Patient Ref</h2>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Ambulance / Vehicle ID:</span>
                <span className="font-bold text-slate-900 dark:text-[#ededed] font-mono">{dispatch.ambulanceUnit}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Patient Reference:</span>
                <span className="font-bold text-slate-900 dark:text-[#ededed] font-mono">{dispatch.patientRef || "—"}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Clinical Condition:</span>
                <span className="font-medium text-slate-900 dark:text-[#ededed]">{dispatch.patientCondition}</span>
              </div>

              {dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null && (
                <div className="flex justify-between">
                  <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">GPS Coordinates:</span>
                  <span className="font-mono text-xs text-slate-800 dark:text-[#ededed]">
                    {dispatch.ambulanceLat}, {dispatch.ambulanceLng}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Hospital & Location Section */}
          <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-bold">02. DESTINATION HOSPITAL</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">{hospital?.name || "Target Hospital"}</h2>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Location / City:</span>
                <span className="font-semibold text-slate-900 dark:text-[#ededed]">
                  {hospital?.city}, {hospital?.state || "India"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Address:</span>
                <span className="text-xs font-medium text-slate-800 dark:text-[#bbb] text-right max-w-xs">{hospital?.address}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Contact Phone:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-[#ededed]">{hospital?.phone}</span>
              </div>

              {distanceKm !== null && (
                <div className="flex justify-between border-t border-slate-100 dark:border-[#1e1e1e] pt-2">
                  <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Calculated Proximity:</span>
                  <span className="font-bold font-mono text-blue-700 dark:text-blue-400">{formatDistanceKm(distanceKm)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Telemetry Requirement Section */}
          <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-bold">03. CAPACITY REQUIREMENT</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Requested Beds & Category</h2>
            </div>

            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500 dark:text-[#737373] uppercase">Required Bed Category:</span>
                <span className="font-bold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 border border-blue-200 dark:border-blue-900/60 rounded-sm">
                  {dispatch.bedCategoryCode}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-xs text-slate-500 dark:text-[#737373] uppercase">Number of Beds Requested:</span>
                <span className="font-bold text-slate-900 dark:text-[#ededed]">{dispatch.requestedBeds} Bed(s)</span>
              </div>

              <div className="flex justify-between">
                <span className="text-xs text-slate-500 dark:text-[#737373] uppercase">Estimated Travel ETA:</span>
                <span className="font-bold text-slate-900 dark:text-[#ededed]">{dispatch.etaMinutes} Minutes</span>
              </div>
            </div>
          </div>

          {/* Timeline & Actions Section */}
          <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-bold">04. TIMELINE & ACTIONS</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Telemetry Log</h2>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#737373] uppercase">Created Timestamp:</span>
                <span className="text-slate-900 dark:text-[#ededed]">{formatDateTime(dispatch.createdAt, true)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#737373] uppercase">Last Status Update:</span>
                <span className="text-slate-900 dark:text-[#ededed]">{formatDateTime(dispatch.updatedAt, true)}</span>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-[#222222] flex items-center justify-between">
                {dispatch.status === "PENDING" ? (
                  <button
                    onClick={handleCancelRequest}
                    disabled={cancelling}
                    className="w-full py-2.5 px-4 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {cancelling ? "Cancelling Request..." : "Cancel Pending Dispatch Request"}
                  </button>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-[#737373] font-mono">
                    Status locked ({dispatch.status}). No cancellation available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
