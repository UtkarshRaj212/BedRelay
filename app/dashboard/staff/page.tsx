"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";

interface StaffMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: "HOSPITAL_ADMIN" | "HOSPITAL_STAFF";
  status: string;
  joinedAt: string;
}

interface Invitation {
  id: string;
  code: string;
  email: string | null;
  role: "HOSPITAL_ADMIN" | "HOSPITAL_STAFF";
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface HospitalInfo {
  id: string;
  name: string;
  city: string;
  state: string;
}

export default function StaffManagementPage() {
  const { data: session, isPending } = authClient.useSession();

  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Invite Modal / Form State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"HOSPITAL_STAFF" | "HOSPITAL_ADMIN">("HOSPITAL_STAFF");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<Invitation | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchStaffData = async () => {
    try {
      setLoading(true);
      setForbidden(false);

      const res = await fetch("/api/hospital/staff");

      if (res.status === 403) {
        setForbidden(true);
        // Also fetch general hospital info to show role
        const hospRes = await fetch("/api/hospital");
        if (hospRes.ok) {
          const hospData = await hospRes.json();
          if (hospData.needsOnboarding) {
            setNeedsOnboarding(true);
          } else {
            setHospital(hospData.hospital);
            setCurrentRole(hospData.membership?.role || "HOSPITAL_STAFF");
          }
        }
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setHospital(data.hospital);
        setCurrentRole(data.currentRole);
        setMembers(data.members || []);
        setInvitations(data.invitations || []);
      } else {
        const err = await res.json();
        if (err.error?.includes("onboarding")) {
          setNeedsOnboarding(true);
        }
      }
    } catch (err) {
      console.error("Failed to fetch staff data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchStaffData();
    }
  }, [session]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingInvite(true);
      setInviteError(null);

      const res = await fetch("/api/hospital/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim() || undefined,
          role: inviteRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to issue invitation");
      }

      setGeneratedInvite(data.invitation);
      setInviteEmail("");
      setInviteRole("HOSPITAL_STAFF");
      await fetchStaffData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create invitation";
      setInviteError(msg);
    } finally {
      setCreatingInvite(false);
    }
  };


  const handleRevokeInvite = async (invitationId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation? The invitation code will immediately become invalid.")) {
      return;
    }

