"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthCard } from "@/components/auth-card";
import { ArrowRight, ShieldCheck } from "lucide-react";

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
      {/* Main Header */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 min-h-16 py-2.5 sm:py-0 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/superadmin" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 shrink-0 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm shadow-xs">
                BR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] tracking-tight leading-none font-mono">
                  BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                  Central Command // SuperAdmin
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="px-2.5 sm:px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] hover:border-slate-400 dark:hover:border-[#444] bg-white dark:bg-[#0f0f0f] rounded-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
                <span className="hidden xs:inline sm:inline">Refresh</span>
              </button>
            )}

            <ThemeToggle />

            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-[#222222]" />

            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-medium text-slate-900 dark:text-[#ededed]">
                {session?.user?.name || "SuperAdmin"}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#777] font-mono">
                {session?.user?.email || "superadmin@bedrelay.gov.in"}
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 border border-slate-300 dark:border-[#2a2a2a] hover:border-red-400 bg-white dark:bg-[#0f0f0f] rounded-sm transition-all cursor-pointer"
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 pt-4 sm:pt-6">
        <div className="flex border-b border-slate-200 dark:border-[#222222] font-mono text-xs uppercase tracking-wider overflow-x-auto no-scrollbar scroll-smooth">
          <Link
            href="/superadmin"
            className={`px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-bold transition-all whitespace-nowrap shrink-0 ${
              currentTab === "overview"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Overview
          </Link>
          <Link
            href="/superadmin/hospitals"
            className={`px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-bold transition-all whitespace-nowrap shrink-0 ${
              currentTab === "hospitals"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Hospitals
          </Link>
          <Link
            href="/superadmin/staff"
            className={`px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-bold transition-all whitespace-nowrap shrink-0 ${
              currentTab === "staff"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Staff & Members
          </Link>
          <Link
            href="/superadmin?tab=beds"
            className={`px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-bold transition-all whitespace-nowrap shrink-0 ${
              currentTab === "beds"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Bed Records
          </Link>
          <Link
            href="/superadmin?tab=dispatches"
            className={`px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-bold transition-all whitespace-nowrap shrink-0 ${
              currentTab === "dispatches"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Dispatches
          </Link>
          <Link
            href="/superadmin?tab=audit"
            className={`px-3.5 sm:px-5 py-2.5 sm:py-3 border-b-2 font-bold transition-all whitespace-nowrap shrink-0 ${
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
  const { data: session } = authClient.useSession();

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased flex flex-col items-center justify-center p-4 transition-colors duration-150">
        <div className="w-10 h-10 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm shadow-md mb-4">
          BR
        </div>
        <div className="text-xs font-mono text-slate-600 dark:text-[#888888]">
          Verifying administrator credentials...
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
        <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
          <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm shadow-xs">
                BR
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] tracking-tight leading-none font-mono">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                href="/"
                className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] hover:border-slate-400 bg-white dark:bg-[#0f0f0f] rounded-sm transition-all"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </header>

        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-12">
          <AuthCard
            callbackURL="/superadmin"
            portalTitle="SuperAdmin Portal"
            portalDescription="Authenticate with your authorized SuperAdmin credentials. Compulsory 2FA is required for all administrator sessions."
            badgeLabel="SUPERADMIN GATEWAY // 2FA MANDATORY"
          />
        </div>
      </div>
    );
  }

  // Compulsory 2FA check
  if (session?.user && !(session.user as any)?.twoFactorEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
        <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
          <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm shadow-xs">
                BR
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] tracking-tight leading-none font-mono">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="max-w-lg mx-auto my-16 px-4">
          <div className="bg-white dark:bg-[#0a0a0a] p-8 border border-amber-300 dark:border-amber-800 rounded-sm shadow-sm">
            <div className="inline-block px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-mono text-xs font-semibold mb-4 rounded-sm">
              SECURITY CLEARANCE REQUIRED // 2FA MANDATORY
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#ededed]">
              Two-Factor Authentication Compulsory
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
              SuperAdmin clearance requires active Two-Factor Authentication. Please configure your authenticator app before accessing national registry telemetry.
            </p>
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-[#222222]">
              <Link
                href="/auth/setup-2fa?callbackURL=/superadmin"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm uppercase tracking-wider rounded-sm transition-colors shadow-xs"
              >
                <span>Complete SuperAdmin 2FA Setup</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
        <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
          <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm">
                BR
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] tracking-tight leading-none font-mono">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                href="/"
                className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] hover:border-slate-400 bg-white dark:bg-[#0f0f0f] rounded-sm transition-all"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </header>

        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-16">
          <div className="max-w-lg mx-auto bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-950 rounded-sm shadow-sm p-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 font-mono text-xs font-semibold rounded-sm mb-6">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
              ACCESS RESTRICTED (HTTP 403)
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
