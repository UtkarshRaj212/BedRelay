"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Building2, 
  Bed, 
  Activity, 
  Users, 
  Lock, 
  LogOut, 
  RefreshCw, 
  FileText, 
  AlertTriangle,
  Server,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";

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

export default function SuperAdminProtectedShell() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "audit">("overview");
  const [refreshing, setRefreshing] = useState(false);

  const fetchSuperAdminData = async () => {
    try {
      setRefreshing(true);
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
    } catch (err) {
      console.error("SuperAdmin access error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  // 1. Loading state
  if (sessionLoading || (session?.user && loading)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <ShieldCheck className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto" />
          </div>
          <p className="text-slate-400 text-sm font-medium tracking-wide">
            Verifying SuperAdmin cryptographic privileges...
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state (No session)
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 text-indigo-400">
            <Lock className="w-6 h-6" />
          </div>

          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Restricted Clearance Area
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            BedRelay SuperAdmin
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Access to national health registry telemetry, facility management, and cross-hospital access control is strictly restricted to verified system administrators.
          </p>

          <button
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            Sign In with Google
          </button>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors inline-flex items-center gap-1"
            >
              Return to Public Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated but Forbidden (User is not SUPER_ADMIN)
  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/90 border border-red-900/40 rounded-2xl p-8 shadow-2xl relative text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5 text-red-400">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/60 border border-red-500/30 text-red-300 text-xs font-semibold mb-3">
            <AlertTriangle className="w-3.5 h-3.5" />
            403 - Forbidden
          </div>

          <h1 className="text-xl font-bold text-white tracking-tight mb-2">
            SuperAdmin Clearance Required
          </h1>

          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Signed in as <span className="text-slate-200 font-medium">{session.user.email}</span>. Your account does not possess <span className="font-mono text-red-300 font-semibold">SUPER_ADMIN</span> privileges required to access this system.
          </p>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 mb-6 text-left text-xs space-y-1.5 font-mono text-slate-400">
            <div className="flex justify-between">
              <span className="text-slate-500">Session ID:</span>
              <span className="text-slate-300 truncate max-w-[180px]">{session.user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Assigned Role:</span>
              <span className="text-amber-400 font-bold">USER / HOSPITAL_STAFF</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className="text-red-400 font-bold">DENIED</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors text-center"
            >
              Go to Hospital Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-1.5 bg-red-950/50 hover:bg-red-900/50 text-red-300 border border-red-800/40 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authorized SUPER_ADMIN Shell
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top SuperAdmin Navigation Shell */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight">BedRelay National Command</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wide">
                  SUPER_ADMIN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">System-Wide Clearance Mode</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={fetchSuperAdminData}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
              Refresh
            </button>

            <div className="h-4 w-px bg-slate-800" />

            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-slate-200">{session.user.name || "Administrator"}</div>
              <div className="text-[10px] text-slate-500 font-mono">{session.user.email}</div>
            </div>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-red-950/50 hover:text-red-300 text-slate-400 transition-colors border border-slate-700/60"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Clearance Banner */}
        <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 border border-indigo-800/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mt-0.5">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Central Health Infrastructure Control</h2>
              <p className="text-xs text-slate-400">
                You have elevated authorization to inspect all facilities, override hospital core identities, manage memberships, and review security audit logs.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              DATABASE SECURE
            </span>
          </div>
        </div>

        {/* Top Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Hospitals */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Total Hospitals</span>
              <Building2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {stats?.hospitals.total ?? "—"}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400 font-medium">{stats?.hospitals.active ?? 0} Active</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400 font-medium">{stats?.hospitals.deactivated ?? 0} Deactivated</span>
            </div>
          </div>

          {/* Beds */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">National Bed Capacity</span>
              <Bed className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {stats?.beds.total ?? "—"}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-cyan-400 font-medium">{stats?.beds.available ?? 0} Available</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-medium">{stats?.beds.occupancyRate ?? 0}% Occupied</span>
            </div>
          </div>

          {/* Dispatches */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Dispatch Requests</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {stats?.dispatches.total ?? "—"}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-amber-400 font-medium">{stats?.dispatches.active ?? 0} Active</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-medium">{stats?.dispatches.completed ?? 0} Completed</span>
            </div>
          </div>

          {/* Staff */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Hospital Personnel</span>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {stats?.staff.total ?? "—"}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-purple-300 font-medium">{stats?.staff.admins ?? 0} Admins</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-medium">{stats?.staff.staff ?? 0} Staff</span>
            </div>
          </div>
        </div>

        {/* Section Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 px-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <Server className="w-4 h-4" />
            System Status & Category Telemetry
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`pb-3 px-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "audit"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <FileText className="w-4 h-4" />
            Audit & Security Log Stream
          </button>
        </div>

        {/* Tab 1: Overview & Bed Breakdown */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Bed className="w-4 h-4 text-indigo-400" />
                Aggregated Critical Care Bed Telemetry
              </h3>

              {stats?.beds.categories && Object.keys(stats.beds.categories).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(stats.beds.categories).map(([code, cat]) => (
                    <div key={code} className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-indigo-300">{code}</span>
                        <span className="text-xs text-slate-400">{cat.total} Total</span>
                      </div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-xl font-bold text-white">{cat.available}</span>
                        <span className="text-xs text-emerald-400 font-medium">Beds Vacant</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all"
                          style={{
                            width: `${cat.total > 0 ? Math.min(100, Math.round((cat.occupied / cat.total) * 100)) : 0}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 mt-1.5 font-mono">
                        <span>{cat.occupied} Occupied</span>
                        <span>{cat.total > 0 ? Math.round((cat.occupied / cat.total) * 100) : 0}% Occupancy</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No bed categories loaded yet.</p>
              )}
            </div>

            {/* SuperAdmin Capabilities Checklist */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Active Privilege Matrix
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/40 border border-slate-800/60">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">Hospital Registry Core Identity</span>
                    <p className="text-slate-400 text-[11px]">Protected endpoints allow updating facility name, coordinates, phone, and activation status.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/40 border border-slate-800/60">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">Cross-Hospital Staff Management</span>
                    <p className="text-slate-400 text-[11px]">Modify roles between HOSPITAL_ADMIN and HOSPITAL_STAFF or revoke hospital memberships across any facility.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/40 border border-slate-800/60">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">System-Wide Audit Logging</span>
                    <p className="text-slate-400 text-[11px]">Every privileged action records immutable audit logs with timestamp, actor userId, and client IP.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/40 border border-slate-800/60">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">Zero Navigation Leakage</span>
                    <p className="text-slate-400 text-[11px]">No buttons or links exist in normal UI. Accessible solely through direct authenticated /superadmin navigation.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Audit Logs */}
        {activeTab === "audit" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Security & Activity Audit Stream</h3>
                <p className="text-xs text-slate-400">Showing last 50 privileged operations across the network</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-[11px] font-mono text-slate-300">
                {auditLogs.length} Entries
              </span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No audit entries recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Resource</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 font-bold text-[11px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                          {log.resourceType}
                          {log.resourceId && (
                            <span className="text-slate-500 ml-1 text-[10px]">({log.resourceId})</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap font-sans">
                          <div>{log.userName || "System / Anonymous"}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{log.userEmail || "—"}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
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
