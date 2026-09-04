"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";

interface SuperAdminStats {
  hospitals: {
    total: number;
    active: number;
    deactivated: number;
  };
  beds: {
    total: number;
    available: number;
    occupied: number;
    occupancyRate: number;
    categories: Record<string, { total: number; available: number; occupied: number }>;
  };
  dispatches: {
    total: number;
    pending: number;
    accepted: number;
    completed: number;
    active: number;
  };
  staff: {
    total: number;
    admins: number;
    staff: number;
  };
}

interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

interface HospitalItem {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  creatorName: string | null;
  creatorEmail: string | null;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  staffCount: number;
}

interface StaffItem {
  membershipId: string;
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  role: "HOSPITAL_ADMIN" | "HOSPITAL_STAFF";
  status: string;
  joinedAt: string;
}

export default function SuperAdminPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [hospitalsList, setHospitalsList] = useState<HospitalItem[]>([]);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "hospitals" | "staff" | "audit">("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Filter states
  const [hospSearch, setHospSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchSuperAdminData = async () => {
    try {
      setRefreshing(true);
      setActionMessage(null);
      const res = await fetch("/api/superadmin/stats");

      if (res.status === 401) {
        setForbidden(false);
        setStats(null);
        return;
      }

      if (res.status === 403) {
        setForbidden(true);
        setStats(null);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to load telemetry");
      }

      const data = await res.json();
      setStats(data.stats);
      setAuditLogs(data.recentAuditLogs || []);
      setForbidden(false);

      // Fetch hospitals and staff in background for respective tabs
      fetchHospitals();
      fetchStaff();
    } catch (err) {
      console.error("SuperAdmin access error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHospitals = async () => {
    try {
      const res = await fetch("/api/superadmin/hospitals");
      if (res.ok) {
        const data = await res.json();
        setHospitalsList(data.hospitals || []);
      }
    } catch (err) {
      console.error("Failed to load hospitals:", err);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/superadmin/staff");
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || []);
      }
    } catch (err) {
      console.error("Failed to load staff:", err);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      if (session?.user) {
        fetchSuperAdminData();
      } else {
        setLoading(false);
      }
    }
  }, [session, sessionLoading]);

  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/superadmin",
    });
  };

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  };

  // Toggle Hospital Status (ACTIVE <-> DEACTIVATED)
  const handleToggleHospitalStatus = async (hosp: HospitalItem) => {
    const nextStatus = hosp.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
    try {
      setUpdatingId(hosp.id);
      const res = await fetch("/api/superadmin/hospitals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitalId: hosp.id, status: nextStatus }),
      });

      if (res.ok) {
        setActionMessage(`Updated ${hosp.name} status to ${nextStatus}`);
        await fetchHospitals();
        await fetchSuperAdminData();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Toggle Staff Role (HOSPITAL_ADMIN <-> HOSPITAL_STAFF)
  const handleToggleStaffRole = async (member: StaffItem) => {
    const nextRole = member.role === "HOSPITAL_ADMIN" ? "HOSPITAL_STAFF" : "HOSPITAL_ADMIN";
    try {
      setUpdatingId(member.membershipId);
      const res = await fetch("/api/superadmin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: member.membershipId, role: nextRole }),
      });

      if (res.ok) {
        setActionMessage(`Updated role for ${member.userName} to ${nextRole}`);
        await fetchStaff();
        await fetchSuperAdminData();
      }
    } catch (err) {
      console.error("Failed to update staff role:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Revoke Staff Membership
  const handleRevokeStaff = async (member: StaffItem) => {
    if (!confirm(`Revoke membership for ${member.userName} from ${member.hospitalName}?`)) return;
    try {
      setUpdatingId(member.membershipId);
      const res = await fetch("/api/superadmin/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: member.membershipId }),
      });

      if (res.ok) {
        setActionMessage(`Revoked access for ${member.userName}`);
        await fetchStaff();
        await fetchSuperAdminData();
      }
    } catch (err) {
      console.error("Failed to revoke staff:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // 1. Session or initial data loading
  if (sessionLoading || (session?.user && loading)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased flex flex-col transition-colors duration-150">
        <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 inline-block animate-pulse"></span>
            <span>BEDRELAY NATIONAL COMMAND // SECURITY CLEARANCE</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center font-mono text-sm p-4">
          <div className="w-10 h-10 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm shadow-md animate-pulse mb-4">
            BR
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-[#888888]">
            <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-ping"></span>
            <span>VERIFYING SUPER_ADMIN CRYPTOGRAPHIC PRIVILEGES...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State (No session)
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
        {/* Top Status Header */}
        <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
            <span>AUTHENTICATION GATEWAY // NATIONAL COMMAND RESTRICTED</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 dark:text-[#888888]">
            <span className="hidden md:inline font-mono">CLEARANCE: SUPER_ADMIN</span>
            <ThemeToggle />
          </div>
        </div>

        {/* Navigation */}
        <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm shadow-xs">
                BR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] tracking-tight leading-none font-mono">
                  BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                  National System Administration
                </span>
              </div>
            </Link>

            <Link
              href="/"
              className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] hover:border-slate-400 dark:hover:border-[#444] bg-white dark:bg-[#0f0f0f] rounded-sm transition-all"
            >
              Back to Home
            </Link>
          </div>
        </header>

        {/* Auth Gate Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-lg mx-auto bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-sm p-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 dark:bg-[#181818] border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#a1a1a1] font-mono text-xs font-semibold rounded-sm mb-6">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              SECURE GOVERNMENT & NHA CLEARANCE PORTAL
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#ededed] font-sans">
              SuperAdmin Command Authentication
            </h1>

            <p className="mt-3 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
              This interface is strictly restricted to National Health Authority administrators and system operators. Elevated credentials are cryptographic and verified against the national database on every request.
            </p>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-[#222222]">
              <button
                onClick={handleSignIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs tracking-wider uppercase rounded-sm transition-all shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign In With Authorized Account
              </button>
            </div>

            <div className="mt-6 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] p-3 text-[11px] font-mono text-slate-500 dark:text-[#777] rounded-sm space-y-1">
              <div>[SEC-01] AUDIT TRAIL RECORDED PER ACCESS ATTEMPT</div>
              <div>[SEC-02] SESSION TOKENS STRICTLY VALIDATED SERVER-SIDE</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated but Forbidden (User role is USER, not SUPER_ADMIN)
  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
        <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block animate-pulse"></span>
            <span>CLEARANCE REJECTION // 403 ACCESS FORBIDDEN</span>
          </div>
          <ThemeToggle />
        </div>

        <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm">
                BR
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] tracking-tight leading-none font-mono">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
            </Link>
            <button
              onClick={handleSignOut}
              className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 border border-red-300 dark:border-red-900/40 bg-white dark:bg-[#0f0f0f] rounded-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-lg mx-auto bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-900/40 rounded-sm shadow-sm p-8 text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 font-mono font-bold flex items-center justify-center text-lg rounded-sm mx-auto mb-4">
              403
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 font-mono text-xs font-semibold rounded-sm mb-4">
              CLEARANCE LEVEL INSUFFICIENT
            </div>

            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#ededed] font-sans">
              SuperAdmin Authorization Required
            </h1>

            <p className="mt-3 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
              Signed in as <span className="font-mono text-slate-900 dark:text-white font-medium">{session.user.email}</span>. Your account is registered as standard hospital staff (<span className="font-mono text-amber-600 dark:text-amber-400 font-bold">USER</span>) and does not possess national network <span className="font-mono text-red-600 dark:text-red-400 font-bold">SUPER_ADMIN</span> clearance.
            </p>

            <div className="mt-6 p-3 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm text-left font-mono text-xs space-y-1 text-slate-600 dark:text-[#888]">
              <div className="flex justify-between">
                <span className="text-slate-400">Account ID:</span>
                <span className="text-slate-700 dark:text-[#ccc] truncate max-w-[200px]">{session.user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Role Status:</span>
                <span className="text-red-600 dark:text-red-400 font-bold">UNAUTHORIZED</span>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Link
                href="/dashboard"
                className="flex-1 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs tracking-wider uppercase rounded-sm transition-all text-center shadow-xs"
              >
                Go to Hospital Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="px-4 py-2.5 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] border border-slate-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0f0f0f] rounded-sm hover:border-slate-400 transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authorized SuperAdmin Shell (Matching main BedRelay pages)
  const filteredHospitals = hospitalsList.filter((h) => {
    if (!hospSearch.trim()) return true;
    const q = hospSearch.toLowerCase();
    return h.name.toLowerCase().includes(q) || (h.city && h.city.toLowerCase().includes(q));
  });

  const filteredStaff = staffList.filter((s) => {
    if (!staffSearch.trim()) return true;
    const q = staffSearch.toLowerCase();
    return (
      s.userName.toLowerCase().includes(q) ||
      s.userEmail.toLowerCase().includes(q) ||
      s.hospitalName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* Top System Status Banner */}
      <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>NATIONAL HEALTH TELEMETRY COMMAND</span>
          <span className="text-slate-500 dark:text-[#555]">|</span>
          <span className="text-emerald-400 dark:text-emerald-300 font-bold">SUPER_ADMIN ACTIVE</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 dark:text-[#888888]">
          <span className="hidden md:inline">ROLE: SYSTEM_SUPER_ADMIN</span>
          <span className="hidden md:inline">ENCRYPTED CLEARANCE</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm shadow-xs">
                BR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] tracking-tight leading-none font-mono">
                  BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                  National Central Command // SuperAdmin
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchSuperAdminData}
              disabled={refreshing}
              className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] hover:border-slate-400 dark:hover:border-[#444] bg-white dark:bg-[#0f0f0f] rounded-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-600" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-[#222222]" />

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-medium text-slate-900 dark:text-[#ededed]">{session.user.name || "SuperAdmin"}</span>
              <span className="text-[10px] text-slate-500 dark:text-[#777] font-mono">{session.user.email}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 border border-slate-300 dark:border-[#2a2a2a] hover:border-red-400 bg-white dark:bg-[#0f0f0f] rounded-sm transition-all cursor-pointer"
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action confirmation alert */}
        {actionMessage && (
          <div className="mb-6 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-mono rounded-sm flex items-center justify-between">
            <span>✓ {actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-4">✕</button>
          </div>
        )}

        {/* National Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Hospitals */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-4 shadow-xs">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-[#888] mb-1">
              Registered Hospitals
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900 dark:text-[#ededed]">
              {stats?.hospitals.total ?? "—"}
            </div>
            <div className="mt-2 text-xs font-mono flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats?.hospitals.active ?? 0} ACTIVE</span>
              <span className="text-slate-400 dark:text-[#555]">•</span>
              <span className="text-amber-600 dark:text-amber-400">{stats?.hospitals.deactivated ?? 0} OFF</span>
            </div>
          </div>

          {/* National Bed Capacity */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-4 shadow-xs">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-[#888] mb-1">
              National Bed Capacity
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900 dark:text-[#ededed]">
              {stats?.beds.total ?? "—"}
            </div>
            <div className="mt-2 text-xs font-mono flex items-center gap-2">
              <span className="text-blue-700 dark:text-blue-400 font-semibold">{stats?.beds.available ?? 0} VACANT</span>
              <span className="text-slate-400 dark:text-[#555]">•</span>
              <span className="text-slate-500 dark:text-[#888]">{stats?.beds.occupancyRate ?? 0}% OCCUPIED</span>
            </div>
          </div>

          {/* EMS Dispatches */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-4 shadow-xs">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-[#888] mb-1">
              EMS Inbound Dispatches
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900 dark:text-[#ededed]">
              {stats?.dispatches.total ?? "—"}
            </div>
            <div className="mt-2 text-xs font-mono flex items-center gap-2">
              <span className="text-amber-600 dark:text-amber-400 font-semibold">{stats?.dispatches.active ?? 0} ACTIVE</span>
              <span className="text-slate-400 dark:text-[#555]">•</span>
              <span className="text-emerald-600 dark:text-emerald-400">{stats?.dispatches.completed ?? 0} RESOLVED</span>
            </div>
          </div>

          {/* Hospital Staff */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-4 shadow-xs">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-[#888] mb-1">
              Hospital Personnel
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900 dark:text-[#ededed]">
              {stats?.staff.total ?? "—"}
            </div>
            <div className="mt-2 text-xs font-mono flex items-center gap-2">
              <span className="text-purple-600 dark:text-purple-400 font-semibold">{stats?.staff.admins ?? 0} ADMINS</span>
              <span className="text-slate-400 dark:text-[#555]">•</span>
              <span className="text-slate-500 dark:text-[#888]">{stats?.staff.staff ?? 0} STAFF</span>
            </div>
          </div>
        </div>

        {/* Unified Tab Bar (matching dashboard design) */}
        <div className="flex border-b border-slate-200 dark:border-[#222222] font-mono text-xs uppercase tracking-wider overflow-x-auto mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "overview"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            System Overview & Beds
          </button>
          <button
            onClick={() => {
              setActiveTab("hospitals");
              if (hospitalsList.length === 0) fetchHospitals();
            }}
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "hospitals"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Hospital Registry ({hospitalsList.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("staff");
              if (staffList.length === 0) fetchStaff();
            }}
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "staff"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Cross-Facility Staff ({staffList.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "audit"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Security Audit Stream ({auditLogs.length})
          </button>
        </div>

        {/* Tab 1: System Overview & Critical Care Beds */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#ededed] font-sans">
                    National Bed Category Telemetry
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">
                    Aggregated live telemetry across all active facilities in India
                  </p>
                </div>
                <span className="px-2 py-1 rounded-sm bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-[#2a2a2a] text-xs font-mono text-slate-700 dark:text-[#ccc]">
                  {stats?.beds.total ?? 0} TOTAL BEDS
                </span>
              </div>

              {stats?.beds.categories && Object.keys(stats.beds.categories).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(stats.beds.categories).map(([code, cat]) => (
                    <div key={code} className="p-4 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400">{code}</span>
                        <span className="text-xs font-mono text-slate-500 dark:text-[#888]">{cat.total} Total</span>
                      </div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-2xl font-mono font-bold text-slate-900 dark:text-[#ededed]">{cat.available}</span>
                        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Vacant</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-[#1f1f1f] h-2 rounded-xs overflow-hidden">
                        <div
                          className="bg-blue-700 dark:bg-blue-500 h-full rounded-xs transition-all"
                          style={{
                            width: `${cat.total > 0 ? Math.min(100, Math.round((cat.occupied / cat.total) * 100)) : 0}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-[#777] mt-2 font-mono">
                        <span>{cat.occupied} Occupied</span>
                        <span>{cat.total > 0 ? Math.round((cat.occupied / cat.total) * 100) : 0}% Occupancy</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs font-mono text-slate-500">
                  NO CATEGORY DATA AVAILABLE
                </div>
              )}
            </div>

            {/* Privilege & System Security Matrix */}
            <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#ededed] font-sans mb-4">
                SuperAdmin Architectural Security Architecture
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="font-mono font-bold text-slate-900 dark:text-[#ededed] mb-1">
                    [01] HOSPITAL CORE IDENTITY MANAGEMENT
                  </div>
                  <p className="text-slate-600 dark:text-[#888] leading-relaxed">
                    SuperAdmin endpoints exclusively possess privileges to update hospital names, geographical latitude/longitude, and operational activation status. Normal hospital staff cannot alter identity parameters.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="font-mono font-bold text-slate-900 dark:text-[#ededed] mb-1">
                    [02] SYSTEM-WIDE STAFF ROSTER CONTROL
                  </div>
                  <p className="text-slate-600 dark:text-[#888] leading-relaxed">
                    Elevate or demote personnel between HOSPITAL_ADMIN and HOSPITAL_STAFF across any hospital, or revoke access permanently without leaking cross-tenant access to individual hospital managers.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="font-mono font-bold text-slate-900 dark:text-[#ededed] mb-1">
                    [03] DATABASE ROLE VERIFICATION ON EVERY REQUEST
                  </div>
                  <p className="text-slate-600 dark:text-[#888] leading-relaxed">
                    Tokens are never trusted in isolation. Every protected request checks `role === 'SUPER_ADMIN'` in the PostgreSQL database, guaranteeing immediate revocation if an account is demoted.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="font-mono font-bold text-slate-900 dark:text-[#ededed] mb-1">
                    [04] ZERO CLIENT NAVIGATION EXPOSURE
                  </div>
                  <p className="text-slate-600 dark:text-[#888] leading-relaxed">
                    No SuperAdmin buttons, links, or navigation items exist in the public application. The portal operates strictly behind direct authenticated navigation to `/superadmin`.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Hospital Registry & Identity Management */}
        {activeTab === "hospitals" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed] font-mono uppercase">
                  National Facility Registry
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#888]">
                  Central hospital registry control — modify operational status or core parameters
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Filter by name or city..."
                  value={hospSearch}
                  onChange={(e) => setHospSearch(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm focus:outline-none focus:border-blue-600 text-slate-900 dark:text-[#ededed] w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3 px-4">Hospital Name / ID</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Total Beds</th>
                    <th className="py-3 px-4">Available</th>
                    <th className="py-3 px-4">Staff Count</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] font-mono">
                  {filteredHospitals.map((hosp) => (
                    <tr key={hosp.id} className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-[#ededed]">{hosp.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#666]">{hosp.id}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-[#aaa]">
                        <div>{hosp.city}, {hosp.state}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#666]">{hosp.phone || "—"}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-[#ededed]">
                        {hosp.totalBeds}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{hosp.availableBeds}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-[#aaa]">
                        {hosp.staffCount}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                            hosp.status === "ACTIVE"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/40"
                              : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800/40"
                          }`}
                        >
                          {hosp.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleHospitalStatus(hosp)}
                          disabled={updatingId === hosp.id}
                          className={`px-2.5 py-1 text-[11px] font-mono font-bold uppercase rounded-sm border transition-all cursor-pointer ${
                            hosp.status === "ACTIVE"
                              ? "border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                              : "border-emerald-300 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          }`}
                        >
                          {updatingId === hosp.id ? "..." : hosp.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Cross-Facility Staff Roster */}
        {activeTab === "staff" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed] font-mono uppercase">
                  Cross-Hospital Personnel Directory
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#888]">
                  System-wide staff memberships and role elevation across all hospitals
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Filter staff by name/email..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm focus:outline-none focus:border-blue-600 text-slate-900 dark:text-[#ededed] w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Affiliated Facility</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Joined Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] font-mono">
                  {filteredStaff.map((member) => (
                    <tr key={member.membershipId} className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-[#ededed]">{member.userName}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#666]">{member.userEmail}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-[#aaa]">
                        <div>{member.hospitalName}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#666]">{member.hospitalCity || "—"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                            member.role === "HOSPITAL_ADMIN"
                              ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-800/40"
                              : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800/40"
                          }`}
                        >
                          {member.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{member.status}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-[#777]">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleToggleStaffRole(member)}
                          disabled={updatingId === member.membershipId}
                          className="px-2 py-1 text-[11px] font-mono font-bold uppercase rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 transition-all cursor-pointer"
                        >
                          {member.role === "HOSPITAL_ADMIN" ? "Demote" : "Make Admin"}
                        </button>
                        <button
                          onClick={() => handleRevokeStaff(member)}
                          disabled={updatingId === member.membershipId}
                          className="px-2 py-1 text-[11px] font-mono font-bold uppercase rounded-sm border border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Security Audit Stream */}
        {activeTab === "audit" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#222222] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed] font-mono uppercase">
                  Central Security Audit Stream
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#888]">
                  Immutable system activity log recording privileged operations
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-sm bg-slate-100 dark:bg-[#111111] border border-slate-200 dark:border-[#2a2a2a] text-[11px] font-mono text-slate-700 dark:text-[#ccc]">
                {auditLogs.length} Records
              </span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-12 text-center text-xs font-mono text-slate-500">
                NO AUDIT LOGS RECORDED YET
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Operation</th>
                      <th className="py-3 px-4">Resource Target</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Payload Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors">
                        <td className="py-3 px-4 text-slate-500 dark:text-[#777] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 font-bold text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-[#ccc] whitespace-nowrap">
                          {log.resourceType}
                          {log.resourceId && (
                            <span className="text-slate-400 dark:text-[#666] ml-1 text-[10px]">({log.resourceId})</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-slate-900 dark:text-[#ededed] font-medium">{log.userName || "System"}</div>
                          <div className="text-[10px] text-slate-400 dark:text-[#666]">{log.userEmail || "—"}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-[#888] max-w-xs truncate">
                          {log.details || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
