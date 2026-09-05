"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";

interface SuperAdminNavProps {
  activeTab?: "overview" | "hospitals" | "staff" | "beds" | "dispatches" | "audit";
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function SuperAdminNav({
  activeTab,
  onRefresh,
  refreshing = false,
}: SuperAdminNavProps) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  };

  const currentTab =
    activeTab ||
    (pathname === "/superadmin/hospitals"
      ? "hospitals"
      : pathname === "/superadmin/staff"
      ? "staff"
      : "overview");

  return (
    <>
      {/* Top System Status Banner */}
      <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>NATIONAL HEALTH TELEMETRY COMMAND</span>
          <span className="text-slate-500 dark:text-[#555]">|</span>
          <span className="text-emerald-400 dark:text-emerald-300 font-bold">SUPER_ADMIN ACTIVE</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 dark:text-[#888888]">
          <span className="hidden md:inline">ONE SOURCE OF TRUTH (NEON POSTGRES)</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/superadmin" className="flex items-center gap-2.5 group">
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
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] hover:border-slate-400 dark:hover:border-[#444] bg-white dark:bg-[#0f0f0f] rounded-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <svg
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-600" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 dark:bg-[#222222]" />

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-medium text-slate-900 dark:text-[#ededed]">
                {session?.user?.name || "SuperAdmin"}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#777] font-mono">
                {session?.user?.email || "superadmin@bedrelay.gov.in"}
              </span>
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

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex border-b border-slate-200 dark:border-[#222222] font-mono text-xs uppercase tracking-wider overflow-x-auto">
          <Link
            href="/superadmin"
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap ${
              currentTab === "overview"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            System Overview
          </Link>
          <Link
            href="/superadmin/hospitals"
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap ${
              currentTab === "hospitals"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Hospitals
          </Link>
          <Link
            href="/superadmin/staff"
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap ${
              currentTab === "staff"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Staff & Memberships
          </Link>
          <Link
            href="/superadmin?tab=beds"
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap ${
              currentTab === "beds"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Bed Records
          </Link>
          <Link
            href="/superadmin?tab=dispatches"
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap ${
              currentTab === "dispatches"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Dispatches
          </Link>
          <Link
            href="/superadmin?tab=audit"
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap ${
              currentTab === "audit"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Audit Logs
          </Link>
        </div>
      </div>
    </>
  );
}

export function SuperAdminGateway({
  sessionLoading,
  hasSession,
  forbidden,
}: {
  sessionLoading: boolean;
  hasSession: boolean;
  forbidden: boolean;
}) {
  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.pathname,
    });
  };

  if (sessionLoading) {
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

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
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

        <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
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

            <Link
              href="/"
              className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] hover:border-slate-400 bg-white dark:bg-[#0f0f0f] rounded-sm transition-all"
            >
              Back to Home
            </Link>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-lg mx-auto bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-950 rounded-sm shadow-sm p-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 font-mono text-xs font-semibold rounded-sm mb-6">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
              SECURITY CLEARANCE VIOLATION (HTTP 403)
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#ededed] font-sans">
              Elevated Clearance Required
            </h1>

            <p className="mt-3 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
              Your account has been authenticated, but lacks the cryptographic{" "}
              <code className="bg-slate-100 dark:bg-[#222] px-1.5 py-0.5 rounded-sm font-mono text-xs text-red-600 dark:text-red-400">
                SUPER_ADMIN
              </code>{" "}
              privilege level in the national database.
            </p>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-[#222222] flex gap-3">
              <Link
                href="/dashboard"
                className="flex-1 text-center px-4 py-2.5 bg-slate-900 dark:bg-[#ededed] hover:bg-slate-800 dark:hover:bg-white text-white dark:text-black font-semibold text-xs tracking-wider uppercase rounded-sm transition-all font-mono"
              >
                Go to Hospital Dashboard
              </Link>
              <button
                onClick={async () => {
                  await authClient.signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        window.location.href = "/";
                      },
                    },
                  });
                }}
                className="px-4 py-2.5 border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ededed] font-semibold text-xs tracking-wider uppercase rounded-sm hover:border-slate-400 font-mono cursor-pointer"
              >
                Switch Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