    try {
      setRevokingId(invitationId);
      const res = await fetch("/api/hospital/staff/invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      if (res.ok) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      } else {
        const err = await res.json();
        alert(err.error || "Failed to revoke invitation");
      }
    } catch (err) {
      console.error("Failed to revoke invite:", err);
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text: string, type: "code" | "link") => {
    navigator.clipboard.writeText(text);
    if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (isPending || (loading && !hospital && !forbidden && !needsOnboarding)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] flex items-center justify-center font-mono text-sm text-slate-500">
        <span className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-ping mr-3"></span>
        Loading Hospital Staff Management Console...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans">
        <div className="max-w-md mx-auto pt-24 px-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-8 text-center">
            <h2 className="text-xl font-bold mb-2">Hospital Staff Portal</h2>
            <p className="text-sm text-slate-600 dark:text-[#a1a1a1] mb-6">
              Sign in with your Google Medical Staff Account to manage your facility staff roster.
            </p>
            <button
              onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/dashboard/staff" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-[#ededed] dark:hover:bg-white text-white dark:text-black font-semibold text-sm rounded-sm transition-colors cursor-pointer"
            >
              Sign In with Google Staff Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-8 text-center">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center text-lg font-mono rounded-full mx-auto mb-4">
            !
          </div>
          <h2 className="text-lg font-bold mb-2">Facility Onboarding Required</h2>
          <p className="text-xs text-slate-600 dark:text-[#a1a1a1] mb-6">
            Your account is not yet affiliated with a hospital facility. Please complete the one-time facility setup or join an existing facility with an invitation code.
          </p>
          <Link
            href="/hospital-setup"
            className="block w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-[#ededed] dark:hover:bg-white text-white dark:text-black text-xs font-mono font-bold rounded-sm transition-colors"
          >
            PROCEED TO FACILITY SETUP →
          </Link>
        </div>
      </div>
    );
  }

  // Non-admin restricted screen
  if (forbidden || (currentRole && currentRole !== "HOSPITAL_ADMIN")) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
        {/* Top Status */}
        <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
            <span>ROLE RESTRICTION: ACCESS DENIED</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">STAFF: {session.user.email}</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/dashboard" className="text-slate-400 hover:text-white underline font-mono text-[11px]">
              Back to Overview
            </Link>
          </div>
        </div>

        <div className="max-w-xl mx-auto pt-20 px-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-amber-300 dark:border-amber-900/60 rounded-sm p-8">
            <div className="flex items-center gap-3 text-amber-800 dark:text-amber-400 font-mono text-sm font-bold mb-3">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              ACCESS RESTRICTED — ADMINISTRATOR PRIVILEGE REQUIRED
            </div>
            <p className="text-sm text-slate-700 dark:text-[#c4c4c4] leading-relaxed mb-4">
              You are currently authenticated as <span className="font-semibold font-mono text-slate-900 dark:text-white">HOSPITAL_STAFF</span> at {hospital?.name || "your hospital"}.
            </p>
            <p className="text-xs text-slate-500 dark:text-[#888888] leading-relaxed mb-6 font-mono">
              In accordance with hospital tenancy security policies, only verified <span className="text-slate-800 dark:text-slate-200 font-bold">Hospital Administrators</span> have permission to view staff rosters, issue recruitment invitation codes, or modify user roles. Normal hospital staff cannot invite administrators or alter facility membership.
            </p>
            <div className="flex gap-3">
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black text-xs font-mono font-bold rounded-sm transition-colors"
              >
                RETURN TO OVERVIEW
              </Link>
              <Link
                href="/dashboard/beds"
                className="px-4 py-2 border border-slate-300 dark:border-[#333] text-slate-800 dark:text-slate-200 text-xs font-mono rounded-sm transition-colors"
              >
                MANAGE BED TELEMETRY
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeStaffCount = members.filter((m) => m.status === "ACTIVE").length;
  const adminCount = members.filter((m) => m.role === "HOSPITAL_ADMIN").length;
  const pendingCount = invitations.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* Top Header */}
      <div className="bg-slate-900 dark:bg-[#080808] text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 dark:border-[#1f1f1f] flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>STAFF GOVERNANCE CONSOLE: ONLINE</span>
          <span className="text-slate-500 dark:text-[#555]">|</span>
          <span className="text-slate-300 dark:text-[#a1a1a1]">ADMIN: {session.user.email}</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button
            onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
            className="text-slate-400 hover:text-white transition-colors underline font-mono text-[11px]"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Navigation Header */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono rounded-sm">
              BR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 dark:text-[#ededed] font-mono tracking-tight">
                BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5">
                Hospital Control Console
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-2 font-mono text-xs">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors"
              >
                OVERVIEW
              </Link>
              <Link
                href="/dashboard/beds"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors"
              >
                BED MANAGEMENT
              </Link>
              <Link
                href="/dashboard/dispatches"
                className="px-3 py-1.5 text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white rounded-sm transition-colors"
              >
                DISPATCH REQUESTS
              </Link>
              <Link
                href="/dashboard/staff"
                className="px-3 py-1.5 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-semibold rounded-sm"
              >
                STAFF MANAGEMENT
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Facility Header & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200 dark:border-[#222222]">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                {hospital?.name || "Hospital Staff & Access Governance"}
              </h1>
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-mono font-bold rounded-xs">
                ADMIN CONSOLE
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#888888] font-mono">
              FACILITY LOCATION: {hospital?.city}, {hospital?.state} &bull; TENANCY: STRICT SCOPED ISOLATION
            </p>
          </div>

          <button
            onClick={() => {
              setShowInviteModal(true);
              setGeneratedInvite(null);
              setInviteError(null);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs font-mono uppercase tracking-wider rounded-sm transition-colors shadow-xs cursor-pointer"
          >
            <span>+</span>
            INVITE STAFF MEMBER
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-5">
            <span className="text-[11px] font-mono uppercase text-slate-500 dark:text-[#737373] tracking-wider block mb-1">
              Active Medical Staff
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">{activeStaffCount}</span>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">Verified Affiliates</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-5">
            <span className="text-[11px] font-mono uppercase text-slate-500 dark:text-[#737373] tracking-wider block mb-1">
              Hospital Administrators
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-blue-700 dark:text-blue-400">{adminCount}</span>
              <span className="text-xs font-mono text-slate-500">Full Governance</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-5">
            <span className="text-[11px] font-mono uppercase text-slate-500 dark:text-[#737373] tracking-wider block mb-1">
              Pending Invitations
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">{pendingCount}</span>
              <span className="text-xs font-mono text-amber-600 dark:text-amber-400">Awaiting Acceptance</span>
            </div>
          </div>
        </div>

        {/* Section 1: Active Staff Members */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden mb-10 shadow-2xs">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#222222] flex items-center justify-between">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Current Staff Roster ({members.length})
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-[#777]">
              Scoped to {hospital?.name}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1f1f1f] bg-slate-50/50 dark:bg-[#121212]/50 text-[11px] font-mono uppercase text-slate-500 dark:text-[#777]">
                  <th className="py-3 px-6">Staff Member</th>
                  <th className="py-3 px-6">Email Address</th>
                  <th className="py-3 px-6">Assigned Role</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Affiliation Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] text-xs">
                {members.map((member) => (
                  <tr key={member.membershipId} className="hover:bg-slate-50/70 dark:hover:bg-[#111111] transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#222] text-slate-700 dark:text-[#ddd] flex items-center justify-center font-mono font-bold text-xs">
                          {member.name ? member.name.substring(0, 2).toUpperCase() : "MD"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {member.name || "Medical Staff"}
                          </span>
                          {member.userId === session.user.id && (
                            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                              (Current You)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-slate-600 dark:text-[#a1a1a1]">
                      {member.email}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-xs font-mono text-[11px] font-bold ${
                          member.role === "HOSPITAL_ADMIN"
                            ? "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50"
                            : "bg-slate-100 dark:bg-[#1a1a1a] text-slate-800 dark:text-[#ccc] border border-slate-200 dark:border-[#333]"
                        }`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-mono">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {member.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-slate-500 dark:text-[#777]">
                      {new Date(member.joinedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Pending Invitations */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#222222] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Pending Staff Invitations ({invitations.length})
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-[#777] font-mono mt-0.5">
                Staff members can enter these codes on the Hospital Setup page to join this facility.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Auto-expires in 7 days</span>
          </div>

          {invitations.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-slate-500">
              No pending invitations. Click &quot;Invite Staff Member&quot; above to issue an invitation code.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1f1f1f] bg-slate-50/50 dark:bg-[#121212]/50 text-[11px] font-mono uppercase text-slate-500 dark:text-[#777]">
                    <th className="py-3 px-6">Invitation Code</th>
                    <th className="py-3 px-6">Target Email</th>
                    <th className="py-3 px-6">Role Offered</th>
                    <th className="py-3 px-6">Expires Date</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] text-xs">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-[#111111] transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm font-bold tracking-widest text-slate-900 dark:text-white bg-slate-100 dark:bg-[#1a1a1a] px-2 py-1 rounded-xs border border-slate-200 dark:border-[#333]">
                            {inv.code}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inv.code, "code")}
                            className="text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            Copy Code
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-600 dark:text-[#a1a1a1]">
                        {inv.email || <span className="text-slate-400 italic">Open / Any Recipient</span>}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-xs font-mono text-[11px] font-bold ${
                            inv.role === "HOSPITAL_ADMIN"
                              ? "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300"
                              : "bg-slate-100 dark:bg-[#1a1a1a] text-slate-800 dark:text-[#ccc]"
                          }`}
                        >
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-500 dark:text-[#777]">
                        {new Date(inv.expiresAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          disabled={revokingId === inv.id}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/80 text-red-700 dark:text-red-400 font-mono text-[11px] font-semibold border border-red-200 dark:border-red-900/50 rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {revokingId === inv.id ? "Revoking..." : "Revoke"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-[#222222] rounded-sm max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-[#222222]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono uppercase">
                Generate Staff Invitation
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-mono text-lg"
              >
                &times;
              </button>
            </div>

            {inviteError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-sm text-xs font-mono text-red-700 dark:text-red-400">
                {inviteError}
              </div>
            )}

            {generatedInvite ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-900/50 rounded-sm text-center">
                  <div className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-400 mb-1">
                    INVITATION CREATED SUCCESSFULLY
                  </div>
                  <div className="text-2xl font-mono font-bold tracking-widest text-slate-900 dark:text-white my-2">
                    {generatedInvite.code}
                  </div>
                  <p className="text-[11px] font-mono text-slate-600 dark:text-[#999]">
                    Role: <span className="font-bold">{generatedInvite.role}</span> &bull; Valid for 7 days
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedInvite.code, "code")}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-[#ededed] dark:hover:bg-white text-white dark:text-black font-mono text-xs font-bold rounded-sm transition-colors cursor-pointer"
                  >
                    {copiedCode ? "✓ CODE COPIED TO CLIPBOARD" : "COPY INVITATION CODE"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const joinUrl = `${window.location.origin}/hospital-setup?code=${generatedInvite.code}`;
                      copyToClipboard(joinUrl, "link");
                    }}
                    className="w-full py-2.5 border border-slate-300 dark:border-[#333] hover:border-slate-400 dark:hover:border-[#555] bg-white dark:bg-[#141414] text-slate-800 dark:text-[#ededed] font-mono text-xs rounded-sm transition-colors cursor-pointer"
                  >
                    {copiedLink ? "✓ DIRECT JOIN LINK COPIED" : "COPY DIRECT ONBOARDING LINK"}
                  </button>
                </div>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedInvite(null);
                      setShowInviteModal(false);
                    }}
                    className="text-xs font-mono text-slate-500 hover:text-slate-800 dark:hover:text-white underline cursor-pointer"
                  >
                    Close Dialog
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-slate-700 dark:text-[#a1a1a1] mb-1">
                    Role to Assign *
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "HOSPITAL_STAFF" | "HOSPITAL_ADMIN")}
                    className="w-full px-3 py-2 bg-white dark:bg-[#141414] border border-slate-300 dark:border-[#333] rounded-sm text-xs font-mono text-slate-900 dark:text-white outline-none"
                  >

                    <option value="HOSPITAL_STAFF">HOSPITAL_STAFF — Bed telemetry & dispatch handling</option>
                    <option value="HOSPITAL_ADMIN">HOSPITAL_ADMIN — Full facility & staff management</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-slate-700 dark:text-[#a1a1a1] mb-1">
                    Specific Recipient Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="doctor@hospital.org (leave blank for any staff)"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#141414] border border-slate-300 dark:border-[#333] rounded-sm text-xs font-mono text-slate-900 dark:text-white outline-none"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-[#666] font-mono block mt-1">
                    If specified, only an account matching this email will be permitted to redeem the code.
                  </span>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 border border-slate-300 dark:border-[#333] text-xs font-mono rounded-sm text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="px-5 py-2 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-mono font-semibold rounded-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {creatingInvite ? "GENERATING..." : "GENERATE INVITATION"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
