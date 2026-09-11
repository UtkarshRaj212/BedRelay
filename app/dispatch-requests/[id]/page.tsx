"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format-date";
import { formatDistanceKm, buildGoogleMapsDirectionsUrl } from "@/lib/geo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useActiveDispatch } from "@/hooks/use-active-dispatch";
import { DynamicOSMMapView } from "@/components/map/dynamic-map";
import { RequestTimeline } from "@/components/request-timeline";
import { ModifyRequestModal } from "@/components/modify-request-modal";

interface DispatchDetails {
  id: string;
  hospitalId: string;
  hospitalName?: string;
  ambulanceUnit: string;
  ambulanceLat: number | null;
  ambulanceLng: number | null;
  patientRef?: string;
  bedCategoryCode: string;
  requestedBeds: number;
  approvedBeds?: number | null;
  reviewRequired?: boolean;
  reviewReason?: string | null;
  rejectionReason?: string | null;
  etaMinutes: number;
  patientCondition: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
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

export default function DispatchRequestTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [dispatch, setDispatch] = useState<DispatchDetails | null>(null);
  const [hospital, setHospital] = useState<any>(null);
  const [hospitalBeds, setHospitalBeds] = useState<any[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string>("");

  const [cancelling, setCancelling] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);
  const [isModifyOpen, setIsModifyOpen] = useState(false);
  const isFetchingRef = useRef(false);

