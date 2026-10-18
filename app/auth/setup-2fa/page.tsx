"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ShieldCheck,
  Key,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  Loader2,
  Download,
  CheckCircle2,
} from "lucide-react";

function SetupTwoFactorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams?.get("callbackURL") || "/dashboard";

  const { data: session, isPending: sessionLoading } = authClient.useSession();

  // Steps: 2 = Scan QR & Verify, 3 = Completed
  const [step, setStep] = useState<2 | 3>(2);
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [confirmCode, setConfirmCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prevent multiple calls to enable/regenerate 2FA keys
  const initializingRef = useRef(false);

  // If already authenticated and 2FA is already enabled, forward to destination
  useEffect(() => {
    if (sessionLoading || !session?.user) {
      return;
    }

    const user = session.user as { twoFactorEnabled?: boolean };
    if (user.twoFactorEnabled) {
      router.push(callbackURL);
      return;
    }

    // Already initialized or currently initializing: do not re-run
    if (initializingRef.current || totpURI) {
      return;
    }

    // Auto-load or auto-generate TOTP keys once without asking for password
    const loadOrGenerate2FA = async () => {
      initializingRef.current = true;

      // 1. Check if signup already initialized keys into sessionStorage
      try {
        const cachedStr = sessionStorage.getItem("bedrelay_pending_2fa");
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (cached?.totpURI) {
            setTotpURI(cached.totpURI);
            setBackupCodes(cached.backupCodes || []);
            try {
              const parsedUrl = new URL(cached.totpURI);
              setSecretKey(parsedUrl.searchParams.get("secret") || cached.totpURI);
            } catch {
              setSecretKey(cached.totpURI);
            }
            const qr = await QRCode.toDataURL(cached.totpURI, {
              width: 256,
              margin: 2,
              color: { dark: "#000000", light: "#FFFFFF" },
            });
            setQrDataUrl(qr);
            return;
          }
        }
      } catch (e) {
        console.warn("Could not parse cached 2FA credentials:", e);
      }

      // 2. Otherwise auto-enable once without prompting for password
      setLoading(true);
      try {
        const res = await authClient.twoFactor.enable({
          password: "__SESSION_AUTHORIZED__",
        });

        if (res?.error) {
          setErrorMessage(res.error.message || "Failed to initialize Two-Factor Authentication keys.");
          initializingRef.current = false;
          setLoading(false);
          return;
        }

        const data = res?.data as { totpURI?: string; backupCodes?: string[] } | undefined;
        const uri = data?.totpURI;
        const codes = data?.backupCodes || [];

        if (uri) {
          try {
            sessionStorage.setItem(
              "bedrelay_pending_2fa",
              JSON.stringify({ totpURI: uri, backupCodes: codes })
            );
          } catch {}

          setTotpURI(uri);
          setBackupCodes(codes);
          try {
            const parsedUrl = new URL(uri);
            setSecretKey(parsedUrl.searchParams.get("secret") || uri);
          } catch {
            setSecretKey(uri);
          }
          const qr = await QRCode.toDataURL(uri, {
            width: 256,
            margin: 2,
            color: { dark: "#000000", light: "#FFFFFF" },
          });
          setQrDataUrl(qr);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "An unexpected error occurred while initializing 2FA.");
        initializingRef.current = false;
      } finally {
        setLoading(false);
      }
    };

    loadOrGenerate2FA();
  }, [session, sessionLoading, callbackURL, router, totpURI]);

  const handleConfirmAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = confirmCode.trim();
    if (cleanCode.length !== 6) {
      setErrorMessage("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);

    try {
      const res = await authClient.twoFactor.verifyTotp({
        code: cleanCode,
      });

      if (res?.error) {
        setErrorMessage(
          res.error.message || "Invalid verification code. Please ensure your clock is synchronized."
        );
        setLoading(false);
        return;
      }

      // 2FA successfully activated!
      try {
        sessionStorage.removeItem("bedrelay_pending_2fa");
      } catch {}
      setStep(3);
    } catch (err: any) {
      setErrorMessage(err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (secretKey) {
      navigator.clipboard.writeText(secretKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyBackupCodes = () => {
    if (backupCodes.length > 0) {
      navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const handleDownloadBackupCodes = () => {
    if (backupCodes.length === 0) return;
    const content = `BEDRELAY HEALTHCARE TELEMETRY - EMERGENCY 2FA BACKUP CODES\nGenerated: ${new Date().toISOString()}\nAccount: ${session?.user?.email || "User"}\n\n` +
      backupCodes.map((c, i) => `${i + 1}. ${c}`).join("\n") +
      `\n\nKeep these codes in a secure vault. Each code can be used once.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bedrelay-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (sessionLoading) {
    return (
      <div className="w-full max-w-md mx-auto bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-8 text-center rounded-sm">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-3" />
        <p className="text-xs font-mono text-slate-500">Checking account authorization status...</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="w-full max-w-md mx-auto bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-8 text-center rounded-sm">
        <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-black dark:text-[#ededed]">Session Required</h2>
        <p className="mt-2 text-xs text-slate-700 dark:text-[#888888]">
          You must sign in or register before configuring compulsory Two-Factor Authentication.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block px-4 py-2 bg-blue-700 text-white font-mono text-xs uppercase tracking-wider rounded-sm"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-sm p-4 sm:p-5 lg:p-6">
      {/* Clearance Banner */}
      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-400 font-mono text-[11px] font-semibold rounded-sm mb-2 sm:mb-2.5">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>COMPULSORY 2FA ENROLLMENT REQUIRED</span>
      </div>

      <h1 className="text-lg sm:text-xl font-bold tracking-tight text-black dark:text-[#ededed] font-sans">
        Set Up Two-Factor Authentication
      </h1>

      <p className="mt-1 text-xs text-slate-700 dark:text-[#888888] leading-relaxed max-w-4xl">
        BedRelay coordinates critical hospital emergency bed capacity and patient transfers. To protect against unauthorized access, Two-Factor Authentication is compulsory for all accounts.
      </p>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mt-2.5 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-sm flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-snug">{errorMessage}</div>
        </div>
      )}

      {/* 2-Column Layout */}
      {/* LEFT: QR Code & Key | RIGHT: Recovery Codes (top) + Confirmation Code (bottom) */}
      {step === 2 && (
        <div className="mt-3.5 sm:mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 items-stretch">
          {/* LEFT HALF: QR Code & Manual Secret Key */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#222222] rounded-sm flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <span className="text-xs font-mono font-semibold uppercase text-black dark:text-white mb-2.5 text-center">
                Step 1: Scan With Authenticator App
              </span>

              {qrDataUrl ? (
                <div className="p-2 sm:p-2.5 bg-white rounded-sm border border-slate-300 dark:border-[#333] shadow-xs">
                  <img src={qrDataUrl} alt="2FA TOTP QR Code" className="w-44 h-44 sm:w-48 sm:h-48 lg:w-52 lg:h-52 block object-contain" />
                </div>
              ) : (
                <div className="w-44 h-44 sm:w-48 sm:h-48 lg:w-52 lg:h-52 flex items-center justify-center bg-slate-200 dark:bg-[#202020] text-xs font-mono text-slate-700 dark:text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>

            {/* Secret key manual display */}
            <div className="w-full mt-3 pt-2.5 border-t border-slate-200 dark:border-[#222222]">
              <span className="text-[10.5px] font-mono text-slate-700 dark:text-[#777] uppercase block mb-1">
                Or enter key manually:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={secretKey || ""}
                  className="w-full font-mono text-xs px-2.5 py-1.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-black dark:text-[#ccc]"
                />
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#202020] dark:hover:bg-[#2a2a2a] text-black dark:text-slate-200 text-xs font-mono font-semibold rounded-sm transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Copy secret key"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT HALF: Recovery Codes (Top) + Code Entry (Bottom) */}
          <div className="flex flex-col gap-3 sm:gap-4 justify-between">
            {/* TOP OF RIGHT HALF: Emergency Recovery Backup Codes */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#222222] rounded-sm flex-1 flex flex-col justify-between">
              {backupCodes.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold uppercase text-black dark:text-white">
                      Step 2: Save Recovery Backup Codes
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyBackupCodes}
                        className="text-[11px] font-mono text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        {copiedCodes ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCodes ? "Copied All" : "Copy All"}</span>
                      </button>
                      <span className="text-slate-400 dark:text-[#444]">|</span>
                      <button
                        type="button"
                        onClick={handleDownloadBackupCodes}
                        className="text-[11px] font-mono text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm font-mono text-xs text-black dark:text-[#aaa] font-medium">
                    {backupCodes.map((code, idx) => (
                      <div key={idx} className="px-2 py-0.5 select-all">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-xs font-mono text-slate-700 dark:text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span>Preparing Emergency Backup Codes...</span>
                </div>
              )}

              <p className="mt-2 text-[10.5px] font-mono text-slate-700 dark:text-[#777] leading-relaxed">
                Save these codes in a safe place. If you ever lose access to your authenticator app, these codes are required to log in.
              </p>
            </div>

            {/* BOTTOM OF RIGHT HALF: Enter 6-Digit Confirmation Code */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#222222] rounded-sm">
              <form onSubmit={handleConfirmAndActivate} className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-black dark:text-white mb-1.5">
                    Step 3: Enter 6-Digit Code from Authenticator
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-[#666]">
                      <Key className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full pl-9 pr-3 py-2 text-center text-lg font-mono tracking-[0.35em] bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#2a2a2a] text-black dark:text-[#ededed] placeholder-slate-400 rounded-sm focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || confirmCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm uppercase tracking-wider rounded-sm transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying & Activating 2FA...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirm Code & Activate Compulsory 2FA</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Success Completion */}
      {step === 3 && (
        <div className="mt-6 text-center space-y-4 py-4">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-950/60 border border-green-300 dark:border-green-800 rounded-full flex items-center justify-center mx-auto text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-black dark:text-[#ededed]">
            Two-Factor Authentication Active
          </h2>

          <p className="text-xs sm:text-sm text-slate-700 dark:text-[#888888] leading-relaxed max-w-md mx-auto">
            Your account is now fully secured with Two-Factor Authentication. Every subsequent session sign-in will require a 6-digit TOTP code.
          </p>

          <div className="pt-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => {
                router.push(callbackURL);
                router.refresh();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm uppercase tracking-wider rounded-sm transition-colors shadow-xs cursor-pointer"
            >
              <span>Continue to BedRelay Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SetupTwoFactorPage() {
  return (
    <div className="min-h-screen xl:h-screen flex flex-col bg-slate-50 dark:bg-[#000000] text-black dark:text-[#ededed] font-sans antialiased transition-colors duration-150 overflow-y-auto xl:overflow-hidden">
      {/* Top Bar */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] shrink-0 z-50">
        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm shadow-xs">
              BR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-black dark:text-[#ededed] tracking-tight leading-none font-mono">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
              <span className="text-[10px] text-slate-600 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                Compulsory Security Enrollment
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

      <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-2 sm:py-3 flex flex-col justify-center">
        <Suspense
          fallback={
            <div className="p-8 text-center font-mono text-xs text-slate-500">
              Loading 2FA enrollment configuration...
            </div>
          }
        >
          <SetupTwoFactorContent />
        </Suspense>
      </main>
    </div>
  );
}
