"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDate } from "@/lib/format-date";
import { DynamicOSMLocationPicker } from "@/components/map/dynamic-map";

const INDIAN_CITIES = [
  { city: "New Delhi", state: "Delhi", lat: 28.5921, lng: 77.0460 },
  { city: "Mumbai", state: "Maharashtra", lat: 19.0028, lng: 72.8423 },
  { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { city: "Chennai", state: "Tamil Nadu", lat: 13.0604, lng: 80.2512 },
  { city: "Hyderabad", state: "Telangana", lat: 17.4649, lng: 78.3686 },
  { city: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
  { city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
];

interface PreviewData {
  valid: boolean;
  invitation: {
    code: string;
    role: string;
    email: string | null;
    expiresAt: string;
  };
  hospital: {
    id: string;
    name: string;
    city: string;
    state: string;
    phone: string;
  };
}

function HospitalSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();

  const [activeTab, setActiveTab] = useState<"create" | "join">("create");

  // Create Hospital Form State
  const [createForm, setCreateForm] = useState({
    name: "",
    address: "",
    city: "New Delhi",
    state: "Delhi",
    phone: "+91 11 ",
    latitude: "28.5921",
    longitude: "77.0460",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join Hospital Form State
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Auto-check if incoming URL has ?code=
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setInviteCode(codeParam.toUpperCase());
      setActiveTab("join");
      verifyInviteCode(codeParam.toUpperCase());
    }
  }, [searchParams]);

  // If user already belongs to a hospital, redirect to dashboard
  useEffect(() => {
    if (session) {
      fetch("/api/hospital")
        .then((res) => res.json())
        .then((data) => {
          if (!data.needsOnboarding && data.hospital) {
            router.push("/dashboard");
          }
        })
        .catch(() => {});
    }
  }, [session, router]);

  const verifyInviteCode = async (codeToVerify: string) => {
    const cleanCode = codeToVerify.trim().toUpperCase();
    if (cleanCode.length < 3) {
      setPreviewData(null);
      return;
    }
    try {
      setPreviewLoading(true);
      setJoinError(null);
      const res = await fetch(`/api/hospital/join?code=${encodeURIComponent(cleanCode)}`);
      const data = await res.json();
      if (res.ok && data.valid) {
        setPreviewData(data as PreviewData);
      } else {
        setPreviewData(null);
        if (cleanCode.length >= 6) {
          setJoinError(data.error || "Invalid invitation code");
        }
      }
    } catch {
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCityPreset = (cityObj: typeof INDIAN_CITIES[0]) => {
    setCreateForm((prev) => ({
      ...prev,
      city: cityObj.city,
      state: cityObj.state,
      latitude: cityObj.lat.toString(),
      longitude: cityObj.lng.toString(),
    }));
  };

  const handleUseGeolocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));
        setCreateForm((prev) => ({
          ...prev,
          latitude: lat.toString(),
          longitude: lng.toString(),
        }));
      },
      (err) => {
        alert(`Location access denied or unavailable: ${err.message}`);
      }
    );
  };

  const handleCreateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/hospital/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register hospital facility");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setCreateError(msg);
      setCreating(false);
    }
  };

  const handleJoinHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch("/api/hospital/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to join hospital facility");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setJoinError(msg);
      setJoining(false);
    }
  };


  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] flex items-center justify-center">
        <div className="text-slate-500 dark:text-[#888888] font-mono text-sm">
          Authenticating hospital staff credentials...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans">
        <div className="max-w-md mx-auto pt-24 px-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-8 shadow-sm">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm">
                BR
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] tracking-tight font-mono">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
            </div>
            <h1 className="text-xl font-bold mb-2">Hospital Facility Setup</h1>
            <p className="text-sm text-slate-600 dark:text-[#a1a1a1] mb-6">
              Please sign in with your Google medical staff account to register a new hospital or accept a staff invitation.
            </p>
            <button
              onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/hospital-setup" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-[#ededed] dark:hover:bg-white text-white dark:text-black font-semibold text-sm rounded-sm transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Sign In with Google Staff Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* Top Banner */}
      <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-2 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">ONBOARDING PORTAL</span>
          <span className="text-slate-500 dark:text-[#555] hidden sm:inline">|</span>
          <span className="text-slate-300 dark:text-[#a1a1a1] text-[11px] truncate max-w-[200px] sm:max-w-none">{session.user.email}</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <ThemeToggle />
          <button
            onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
            className="text-slate-400 hover:text-white transition-colors underline font-mono text-[11px] cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-40">
        <div className="w-full max-w-[1720px] 2xl:max-w-[1880px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 min-h-14 sm:min-h-16 py-2 sm:py-0 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm shrink-0">
              BR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] tracking-tight leading-none font-mono">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                Hospital Onboarding & Affiliation
              </span>
            </div>
          </Link>
        </div>
      </header>

      {/* Body Container */}
      <main className="w-full max-w-[1720px] 2xl:max-w-[1880px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-3 lg:py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Hospital Facility Setup
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-[#a1a1a1] leading-relaxed">
              Welcome, <span className="font-semibold text-slate-900 dark:text-white">{session.user.name || session.user.email}</span>. Select an onboarding route below to connect your facility to the BedRelay emergency network.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 w-full md:w-64 border border-slate-200 dark:border-[#222222] rounded-sm p-1 bg-slate-100 dark:bg-[#111111] shrink-0 font-mono text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`py-1.5 text-center rounded-sm transition-all cursor-pointer ${
                activeTab === "create"
                  ? "bg-white dark:bg-[#222222] text-slate-900 dark:text-white shadow-xs font-bold"
                  : "text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              CREATE NEW
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("join")}
              className={`py-1.5 text-center rounded-sm transition-all cursor-pointer ${
                activeTab === "join"
                  ? "bg-white dark:bg-[#222222] text-slate-900 dark:text-white shadow-xs font-bold"
                  : "text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              JOIN WITH CODE
            </button>
          </div>
        </div>

        {/* Tab 1: Create New Hospital */}
        {activeTab === "create" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-4 sm:p-6 lg:p-7 shadow-xs">
            {createError && (
              <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-sm text-xs font-mono text-red-700 dark:text-red-400">
                ERROR: {createError}
              </div>
            )}

            <form onSubmit={handleCreateHospital} className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
              {/* Left Column: Hospital Info & Bed Capacity */}
              <div className="lg:col-span-6 flex flex-col space-y-3.5">
                <div className="border-b border-slate-200 dark:border-[#1f1f1f] pb-3">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-blue-700 dark:text-blue-400 font-semibold mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                    HOSPITAL_ADMIN AFFILIATION
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Register New Hospital Emergency Facility
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-[#888888] mt-0.5">
                    As creator, you will automatically be assigned as <span className="font-semibold text-slate-800 dark:text-slate-200">Hospital Administrator</span> with full telemetry control.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-slate-700 dark:text-[#a1a1a1] mb-1">
                    Hospital Facility Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Fortis Memorial Research Institute"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] focus:border-blue-600 dark:focus:border-blue-500 rounded-sm text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-slate-700 dark:text-[#a1a1a1] mb-1">
                    Street Address & Campus Area
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Sector 44, Opposite HUDA City Centre Metro"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] focus:border-blue-600 dark:focus:border-blue-500 rounded-sm text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-mono font-semibold uppercase text-slate-700 dark:text-[#a1a1a1] mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="New Delhi"
                      value={createForm.city}
                      onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] focus:border-blue-600 dark:focus:border-blue-500 rounded-sm text-sm text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-semibold uppercase text-slate-700 dark:text-[#a1a1a1] mb-1">
                      State / UT
                    </label>
                    <input
                      type="text"
                      placeholder="Delhi"
                      value={createForm.state}
                      onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] focus:border-blue-600 dark:focus:border-blue-500 rounded-sm text-sm text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-semibold uppercase text-slate-700 dark:text-[#a1a1a1] mb-1">
                      Emergency Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+91 11 2600 0000"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] focus:border-blue-600 dark:focus:border-blue-500 rounded-sm text-sm text-slate-900 dark:text-white outline-none font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Bed Inventory Telemetry Initialization */}
                <div className="border border-slate-200 dark:border-[#222222] rounded-sm p-3 bg-slate-50 dark:bg-[#0f0f0f]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold uppercase text-slate-800 dark:text-[#ededed]">
                      Initial Bed Capacity Telemetry
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-[#777]">
                      Indian EMS Standards
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-2 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#282828] rounded-sm">
                      <div className="text-[10px] text-slate-500 dark:text-[#888] truncate">Intensive Care (ICU)</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">10 Total · <span className="text-emerald-700 dark:text-emerald-400">4 Avail</span></div>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#282828] rounded-sm">
                      <div className="text-[10px] text-slate-500 dark:text-[#888] truncate">General Ward</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">50 Total · <span className="text-emerald-700 dark:text-emerald-400">18 Avail</span></div>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#282828] rounded-sm">
                      <div className="text-[10px] text-slate-500 dark:text-[#888] truncate">Ventilator Care</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">6 Total · <span className="text-emerald-700 dark:text-emerald-400">2 Avail</span></div>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full py-2.5 sm:py-3 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-sm transition-colors cursor-pointer disabled:opacity-50 font-mono tracking-wider uppercase"
                  >
                    {creating ? "REGISTERING FACILITY..." : "REGISTER HOSPITAL & INITIALIZE TELEMETRY →"}
                  </button>
                </div>
              </div>

              {/* Right Column: Geographic Telemetry Coordinates & Live Map */}
              <div className="lg:col-span-6 flex flex-col space-y-3">
                <div className="border border-slate-200 dark:border-[#222222] rounded-sm p-3.5 sm:p-4 bg-slate-50 dark:bg-[#0f0f0f]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div>
                      <span className="text-xs font-mono font-semibold uppercase text-slate-800 dark:text-[#ededed] block">
                        Indian Geographic Telemetry Coordinates
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-[#777]">
                        Required for ambulance proximity ranking & ETA routing
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleUseGeolocation}
                      className="px-2.5 py-1 text-xs font-mono bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] hover:border-blue-500 rounded-sm text-slate-700 dark:text-slate-300 transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
                    >
                      Use Current Device GPS
                    </button>
                  </div>

                  <div className="mb-2">
                    <DynamicOSMLocationPicker
                      latitude={parseFloat(createForm.latitude) || 28.5921}
                      longitude={parseFloat(createForm.longitude) || 77.046}
                      cityName={createForm.city}
                      onChange={(lat, lng) =>
                        setCreateForm({
                          ...createForm,
                          latitude: lat.toString(),
                          longitude: lng.toString(),
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 dark:text-[#888] mb-1">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={createForm.latitude}
                        onChange={(e) => setCreateForm({ ...createForm, latitude: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-xs font-mono text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 dark:text-[#888] mb-1">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={createForm.longitude}
                        onChange={(e) => setCreateForm({ ...createForm, longitude: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-xs font-mono text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 p-2 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#222222] rounded-sm flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-[#888]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      <span>Coordinates Synced: {createForm.latitude}, {createForm.longitude}</span>
                    </span>
                    <span className="text-slate-500 dark:text-[#666]">{createForm.city}, {createForm.state}</span>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Join Existing Hospital */}
        {activeTab === "join" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-4 sm:p-6 lg:p-7 shadow-xs">
            {joinError && (
              <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs font-mono rounded-sm">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinHospital} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Code Input & Verification */}
              <div className="lg:col-span-6 space-y-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1">
                    Affiliate with an Existing Medical Facility
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-[#a1a1a1] leading-relaxed">
                    Enter the 6-10 character staff invitation code provided by your hospital administrator to link your credentials.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-slate-700 dark:text-[#a1a1a1] mb-1.5">
                    Staff Invitation Code
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      required
                      placeholder="BR-XXXXXX"
                      value={inviteCode}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setInviteCode(val);
                        verifyInviteCode(val);
                      }}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] focus:border-blue-600 dark:focus:border-blue-500 rounded-sm font-mono text-base font-bold tracking-widest text-slate-900 dark:text-white outline-none uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => verifyInviteCode(inviteCode)}
                      disabled={previewLoading || !inviteCode}
                      className="w-full sm:w-auto px-4 py-2 border border-slate-300 dark:border-[#333] hover:border-slate-400 dark:hover:border-[#555] bg-slate-50 dark:bg-[#181818] text-xs font-mono rounded-sm transition-colors cursor-pointer text-center shrink-0"
                    >
                      {previewLoading ? "Verifying..." : "Verify Code"}
                    </button>
                  </div>
                </div>

                {/* Demo Hint Banner */}
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-sm text-xs font-mono text-blue-800 dark:text-blue-300">
                  <div className="font-bold mb-1">Testing demo codes:</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInviteCode("BR-APOLLO7");
                        verifyInviteCode("BR-APOLLO7");
                      }}
                      className="px-2 py-0.5 bg-white dark:bg-[#111] border border-blue-200 dark:border-blue-800 rounded-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                    >
                      BR-APOLLO7
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteCode("BR-AIIMS42");
                        verifyInviteCode("BR-AIIMS42");
                      }}
                      className="px-2 py-0.5 bg-white dark:bg-[#111] border border-blue-200 dark:border-blue-800 rounded-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                    >
                      BR-AIIMS42
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteCode("BR-KEM888");
                        verifyInviteCode("BR-KEM888");
                      }}
                      className="px-2 py-0.5 bg-white dark:bg-[#111] border border-blue-200 dark:border-blue-800 rounded-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                    >
                      BR-KEM888
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteCode("BR-APOLLO9");
                        verifyInviteCode("BR-APOLLO9");
                      }}
                      className="px-2 py-0.5 bg-white dark:bg-[#111] border border-blue-200 dark:border-blue-800 rounded-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                    >
                      BR-APOLLO9 (Admin)
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={joining || !inviteCode}
                    className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold text-sm rounded-sm transition-colors cursor-pointer disabled:opacity-50 font-mono tracking-wide"
                  >
                    {joining ? "JOINING FACILITY..." : "ACCEPT INVITATION & ENTER CONSOLE →"}
                  </button>
                </div>
              </div>

              {/* Right Column: Facility Preview Box or Placeholder */}
              <div className="lg:col-span-6">
                {previewData && previewData.valid ? (
                  <div className="p-5 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-900/50 rounded-sm">
                    <div className="text-emerald-800 dark:text-emerald-400 font-mono text-xs font-bold mb-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                      INVITATION VERIFIED
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 dark:text-[#888] block text-[11px]">Facility Name:</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {previewData.hospital.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-[#888] block text-[11px]">Location:</span>
                        <span className="text-slate-800 dark:text-[#ccc]">
                          {previewData.hospital.city}, {previewData.hospital.state}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-[#888] block text-[11px]">Assigned Role:</span>
                        <span className={`inline-block px-2 py-0.5 rounded-xs font-bold text-[11px] mt-0.5 ${
                          previewData.invitation.role === "HOSPITAL_ADMIN"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/80 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-900/50"
                            : "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-900/50"
                        }`}>
                          {previewData.invitation.role}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-[#888] block text-[11px]">Expires At:</span>
                        <span className="text-slate-800 dark:text-[#ccc]">
                          {formatDate(previewData.invitation.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-slate-300 dark:border-[#2a2a2a] rounded-sm text-center flex flex-col items-center justify-center min-h-[220px]">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#161616] flex items-center justify-center text-slate-400 mb-2 font-mono text-xs font-bold">
                      BR
                    </div>
                    <div className="font-mono text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                      Facility Verification Preview
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#777] max-w-xs">
                      Enter a valid hospital invitation code to preview facility capacity, medical departments, and designated staff role.
                    </p>
                  </div>
                )}
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default function HospitalSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] flex items-center justify-center">
        <div className="text-slate-500 dark:text-[#888888] font-mono text-sm">
          Loading BedRelay Facility Setup...
        </div>
      </div>
    }>
      <HospitalSetupContent />
    </Suspense>
  );
}
