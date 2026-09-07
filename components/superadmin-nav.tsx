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
  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.pathname,
    });
  };

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

        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-16">
          <div className="max-w-md mx-auto bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-sm p-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-mono text-xs font-semibold rounded-sm mb-6">
              SUPERADMIN PORTAL
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#ededed] font-sans">
              Sign In Required
            </h1>

            <p className="mt-3 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
              Authenticate with your authorized SuperAdmin account to access national registry controls.
            </p>

            <div className="mt-8">
              <button
                onClick={handleSignIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-[#ededed] dark:hover:bg-white text-white dark:text-black font-semibold text-sm rounded-sm transition-colors shadow-sm cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                Continue with Google
              </button>
            </div>
          </div>
        </div>
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
