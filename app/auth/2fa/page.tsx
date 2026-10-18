"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ShieldCheck,
  KeyRound,
  AlertCircle,
  ArrowRight,
  Loader2,
  Lock,
  ArrowLeft,
} from "lucide-react";

function TwoFactorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams?.get("callbackURL") || "/dashboard";

  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-submit when 6 digits are typed in TOTP mode
  useEffect(() => {
    if (!useBackupCode && code.length === 6 && /^\d+$/.test(code)) {
      handleVerify();
    }
  }, [code, useBackupCode]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const cleanCode = code.trim();
    if (!cleanCode) {
      setErrorMessage("Please enter your verification code.");
      return;
    }

    setLoading(true);

    try {
      if (useBackupCode) {
        const res = await authClient.twoFactor.verifyBackupCode({
          code: cleanCode,
        });

        if (res?.error) {
          setErrorMessage(res.error.message || "Invalid backup code. Please check and try again.");
          setLoading(false);
          return;
        }
      } else {
        const res = await authClient.twoFactor.verifyTotp({
          code: cleanCode,
        });

        if (res?.error) {
          setErrorMessage(res.error.message || "Invalid authentication code. Please try again.");
          setLoading(false);
          return;
        }
      }

      // Success: session is now established
      router.push(callbackURL);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Verification failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-sm p-6 sm:p-8">
      {/* Top Security Clearance Badge */}
      {/* <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-semibold rounded-sm mb-4">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>COMPULSORY 2FA CHALLENGE</span>
      </div> */}

      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-black dark:text-[#ededed] font-sans">
        Two-Factor Verification
      </h1>

      <p className="mt-2 text-xs sm:text-sm text-slate-700 dark:text-[#888888] leading-relaxed">
        {useBackupCode
          ? "Enter one of your emergency recovery backup codes to authenticate this session."
          : "Open your authenticator app (Google Authenticator, Microsoft Authenticator, Authy) and enter the active 6-digit TOTP code."}
      </p>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-sm flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-snug">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleVerify} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-mono font-medium text-slate-800 dark:text-[#a1a1a1] uppercase mb-1.5">
            {useBackupCode ? "Recovery Backup Code" : "6-Digit Authentication Code"}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-[#666]">
              {useBackupCode ? <KeyRound className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <input
              type="text"
              autoFocus
              required
              inputMode={useBackupCode ? "text" : "numeric"}
              pattern={useBackupCode ? undefined : "[0-9]*"}
              maxLength={useBackupCode ? 32 : 6}
              value={code}
              onChange={(e) => {
                const val = e.target.value;
                setCode(useBackupCode ? val : val.replace(/\D/g, ""));
              }}
              placeholder={useBackupCode ? "e.g. A1B2-C3D4-E5F6" : "123456"}
              className={`w-full pl-9 pr-3 py-2.5 text-base sm:text-lg bg-slate-50 dark:bg-[#121212] border border-slate-300 dark:border-[#2a2a2a] text-black dark:text-[#ededed] placeholder-slate-400 dark:placeholder-[#555] rounded-sm focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono tracking-widest ${!useBackupCode ? "text-center tracking-[0.35em]" : ""
                }`}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || code.trim().length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm uppercase tracking-wider rounded-sm transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying Code...</span>
            </>
          ) : (
            <>
              <span>Verify & Access Session</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Switch between TOTP and Backup code */}
      <div className="mt-5 pt-5 border-t border-slate-200 dark:border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
        <button
          type="button"
          onClick={() => {
            setUseBackupCode(!useBackupCode);
            setCode("");
            setErrorMessage(null);
          }}
          className="text-blue-700 dark:text-blue-400 hover:underline cursor-pointer font-medium"
        >
          {useBackupCode ? "Switch to 6-digit Authenticator Code" : "Use emergency recovery backup code"}
        </button>

        <Link
          href="/dashboard"
          className="text-slate-700 dark:text-[#777] hover:text-black dark:hover:text-[#aaa] flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back to sign in</span>
        </Link>
      </div>
    </div>
  );
}

export default function TwoFactorPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-black dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* Top Bar */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm shadow-xs">
              BR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-black dark:text-[#ededed] tracking-tight leading-none font-mono">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
              <span className="text-[10px] text-slate-600 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                Authentication Security Gateway
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-[#888888] hover:text-black dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] rounded-sm transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto my-12 sm:my-16 px-4">
        <Suspense
          fallback={
            <div className="p-8 text-center font-mono text-xs text-slate-500">
              Loading two-factor gateway...
            </div>
          }
        >
          <TwoFactorContent />
        </Suspense>
      </main>
    </div>
  );
}
