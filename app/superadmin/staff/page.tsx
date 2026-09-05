"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { SuperAdminNav, SuperAdminGateway } from "@/components/superadmin-nav";
import { formatDate } from "@/lib/format-date";

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
  status: "ACTIVE" | "SUSPENDED";
  joinedAt: string;
}

interface HospitalOption {
  id: string;
  name: string;
  city: string | null;
}

interface InvitationItem {
  id: string;
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string | null;
  code: string;
  email: string | null;
  role: "HOSPITAL_ADMIN" | "HOSPITAL_STAFF";
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
  inviterName?: string | null;
  inviterEmail?: string | null;
}

function SuperAdminStaffContent() {
  const searchParams = useSearchParams();
  const initialHospitalId = searchParams.get("hospitalId") || "ALL";

  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [hospitalsList, setHospitalsList] = useState<HospitalOption[]>([]);
  const [invitationsList, setInvitationsList] = useState<InvitationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [hospitalFilter, setHospitalFilter] = useState(initialHospitalId);
  const [roleFilter, setRoleFilter] = useState<"ALL" | "HOSPITAL_ADMIN" | "HOSPITAL_STAFF">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");

  // Active view: "members" or "invitations"
  const [viewTab, setViewTab] = useState<"members" | "invitations">("members");

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [revokingMembership, setRevokingMembership] = useState<StaffItem | null>(null);

  // Forms
  const [newStaffForm, setNewStaffForm] = useState({
    hospitalId: "",
    name: "",
    email: "",
    role: "HOSPITAL_STAFF" as "HOSPITAL_STAFF" | "HOSPITAL_ADMIN",
  });

  const [newInviteForm, setNewInviteForm] = useState({
    hospitalId: "",
    email: "",
    role: "HOSPITAL_STAFF" as "HOSPITAL_STAFF" | "HOSPITAL_ADMIN",
  });

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchAllStaffData = async () => {
    try {
      setRefreshing(true);
      setErrorMessage(null);

      const [staffRes, hospRes, invRes] = await Promise.all([
        fetch("/api/superadmin/staff"),
        fetch("/api/superadmin/hospitals"),
        fetch("/api/superadmin/invitations"),
      ]);

      if (staffRes.status === 401 || hospRes.status === 401) {
        setForbidden(false);
        return;
      }
      if (staffRes.status === 403 || hospRes.status === 403) {
        setForbidden(true);
        return;
      }

      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffList(data.staff || []);
      }

      if (hospRes.ok) {
        const hospData = await hospRes.json();
        const simplified = (hospData.hospitals || []).map((h: any) => ({
          id: h.id,
          name: h.name,
          city: h.city,
        }));
        setHospitalsList(simplified);

        // Pre-fill hospital in modal form
        if (simplified.length > 0 && !newStaffForm.hospitalId) {
          setNewStaffForm((prev) => ({ ...prev, hospitalId: simplified[0].id }));
          setNewInviteForm((prev) => ({ ...prev, hospitalId: simplified[0].id }));
        }
      }

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitationsList(invData.invitations || []);
      }

      setForbidden(false);
    } catch (err: any) {
      console.error("Error loading staff data:", err);
      setErrorMessage("Network error while loading staff personnel telemetry");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      if (session?.user) {
        fetchAllStaffData();
      } else {
        setLoading(false);
      }
    }
  }, [session, sessionLoading]);

  // Sync hospitalFilter if query param changed
  useEffect(() => {
    if (searchParams.get("hospitalId")) {
      setHospitalFilter(searchParams.get("hospitalId") || "ALL");
    }
  }, [searchParams]);

  // Filtered staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesHospital = hospitalFilter === "ALL" || s.hospitalId === hospitalFilter;
      const matchesRole = roleFilter === "ALL" || s.role === roleFilter;
      const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;

      if (!matchesHospital || !matchesRole || !matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.userName.toLowerCase().includes(q) ||
        s.userEmail.toLowerCase().includes(q) ||
        s.hospitalName.toLowerCase().includes(q) ||
        (s.hospitalCity && s.hospitalCity.toLowerCase().includes(q))
      );
    });
  }, [staffList, searchQuery, hospitalFilter, roleFilter, statusFilter]);

  // Filtered invitations
  const filteredInvitations = useMemo(() => {
    return invitationsList.filter((inv) => {
      const matchesHospital = hospitalFilter === "ALL" || inv.hospitalId === hospitalFilter;
      const matchesRole = roleFilter === "ALL" || inv.role === roleFilter;

      if (!matchesHospital || !matchesRole) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        inv.code.toLowerCase().includes(q) ||
        inv.hospitalName.toLowerCase().includes(q) ||
        (inv.email && inv.email.toLowerCase().includes(q))
      );
    });
  }, [invitationsList, searchQuery, hospitalFilter, roleFilter]);

  // 1. Direct Add Staff Membership
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.hospitalId || !newStaffForm.email.trim()) {
      alert("Hospital and Staff Email are required.");
      return;
    }

    try {
      setUpdatingId("create-staff");
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaffForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to enroll staff member");
      }

      setShowAddStaffModal(false);
      setNewStaffForm({
        hospitalId: hospitalsList[0]?.id || "",
        name: "",
        email: "",
        role: "HOSPITAL_STAFF",
      });
      setActionMessage(`Enrolled '${data.user?.name || newStaffForm.email}' as ${newStaffForm.role} in Neon Postgres.`);
      await fetchAllStaffData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // 2. Issue Invitation Code
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteForm.hospitalId) {
      alert("Hospital selection is required.");
      return;
    }

    try {
      setUpdatingId("create-invite");
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInviteForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate invitation code");
      }

      setShowInviteModal(false);
      setNewInviteForm({
        hospitalId: hospitalsList[0]?.id || "",
        email: "",
        role: "HOSPITAL_STAFF",
      });
      setActionMessage(`Generated invitation code '${data.invitation.code}' for ${data.invitation.role}. Valid for 7 days.`);
      setViewTab("invitations");
      await fetchAllStaffData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // 3. Promote / Demote Role
  const handleToggleStaffRole = async (member: StaffItem) => {
    const nextRole = member.role === "HOSPITAL_ADMIN" ? "HOSPITAL_STAFF" : "HOSPITAL_ADMIN";
    const actionName = nextRole === "HOSPITAL_ADMIN" ? "Promote to HOSPITAL_ADMIN" : "Demote to HOSPITAL_STAFF";

    if (!confirm(`${actionName} for ${member.userName} (${member.userEmail})?`)) {
      return;
    }

    try {
      setUpdatingId(member.membershipId);
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: member.membershipId,
          role: nextRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update staff role");
      }

      setActionMessage(`Updated ${member.userName}'s role to ${nextRole}.`);
      await fetchAllStaffData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // 4. Suspend / Activate Membership
  const handleToggleStaffStatus = async (member: StaffItem) => {
    const nextStatus = member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const actionName = nextStatus === "SUSPENDED" ? "Suspend membership" : "Activate membership";

    if (!confirm(`${actionName} for ${member.userName} at ${member.hospitalName}?`)) {
      return;
    }

    try {
      setUpdatingId(member.membershipId);
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: member.membershipId,
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update membership status");
      }

      setActionMessage(`Staff membership for ${member.userName} set to ${nextStatus}.`);
      await fetchAllStaffData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // 5. Revoke / Remove Membership
  const handleConfirmRevoke = async () => {
    if (!revokingMembership) return;

    try {
      setUpdatingId(revokingMembership.membershipId);
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: revokingMembership.membershipId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke membership");
      }

      const name = revokingMembership.userName;
      const hosp = revokingMembership.hospitalName;
      setRevokingMembership(null);
      setActionMessage(`Revoked hospital membership for ${name} from ${hosp}.`);
      await fetchAllStaffData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // 6. Revoke Invitation Code
  const handleRevokeInvitation = async (invitationId: string, code: string) => {
    if (!confirm(`Revoke invitation code '${code}'? It will be marked REVOKED and cannot be used.`)) {
      return;
    }

    try {
      setUpdatingId(invitationId);
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke invitation");
      }

      setActionMessage(`Invitation code '${code}' revoked.`);
      await fetchAllStaffData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Gateway check (auth / clearance)
  if (sessionLoading || !session?.user || forbidden) {
    return (
      <SuperAdminGateway
        sessionLoading={sessionLoading || (Boolean(session?.user) && loading)}
        hasSession={Boolean(session?.user)}
        forbidden={forbidden}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      <SuperAdminNav activeTab="staff" onRefresh={fetchAllStaffData} refreshing={refreshing} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner Alert Messages */}
        {actionMessage && (
          <div className="mb-6 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-mono rounded-sm flex items-center justify-between shadow-2xs">
            <span>✓ {actionMessage}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-100 font-bold ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800/40 text-red-800 dark:text-red-300 text-xs font-mono rounded-sm flex items-center justify-between shadow-2xs">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-600 hover:text-red-900 dark:hover:text-red-100 font-bold ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Page Title & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-blue-700 dark:text-blue-400 font-bold">
                PERSONNEL DIRECTORY
              </span>
              <span className="text-slate-400 dark:text-[#444]">•</span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-[#777]">
                Total: {staffList.length} Active Staff Memberships
              </span>
            </div>
            <h1 className="text-2xl font-bold font-sans tracking-tight text-slate-900 dark:text-[#ededed] mt-0.5">
              Staff &amp; Membership Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#888] mt-1">
              Cross-facility medical staff rosters, administrator clearances, direct enrollments, and invitation tokens.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-3.5 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] bg-white dark:bg-[#111] hover:bg-slate-50 dark:hover:bg-[#181818] border border-slate-300 dark:border-[#2a2a2a] rounded-sm transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Generate Invite Code
            </button>

            <button
              onClick={() => setShowAddStaffModal(true)}
              className="px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-all cursor-pointer flex items-center gap-2 shadow-2xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Direct Enroll Staff
            </button>
          </div>
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 font-mono">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-3.5 rounded-sm shadow-2xs">
            <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase tracking-wider">Total Personnel</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">{staffList.length}</div>
            <div className="text-[11px] text-slate-500 dark:text-[#666] mt-1">Across all facilities</div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-3.5 rounded-sm shadow-2xs">
            <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase tracking-wider">Hospital Admins</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {staffList.filter((s) => s.role === "HOSPITAL_ADMIN").length}
            </div>
            <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">Facility Operations Leads</div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-3.5 rounded-sm shadow-2xs">
            <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase tracking-wider">Medical Staff</div>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">
              {staffList.filter((s) => s.role === "HOSPITAL_STAFF").length}
            </div>
            <div className="text-[11px] text-sky-600/80 dark:text-sky-400/80 mt-1">Clinical / Bed Officers</div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-3.5 rounded-sm shadow-2xs">
            <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase tracking-wider">Pending Invites</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {invitationsList.filter((i) => i.status === "PENDING").length}
            </div>
            <div className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-1">Ready for Redemption</div>
          </div>
        </div>

        {/* View Switcher Tabs: Memberships vs Invitations */}
        <div className="flex border-b border-slate-200 dark:border-[#222222] font-mono text-xs uppercase tracking-wider mb-6">
          <button
            onClick={() => setViewTab("members")}
            className={`px-4 py-2.5 border-b-2 font-bold transition-all cursor-pointer ${
              viewTab === "members"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed]"
            }`}
          >
            Staff Personnel Roster ({staffList.length})
          </button>
          <button
            onClick={() => setViewTab("invitations")}
            className={`px-4 py-2.5 border-b-2 font-bold transition-all cursor-pointer ${
              viewTab === "invitations"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed]"
            }`}
          >
            Invitation Tokens ({invitationsList.length})
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-4 rounded-sm shadow-2xs mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <input
                  type="text"
                  placeholder={
                    viewTab === "members"
                      ? "Search staff by name, email, or hospital..."
                      : "Search by invite code, email, or hospital..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm focus:outline-none focus:border-blue-600 text-slate-900 dark:text-[#ededed]"
                />
                <svg
                  className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <select
                value={hospitalFilter}
                onChange={(e) => setHospitalFilter(e.target.value)}
                className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer max-w-xs truncate"
              >
                <option value="ALL">All Hospitals ({hospitalsList.length})</option>
                {hospitalsList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} {h.city ? `(${h.city})` : ""}
                  </option>
                ))}
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="HOSPITAL_ADMIN">HOSPITAL_ADMIN</option>
                <option value="HOSPITAL_STAFF">HOSPITAL_STAFF</option>
              </select>

              {viewTab === "members" && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              )}
            </div>

            <div className="text-xs font-mono text-slate-500 dark:text-[#777] self-end md:self-center">
              {viewTab === "members"
                ? `Showing ${filteredStaff.length} of ${staffList.length} staff`
                : `Showing ${filteredInvitations.length} of ${invitationsList.length} invitations`}
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* VIEW TAB 1: STAFF MEMBERSHIP TABLE */}
        {/* ============================================================= */}
        {viewTab === "members" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Staff Member & Email</th>
                    <th className="py-3 px-4 font-semibold">Hospital Facility</th>
                    <th className="py-3 px-4 font-semibold">Role</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Joined Date</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] font-mono">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-[#666]">
                        <div className="font-mono text-sm">NO STAFF MEMBERS MATCH FILTER CRITERIA</div>
                        <div className="text-xs mt-1">Try resetting the hospital or role filter.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((member) => (
                      <tr
                        key={member.membershipId}
                        className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-[#ededed]">{member.userName}</div>
                          <div className="text-[10px] text-slate-400 dark:text-[#666] mt-0.5">{member.userEmail}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-[#aaa]">
                          <div className="font-semibold text-slate-800 dark:text-[#ccc]">{member.hospitalName}</div>
                          <div className="text-[10px] text-slate-400 dark:text-[#666]">
                            📍 {member.hospitalCity || "India"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                              member.role === "HOSPITAL_ADMIN"
                                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60"
                                : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700/60"
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                              member.status === "ACTIVE"
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/40"
                                : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800/40"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-[#777]">
                          {formatDate(member.joinedAt)}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStaffRole(member)}
                            disabled={updatingId === member.membershipId}
                            className="px-2 py-1 text-[11px] font-mono font-semibold uppercase rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 transition-all cursor-pointer"
                            title={member.role === "HOSPITAL_ADMIN" ? "Demote to Staff" : "Promote to Admin"}
                          >
                            {member.role === "HOSPITAL_ADMIN" ? "Demote" : "Make Admin"}
                          </button>
                          <button
                            onClick={() => handleToggleStaffStatus(member)}
                            disabled={updatingId === member.membershipId}
                            className={`px-2 py-1 text-[11px] font-mono font-semibold uppercase rounded-sm border transition-all cursor-pointer ${
                              member.status === "ACTIVE"
                                ? "border-amber-300 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50"
                                : "border-emerald-300 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50"
                            }`}
                          >
                            {member.status === "ACTIVE" ? "Suspend" : "Activate"}
                          </button>
                          <button
                            onClick={() => setRevokingMembership(member)}
                            disabled={updatingId === member.membershipId}
                            className="px-2 py-1 text-[11px] font-mono font-bold uppercase rounded-sm border border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                            title="Remove hospital membership"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* VIEW TAB 2: INVITATIONS TABLE */}
        {/* ============================================================= */}
        {viewTab === "invitations" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Invite Code</th>
                    <th className="py-3 px-4 font-semibold">Target Hospital</th>
                    <th className="py-3 px-4 font-semibold">Designated Role</th>
                    <th className="py-3 px-4 font-semibold">Target Email</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Expires At</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] font-mono">
                  {filteredInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-[#666]">
                        <div className="font-mono text-sm">NO INVITATION TOKENS FOUND</div>
                        <div className="text-xs mt-1">Generate a new invitation code to onboard clinical staff.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredInvitations.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-blue-700 dark:text-blue-400 tracking-wider">
                              {inv.code}
                            </span>
                            <button
                              onClick={() => copyToClipboard(inv.code)}
                              className="px-1.5 py-0.5 text-[10px] rounded-xs border border-slate-200 dark:border-[#333] hover:border-blue-600 text-slate-600 dark:text-[#888] cursor-pointer"
                              title="Copy code to clipboard"
                            >
                              {copiedCode === inv.code ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-[#aaa]">
                          <div className="font-semibold text-slate-800 dark:text-[#ccc]">{inv.hospitalName}</div>
                          <div className="text-[10px] text-slate-400 dark:text-[#666]">
                            📍 {inv.hospitalCity || "India"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                              inv.role === "HOSPITAL_ADMIN"
                                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300"
                            }`}
                          >
                            {inv.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-[#bbb]">
                          {inv.email || <span className="italic text-slate-400">Open to Any User</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                              inv.status === "PENDING"
                                ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50"
                                : inv.status === "ACCEPTED"
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                                : "bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-[#777]"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-[#777]">
                          {formatDate(inv.expiresAt)}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {inv.status === "PENDING" && (
                            <button
                              onClick={() => handleRevokeInvitation(inv.id, inv.code)}
                              disabled={updatingId === inv.id}
                              className="px-2 py-1 text-[11px] font-mono font-bold uppercase rounded-sm border border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================= */}
      {/* MODAL 1: DIRECT ENROLL STAFF */}
      {/* ============================================================= */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#222222] pb-4 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-700 dark:text-blue-400 font-bold">
                  DIRECT ENROLLMENT
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed] font-sans">
                  Enroll Hospital Staff Member
                </h3>
              </div>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-[#eee] text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">
                  Hospital Facility *
                </label>
                <select
                  required
                  value={newStaffForm.hospitalId}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, hospitalId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  {hospitalsList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.city ? `(${h.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">
                  Staff Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="doctor.name@hospital.org"
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">
                  Staff Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Dr. Rajesh Kumar"
                  value={newStaffForm.name}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">
                  Assigned Membership Role *
                </label>
                <select
                  value={newStaffForm.role}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="HOSPITAL_STAFF">HOSPITAL_STAFF (Update Bed Telemetry & Accept Dispatches)</option>
                  <option value="HOSPITAL_ADMIN">HOSPITAL_ADMIN (Full Facility Operations & Admin Control)</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-sm text-[11px] text-slate-600 dark:text-[#888]">
                🛡️ Identity Preservation: If a user with this email already exists in the national database, their existing account is reused, avoiding duplicate auth user creation.
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#222222] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-700 dark:text-[#ccc] hover:border-slate-400 uppercase font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === "create-staff"}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-sm font-semibold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {updatingId === "create-staff" ? "Enrolling..." : "Enroll Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: ISSUE INVITATION CODE */}
      {/* ============================================================= */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#222222] pb-4 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-purple-700 dark:text-purple-400 font-bold">
                  CRYPTOGRAPHIC ONBOARDING
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed] font-sans">
                  Generate Staff Invitation Code
                </h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-[#eee] text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvitation} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">
                  Hospital Facility *
                </label>
                <select
                  required
                  value={newInviteForm.hospitalId}
                  onChange={(e) => setNewInviteForm({ ...newInviteForm, hospitalId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  {hospitalsList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.city ? `(${h.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">
                  Assigned Membership Role *
                </label>
                <select
                  value={newInviteForm.role}
                  onChange={(e) => setNewInviteForm({ ...newInviteForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="HOSPITAL_STAFF">HOSPITAL_STAFF</option>
                  <option value="HOSPITAL_ADMIN">HOSPITAL_ADMIN</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">
                  Designated Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="Leave empty to allow redemption by any authorized doctor"
                  value={newInviteForm.email}
                  onChange={(e) => setNewInviteForm({ ...newInviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-sm text-[11px] text-purple-900 dark:text-purple-300">
                🎫 Generates a secure, 6-character code (e.g., BR-XXXXXX) valid for 7 days. The user can enter this code during signup or onboarding to join the facility immediately.
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#222222] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-700 dark:text-[#ccc] hover:border-slate-400 uppercase font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === "create-invite"}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700 text-white rounded-sm font-semibold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {updatingId === "create-invite" ? "Generating..." : "Generate Code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 3: CONFIRM REVOKE MEMBERSHIP */}
      {/* ============================================================= */}
      {revokingMembership && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-red-300 dark:border-red-900/60 rounded-sm max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-mono text-xs font-bold uppercase mb-2">
              <span>⚠️</span>
              <span>CONFIRM MEMBERSHIP REVOCATION</span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-[#ededed] font-sans">
              Revoke {revokingMembership.userName}&apos;s Access?
            </h3>

            <p className="text-xs text-slate-600 dark:text-[#888] font-mono mt-2 leading-relaxed">
              This will remove {revokingMembership.userName} ({revokingMembership.userEmail}) from the staff roster of{" "}
              <strong>{revokingMembership.hospitalName}</strong>. The user&apos;s base account remains intact, but facility permissions are stripped immediately.
            </p>

            <div className="my-4 p-3 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-sm font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Role:</span>
                <span className="font-bold text-slate-900 dark:text-[#ededed]">{revokingMembership.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Facility:</span>
                <span className="font-bold text-slate-900 dark:text-[#ededed]">{revokingMembership.hospitalName}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#222222] flex justify-end gap-3 font-mono">
              <button
                type="button"
                onClick={() => setRevokingMembership(null)}
                className="px-3.5 py-2 border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-700 dark:text-[#ccc] hover:border-slate-400 uppercase font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={updatingId === revokingMembership.membershipId}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-sm font-bold uppercase tracking-wider cursor-pointer text-xs disabled:opacity-50"
              >
                {updatingId === revokingMembership.membershipId ? "Revoking..." : "Confirm Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminStaffPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-mono flex items-center justify-center text-xs">
          LOADING PERSONNEL DIRECTORY...
        </div>
      }
    >
      <SuperAdminStaffContent />
    </Suspense>
  );
}