  // Auto-open modify modal if URL has ?modify=true
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("modify=true")) {
      setIsModifyOpen(true);
    }
  }, []);

  // Active Dispatch Hook
  const {
    activeDispatch,
    lastUpdated: activeLastUpdated,
    refresh: refreshActive,
  } = useActiveDispatch(1000);

  const fetchDetails = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await fetch(`/api/dispatch-requests/${id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDispatch(data.dispatch);
        setHospital(data.hospital);
        setHospitalBeds(data.beds || []);
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
      isFetchingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    const interval = setInterval(fetchDetails, 1000); // Auto-refresh status every 1 second
    return () => clearInterval(interval);
  }, [id]);

  const handleCancelRequest = async () => {
    if (!dispatch) return;
    const isAccepted = dispatch.status.toUpperCase() === "ACCEPTED";
    const promptMsg = isAccepted
      ? "CRITICAL: This dispatch request has already been ACCEPTED by the receiving hospital. Cancelling will immediately forfeit the reserved bed. Are you sure you want to cancel?"
      : "Are you sure you want to cancel this active dispatch request?";

    if (!confirm(promptMsg)) return;

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
      await refreshActive();
    } catch (err: any) {
      setCancelFeedback(err.message || "Failed to cancel request.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased flex flex-col items-center justify-center font-mono text-sm p-4 transition-colors duration-150">
        <div className="w-10 h-10 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm shadow-md mb-4">
          BR
        </div>
        <div className="text-xs text-slate-600 dark:text-[#888888]">
          Loading request details...
        </div>
      </div>
    );
  }

  if (errorMsg || !dispatch) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased flex flex-col items-center justify-center p-4 transition-colors duration-150">
        <div className="bg-white dark:bg-[#0f0f0f] p-8 border border-slate-200 dark:border-[#222222] rounded-sm max-w-md w-full text-center shadow-sm">
          <div className="text-xs font-mono text-red-700 dark:text-red-400 font-bold uppercase mb-2">ERROR</div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#ededed]">{errorMsg || "Request Not Found"}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-[#888888]">
            {errorMsg?.includes("Forbidden")
              ? "Access denied. Ensure you are authorized for this facility or viewing as the originating ambulance dispatcher."
              : "The requested dispatch request ID could not be located in the database."}
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={() => {
                setErrorMsg(null);
                setLoading(true);
                fetchDetails();
              }}
              className="w-full text-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-sm transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
            <Link
              href="/dispatch-requests/new"
              className="w-full text-center px-4 py-2.5 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold text-sm rounded-sm transition-colors"
            >
              New Dispatch & Recent Requests
            </Link>
            <Link
              href="/dispatcher"
              className="w-full text-center px-4 py-2 border border-slate-300 dark:border-[#333333] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] text-slate-700 dark:text-[#888888] font-medium text-xs rounded-sm transition-colors"
            >
              Return to Dispatcher Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
                Dispatch Request Details
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5 sm:gap-2 font-mono text-xs overflow-x-auto no-scrollbar py-0.5 max-w-full">
            <Link
              href="/dispatcher"
              className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm whitespace-nowrap shrink-0"
            >
              DISPATCHER DASHBOARD
            </Link>
            <Link
              href="/find-beds"
              className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm whitespace-nowrap shrink-0"
            >
              FIND HOSPITAL
            </Link>
            <Link
              href="/dispatcher/history"
              className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm whitespace-nowrap shrink-0"
            >
              REQUEST HISTORY
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="w-full max-w-7xl 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-6 sm:py-8">
        {/* Top Header Row with BACK Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-mono text-slate-500 dark:text-[#888888] uppercase tracking-wider">
            Telemetry Feed / Request {dispatch.id}
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/find-beds");
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-white dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-900 dark:text-[#ededed] border border-slate-300 dark:border-[#333333] rounded-xs transition-colors cursor-pointer shadow-2xs"
          >
            ← BACK
          </button>
        </div>

        {/* Dedicated Operational Action Section */}
        <div className="bg-white dark:bg-[#0f0f0f] border-2 border-slate-300 dark:border-[#2a2a2a] p-4 sm:p-6 rounded-xs mb-6 font-sans shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-xs border ${
                    dispatch.status === "ACCEPTED"
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                      : dispatch.status === "EXPIRED"
                      ? "bg-slate-200 dark:bg-[#1a1a1a] text-slate-700 dark:text-[#999] border-slate-300 dark:border-[#333]"
                      : dispatch.status === "REJECTED"
                      ? "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800/60"
                      : dispatch.status === "CANCELLED"
                      ? "bg-slate-200 dark:bg-[#1f1f1f] text-slate-800 dark:text-[#aaa] border-slate-400 dark:border-[#333]"
                      : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/60"
                  }`}
                >
                  {dispatch.status}
                </span>

                {dispatch.reviewRequired && (
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-xs border bg-amber-50 dark:bg-[#1a1708] text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60">
                    REVIEW REQUIRED
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#ededed] break-words">
                {hospital?.name || "Target Receiving Facility"}
              </h2>
              {hospital?.address && (
                <p className="text-xs text-slate-600 dark:text-[#888888] font-mono mt-0.5 break-words">
                  {hospital.address}{hospital.city ? `, ${hospital.city}` : ""}
                </p>
              )}

              <div className="text-xs font-mono text-slate-700 dark:text-[#bbb] mt-2 flex flex-wrap items-center gap-2">
                <span className="font-bold text-blue-700 dark:text-blue-400">{dispatch.bedCategoryCode}</span>
                <span>·</span>
                <span>
                  {dispatch.requestedBeds} {dispatch.requestedBeds === 1 ? "bed" : "beds"}
                  {dispatch.approvedBeds !== undefined && dispatch.approvedBeds !== null && dispatch.approvedBeds < dispatch.requestedBeds && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold ml-1.5">
                      ({dispatch.approvedBeds} approved · {dispatch.requestedBeds - dispatch.approvedBeds} pending review)
                    </span>
                  )}
                </span>
                {distanceKm !== null && (
                  <>
                    <span>·</span>
                    <span>Distance: {formatDistanceKm(distanceKm)}</span>
                  </>
                )}
              </div>
            </div>

            {["PENDING", "SENT", "ACCEPTED"].includes(dispatch.status.toUpperCase()) && (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-t-0 dark:border-[#1e1e1e]">
                <button
                  type="button"
                  onClick={() => setIsModifyOpen(true)}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-center text-xs font-mono font-bold uppercase tracking-wider bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xs transition-colors cursor-pointer"
                >
                  MODIFY REQUEST
                </button>
                <Link
                  href="/find-beds?switch=true"
                  className="flex-1 sm:flex-none px-4 py-2.5 text-center text-xs font-mono font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-slate-950 dark:text-black border border-amber-600 dark:border-amber-500 rounded-xs transition-colors"
                >
                  SWITCH HOSPITAL
                </Link>
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  disabled={cancelling}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-center text-xs font-mono font-bold uppercase tracking-wider bg-white dark:bg-[#1a1a1a] hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/60 rounded-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {cancelling ? "CANCELLING..." : "CANCEL REQUEST"}
                </button>
                {hospital?.latitude && hospital?.longitude && (
                  <a
                    href={buildGoogleMapsDirectionsUrl({
                      lat: hospital.latitude,
                      lng: hospital.longitude,
                      name: hospital.name,
                      address: hospital.address,
                      city: hospital.city,
                      origin:
                        dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null
                          ? { lat: dispatch.ambulanceLat, lng: dispatch.ambulanceLng }
                          : undefined,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none px-4 py-2.5 text-center text-xs font-mono font-bold uppercase tracking-wider bg-white dark:bg-[#181818] hover:bg-blue-50 dark:hover:bg-[#202020] text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-900/60 rounded-xs transition-colors inline-flex items-center justify-center gap-1.5 shadow-2xs"
                    title="Open driving directions in Google Maps (new tab)"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span>GET DIRECTIONS ↗</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {dispatch.reviewRequired && dispatch.reviewReason && (
            <div className="mt-3 p-3 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] rounded-xs text-xs font-mono text-slate-700 dark:text-[#ccc]">
              <span className="font-semibold uppercase block mb-0.5 text-slate-900 dark:text-[#ededed]">Hospital Review Pending:</span>
              {dispatch.reviewReason}
            </div>
          )}

          {dispatch.status === "REJECTED" && dispatch.rejectionReason && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/60 rounded-xs text-xs font-mono text-red-900 dark:text-red-300">
              <span className="font-bold uppercase block mb-0.5">Rejection Reason:</span>
              {dispatch.rejectionReason}
            </div>
          )}

          {dispatch.status === "ACCEPTED" && (
            <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 rounded-xs text-[11px] font-mono text-emerald-900 dark:text-emerald-300">
              Bed capacity confirmed and reserved by hospital. Switching or cancelling will release this reservation.
            </div>
          )}

          {dispatch.status === "EXPIRED" && (
            <div className="mt-3 p-3 bg-slate-100 dark:bg-[#151515] border-l-4 border-slate-400 dark:border-slate-600 rounded-xs text-xs font-mono text-slate-700 dark:text-[#aaa]">
              <span className="font-bold uppercase block mb-0.5 text-slate-900 dark:text-[#eee]">REQUEST EXPIRED</span>
              Required hospital approval or review was not received within the allowed time threshold.
            </div>
          )}

          {!["PENDING", "SENT", "ACCEPTED"].includes(dispatch.status.toUpperCase()) && (
            <div className="mt-2 text-xs font-mono text-slate-500 dark:text-[#777]">
              Status locked ({dispatch.status}). No active actions available.
            </div>
          )}
        </div>

        {/* Main Status & Header Banner */}
        <div className="bg-white dark:bg-[#0f0f0f] p-4 sm:p-6 border border-slate-200 dark:border-[#222222] rounded-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase break-all">
                ID: {dispatch.id}
              </span>
              <span className="text-slate-300 dark:text-[#333] hidden sm:inline">|</span>
              <span className="text-xs font-mono text-slate-500 dark:text-[#737373]">
                {formatDateTime(dispatch.createdAt, true)}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1 break-words">
              Ambulance Pre-Arrival Dispatch Alert
            </h1>
          </div>

          <div className="flex items-center gap-4 self-start sm:self-auto shrink-0">
            <div className="text-left sm:text-right font-mono">
              <div className="text-[10px] text-slate-500 dark:text-[#737373] uppercase font-semibold">STATUS</div>
              <span
                className={`inline-block px-3 py-1 text-sm font-bold border rounded-sm mt-0.5 ${
                  dispatch.status === "ACCEPTED"
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                    : dispatch.status === "EXPIRED"
                    ? "bg-slate-200 dark:bg-[#1a1a1a] text-slate-700 dark:text-[#999] border-slate-300 dark:border-[#333]"
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
          <div className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] rounded-sm p-4 sm:p-5 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-[#1e1e1e]">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-bold block">
                  ROUTE OVERVIEW (OPENSTREETMAP)
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed] break-words">
                  {dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null
                    ? `Vector Route: ${dispatch.ambulanceUnit} → ${hospital.name}`
                    : `Destination Facility: ${hospital.name}`}
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
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
            <div className="h-[240px] sm:h-[320px] md:h-[360px] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden">
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-sm">
                <span className="text-slate-500 uppercase shrink-0">Ambulance Origin:</span>
                <span className="font-bold text-slate-800 dark:text-[#ededed] break-all">
                  {dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null
                    ? `${dispatch.ambulanceLat}, ${dispatch.ambulanceLng}`
                    : "No GPS reported"}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-sm">
                <span className="text-slate-500 uppercase shrink-0">Hospital Destination:</span>
                <span className="font-bold text-slate-800 dark:text-[#ededed] break-all">
                  {hospital.latitude.toFixed(4)}, {hospital.longitude.toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Ambulance Location at Request Time Card (Immutable Telemetry) */}
        <div className="bg-white dark:bg-[#0f0f0f] border-2 border-blue-600/30 dark:border-blue-500/30 p-4 sm:p-5 rounded-sm mb-6 shadow-xs font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 mb-3 border-b border-slate-200 dark:border-[#222222]">
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 tracking-widest block">
                IMMUTABLE HISTORICAL TELEMETRY
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#ededed]">
                AMBULANCE LOCATION AT REQUEST TIME
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-[#777]">
              Captured at {formatDateTime(dispatch.createdAt, true)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-xs space-y-1">
              <span className="text-slate-500 dark:text-[#777] uppercase text-[10px] block font-bold tracking-wider">
                Latitude:
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white block font-mono">
                {dispatch.ambulanceLat !== null && dispatch.ambulanceLat !== undefined
                  ? Number(dispatch.ambulanceLat).toFixed(4)
                  : "Not recorded"}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-xs space-y-1">
              <span className="text-slate-500 dark:text-[#777] uppercase text-[10px] block font-bold tracking-wider">
                Longitude:
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white block font-mono">
                {dispatch.ambulanceLng !== null && dispatch.ambulanceLng !== undefined
                  ? Number(dispatch.ambulanceLng).toFixed(4)
                  : "Not recorded"}
              </span>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-[#888] font-sans">
            These coordinates reflect the exact vehicle location captured when this dispatch request was created. They remain permanent and immutable even if the ambulance changes location.
          </p>
        </div>

        {/* Detailed Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Ambulance & Patient Section */}
          <div className="bg-white dark:bg-[#0f0f0f] p-4 sm:p-6 border border-slate-200 dark:border-[#222222] rounded-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-bold">01. AMBULANCE & PATIENT</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Vehicle & Patient Ref</h2>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase shrink-0">Ambulance / Vehicle ID:</span>
                <span className="font-bold text-slate-900 dark:text-[#ededed] font-mono break-all">{dispatch.ambulanceUnit}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase shrink-0">Patient Reference:</span>
                <span className="font-bold text-slate-900 dark:text-[#ededed] font-mono break-all">{dispatch.patientRef || "—"}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase shrink-0">Clinical Condition:</span>
                <span className="font-medium text-slate-900 dark:text-[#ededed] break-words">{dispatch.patientCondition}</span>
              </div>

              {dispatch.ambulanceLat !== null && dispatch.ambulanceLng !== null && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                  <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase shrink-0">Captured Request Coordinates:</span>
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-[#ededed] break-all">
                    {Number(dispatch.ambulanceLat).toFixed(4)}, {Number(dispatch.ambulanceLng).toFixed(4)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Hospital & Location Section */}
          <div className="bg-white dark:bg-[#0f0f0f] p-4 sm:p-6 border border-slate-200 dark:border-[#222222] rounded-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-bold">02. DESTINATION HOSPITAL</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed] break-words">{hospital?.name || "Target Hospital"}</h2>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase shrink-0">Location / City:</span>
                <span className="font-semibold text-slate-900 dark:text-[#ededed]">
                  {hospital?.city}, {hospital?.state || "India"}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase shrink-0">Address:</span>
                <span className="text-xs font-medium text-slate-800 dark:text-[#bbb] sm:text-right break-words">{hospital?.address}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase shrink-0">Contact Phone:</span>
                <span className="inline-block whitespace-nowrap font-bold font-mono text-slate-900 dark:text-[#ededed]">
                  Ph.: {hospital?.phone}
                </span>
              </div>

              {distanceKm !== null && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1 border-t border-slate-100 dark:border-[#1e1e1e] pt-2">
                  <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase shrink-0">Calculated Proximity:</span>
                  <span className="font-bold font-mono text-blue-700 dark:text-blue-400">{formatDistanceKm(distanceKm)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Telemetry Requirement Section */}
          <div className="bg-white dark:bg-[#0f0f0f] p-4 sm:p-6 border border-slate-200 dark:border-[#222222] rounded-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-bold">03. CAPACITY REQUIREMENT</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Requested Beds & Category</h2>
            </div>

            <div className="space-y-2.5 text-sm font-mono">
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-[#737373] uppercase shrink-0">Required Bed Category:</span>
                <span className="font-bold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 border border-blue-200 dark:border-blue-900/60 rounded-sm">
                  {dispatch.bedCategoryCode}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-[#737373] uppercase shrink-0">Beds Requested:</span>
                <span className="font-bold text-slate-900 dark:text-[#ededed]">
                  {dispatch.requestedBeds} Bed(s)
                  {dispatch.approvedBeds !== undefined && dispatch.approvedBeds !== null && dispatch.approvedBeds < dispatch.requestedBeds && (
                    <span className="text-amber-600 dark:text-amber-400 font-normal ml-1.5 text-xs">
                      ({dispatch.approvedBeds} approved, {dispatch.requestedBeds - dispatch.approvedBeds} pending review)
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-[#737373] uppercase shrink-0">Estimated Travel ETA:</span>
                <span className="font-bold text-slate-900 dark:text-[#ededed]">{dispatch.etaMinutes} Minutes</span>
              </div>
            </div>
          </div>

          {/* Timeline & Actions Section */}
          <div className="bg-white dark:bg-[#0f0f0f] p-4 sm:p-6 border border-slate-200 dark:border-[#222222] rounded-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-[#222222] pb-2">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-bold">04. TIMELINE & ACTIONS</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Telemetry Log</h2>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                <span className="text-slate-500 dark:text-[#737373] uppercase shrink-0">Created Timestamp:</span>
                <span className="text-slate-900 dark:text-[#ededed] break-words">{formatDateTime(dispatch.createdAt, true)}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                <span className="text-slate-500 dark:text-[#737373] uppercase shrink-0">Last Status Update:</span>
                <span className="text-slate-900 dark:text-[#ededed] break-words">{formatDateTime(dispatch.updatedAt, true)}</span>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-[#222222] flex items-center justify-between">
                {dispatch.status === "PENDING" ? (
                  <button
                    onClick={handleCancelRequest}
                    disabled={cancelling}
                    className="w-full py-2.5 px-4 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 cursor-pointer text-center"
                  >
                    {cancelling ? "Cancelling Request..." : "Cancel Pending Dispatch Request"}
                  </button>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-[#737373] font-mono leading-relaxed">
                    Status locked ({dispatch.status}). No cancellation available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Shared Activity & Telemetry Audit Timeline (Requirement 7 & 8) */}
        <div className="mb-8">
          <RequestTimeline dispatchId={dispatch.id} refreshTrigger={dispatch.updatedAt} />
        </div>
      </main>

      {/* Modify Active Dispatch Modal */}
      <ModifyRequestModal
        isOpen={isModifyOpen}
        onClose={() => setIsModifyOpen(false)}
        hospitalBeds={hospitalBeds.length > 0 ? hospitalBeds : activeDispatch?.hospitalBeds}
        dispatch={{
          ...dispatch,
          hospitalName: hospital?.name || activeDispatch?.hospitalName || "Hospital",
          hospitalAddress: hospital?.address || activeDispatch?.hospitalAddress || "",
          hospitalCity: hospital?.city || activeDispatch?.hospitalCity || "",
          hospitalState: hospital?.state || activeDispatch?.hospitalState || "",
          hospitalPhone: hospital?.phone || activeDispatch?.hospitalPhone || "",
          hospitalLat: hospital?.latitude || activeDispatch?.hospitalLat || null,
          hospitalLng: hospital?.longitude || activeDispatch?.hospitalLng || null,
          distanceKm,
          hospitalBeds: hospitalBeds.length > 0 ? hospitalBeds : activeDispatch?.hospitalBeds || [],
        } as any}
        onSuccess={async (updatedDispatch) => {
          setDispatch(updatedDispatch);
          await Promise.all([fetchDetails(), refreshActive()]);
        }}
      />
    </div>
  );
}
