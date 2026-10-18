"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  Lock,
  Mail,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface AuthCardProps {
  callbackURL?: string;
  portalTitle?: string;
  portalDescription?: string;
  badgeLabel?: string;
}

export function AuthCard({
  callbackURL = "/dashboard",
  portalTitle = "Hospital Staff Portal",
  portalDescription = "Sign in or register your account to access real-time hospital bed capacity and pre-arrival dispatch telemetry.",
  badgeLabel,
}: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const effectiveCallback = searchParams?.get("callbackURL") || callbackURL;

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email: email.trim(),
        password: password,
        callbackURL: effectiveCallback,
      });

      if (res?.error) {
        setErrorMessage(res.error.message || "Failed to sign in. Please verify your credentials.");
        setLoading(false);
        return;
      }

      // Check if 2FA redirect was signaled
      const data = res?.data as { twoFactorRedirect?: boolean } | undefined;
      if (data?.twoFactorRedirect) {
        // Redirection to /auth/2fa is typically handled by twoFactorClient plugin,
        // but explicit push ensures seamless UX
        router.push(`/auth/2fa?callbackURL=${encodeURIComponent(effectiveCallback)}`);
        return;
      }

      // If user signed in without 2FA challenge, verify if 2FA needs setup
      const sessionRes = await authClient.getSession();
      const sessionUser = sessionRes?.data?.user as { twoFactorEnabled?: boolean } | undefined;
      if (!sessionUser?.twoFactorEnabled) {
        router.push(`/auth/setup-2fa?callbackURL=${encodeURIComponent(effectiveCallback)}`);
        return;
      }

      router.push(effectiveCallback);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password: password,
        callbackURL: effectiveCallback,
      });

      if (res?.error) {
        setErrorMessage(res.error.message || "Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      // Immediately initialize 2FA using the password the user just typed so they are never asked again
      try {
        const enableRes = await authClient.twoFactor.enable({
          password: password,
        });
        if (enableRes?.data) {
          sessionStorage.setItem("bedrelay_pending_2fa", JSON.stringify(enableRes.data));
        }
      } catch (enableErr) {
        console.warn("Auto-enable 2FA in signup caught:", enableErr);
      }

      // 2FA is compulsory for all accounts: immediately forward new accounts directly to 2FA QR code screen
      router.push(`/auth/setup-2fa?callbackURL=${encodeURIComponent(effectiveCallback)}`);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during account creation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-sm p-6 sm:p-8">


      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-black dark:text-[#ededed] font-sans">
        {portalTitle}
      </h1>

      <p className="mt-2 text-xs sm:text-sm text-slate-700 dark:text-[#888888] leading-relaxed">
        {portalDescription}
      </p>

      {/* Mode Switcher Tabs */}
      <div className="mt-6 grid grid-cols-2 p-1 bg-slate-100 dark:bg-[#141414] border border-slate-300 dark:border-[#222222] rounded-sm text-xs font-semibold font-mono">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setErrorMessage(null);
          }}
          className={`py-2 text-center transition-all rounded-xs cursor-pointer ${mode === "signin"
            ? "bg-white dark:bg-[#202020] text-black dark:text-white shadow-xs font-bold"
            : "text-slate-700 dark:text-[#888888] hover:text-black dark:hover:text-white"
            }`}
        >
          SIGN IN
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setErrorMessage(null);
          }}
          className={`py-2 text-center transition-all rounded-xs cursor-pointer ${mode === "signup"
            ? "bg-white dark:bg-[#202020] text-black dark:text-white shadow-xs font-bold"
            : "text-slate-700 dark:text-[#888888] hover:text-black dark:hover:text-white"
            }`}
        >
          CREATE ACCOUNT
        </button>
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-sm flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-snug">{errorMessage}</div>
        </div>
      )}

      {/* Credentials Form */}
      <form
        onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
        className="mt-5 space-y-4"
      >
        {mode === "signup" && (
          <div>
            <label className="block text-xs font-mono font-medium text-slate-800 dark:text-[#a1a1a1] uppercase mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-[#666]">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Jane Doe / Staff Officer"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#121212] border border-slate-300 dark:border-[#2a2a2a] text-black dark:text-[#ededed] placeholder-slate-400 dark:placeholder-[#555] rounded-sm focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-mono font-medium text-slate-800 dark:text-[#a1a1a1] uppercase mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-[#666]">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@hospital.org"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#121212] border border-slate-300 dark:border-[#2a2a2a] text-black dark:text-[#ededed] placeholder-slate-400 dark:placeholder-[#555] rounded-sm focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-mono font-medium text-slate-800 dark:text-[#a1a1a1] uppercase">
              Password
            </label>
            <span className="text-[11px] font-mono text-slate-600 dark:text-[#888]">
              {mode === "signup" ? "Min. 8 characters" : "Encrypted (bcrypt)"}
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-[#666]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              minLength={8}
              className="w-full pl-9 pr-10 py-2 text-sm bg-white dark:bg-[#121212] border border-slate-300 dark:border-[#2a2a2a] text-black dark:text-[#ededed] placeholder-slate-400 dark:placeholder-[#555] rounded-sm focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 dark:text-[#666] hover:text-slate-800 dark:hover:text-[#a1a1a1] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mode === "signup" && (
          <div>
            <label className="block text-xs font-mono font-medium text-slate-800 dark:text-[#a1a1a1] uppercase mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-[#666]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                minLength={8}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#121212] border border-slate-300 dark:border-[#2a2a2a] text-black dark:text-[#ededed] placeholder-slate-400 dark:placeholder-[#555] rounded-sm focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm uppercase tracking-wider rounded-sm transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying Credentials...</span>
            </>
          ) : (
            <>
              <span>{mode === "signin" ? "Sign In With Password" : "Create Account & Continue to 2FA"}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Compulsory 2FA Notice */}
      {/* <div className="mt-4 p-3 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-[#888888] font-mono leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800 dark:text-[#cccccc] uppercase">
            Compulsory 2FA Enforcement:
          </span>{" "}
          Two-factor authentication is strictly required for all accounts. You will be prompted to enter your authenticator TOTP code on sign in.
        </div>
      </div> */}
    </div>
  );
}
