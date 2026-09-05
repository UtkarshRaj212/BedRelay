"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDate, formatDateTime } from "@/lib/format-date";

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

interface BedItem {
  id: string;
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string | null;
  categoryCode: string;
  name: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  lastUpdated: string;
  createdAt: string;
}

interface DispatchItem {
  id: string;
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string | null;
  hospitalState: string | null;
  ambulanceUnit: string;
  ambulanceLat: number | null;
  ambulanceLng: number | null;
  patientRef: string | null;
  bedCategoryCode: string;
  requestedBeds: number;
  etaMinutes: number;
  patientCondition: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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

const CITY_PRESETS = [
  { city: "New Delhi", state: "Delhi", lat: 28.5921, lng: 77.0460 },
  { city: "Mumbai", state: "Maharashtra", lat: 19.0028, lng: 72.8423 },
  { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { city: "Chennai", state: "Tamil Nadu", lat: 13.0604, lng: 80.2512 },
  { city: "Hyderabad", state: "Telangana", lat: 17.4649, lng: 78.3686 },
  { city: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
  { city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
];

export default function SuperAdminPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [hospitalsList, setHospitalsList] = useState<HospitalItem[]>([]);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [bedsList, setBedsList] = useState<BedItem[]>([]);
  const [dispatchesList, setDispatchesList] = useState<DispatchItem[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "hospitals" | "staff" | "beds" | "dispatches" | "audit">("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Search & Filter states
  const [hospSearch, setHospSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [staffHospitalFilter, setStaffHospitalFilter] = useState("ALL");
  const [bedSearch, setBedSearch] = useState("");
  const [bedHospitalFilter, setBedHospitalFilter] = useState("ALL");
  const [dispSearch, setDispSearch] = useState("");
  const [dispStatusFilter, setDispStatusFilter] = useState("ALL");
  const [auditSearch, setAuditSearch] = useState("");

  // Modals state
  const [showAddHospitalModal, setShowAddHospitalModal] = useState(false);
  const [newHospitalForm, setNewHospitalForm] = useState({
    name: "",
    address: "",
    city: "New Delhi",
    state: "Delhi",
    phone: "+91 11 ",
    latitude: "28.5921",
    longitude: "77.0460",
    status: "ACTIVE",
  });

  const [editingHospital, setEditingHospital] = useState<HospitalItem | null>(null);
  const [editHospitalForm, setEditHospitalForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    latitude: "",
    longitude: "",
    status: "ACTIVE",
  });

  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    hospitalId: "",
    name: "",
    email: "",
    role: "HOSPITAL_STAFF" as "HOSPITAL_STAFF" | "HOSPITAL_ADMIN",
  });

  const [showAddBedModal, setShowAddBedModal] = useState(false);
  const [newBedForm, setNewBedForm] = useState({
    hospitalId: "",
    categoryCode: "ICU",
    name: "Intensive Care Unit (ICU)",
    totalBeds: 20,
    availableBeds: 5,
  });

  const [editingBed, setEditingBed] = useState<BedItem | null>(null);
  const [editBedForm, setEditBedForm] = useState({
    name: "",
    totalBeds: 0,
    availableBeds: 0,
  });

  // Fetch all administrative telemetry & tables from Neon Postgres
  const fetchAllData = async () => {
    try {
      setRefreshing(true);
      setActionMessage(null);

      const [statsRes, hospRes, staffRes, bedsRes, dispRes] = await Promise.all([
        fetch("/api/superadmin/stats"),
        fetch("/api/superadmin/hospitals"),
        fetch("/api/superadmin/staff"),
        fetch("/api/superadmin/beds"),
        fetch("/api/superadmin/dispatches"),
      ]);

      if (statsRes.status === 401) {
        setForbidden(false);
        setStats(null);
        return;
      }
      if (statsRes.status === 403) {
        setForbidden(true);
        setStats(null);
        return;
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
        setAuditLogs(statsData.recentAuditLogs || []);
      }
      if (hospRes.ok) {
        const hospData = await hospRes.json();
        setHospitalsList(hospData.hospitals || []);
      }
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaffList(staffData.staff || []);
      }
      if (bedsRes.ok) {
        const bedsData = await bedsRes.json();
        setBedsList(bedsData.beds || []);
      }
      if (dispRes.ok) {
        const dispData = await dispRes.json();
        setDispatchesList(dispData.dispatches || []);
      }

      setForbidden(false);
    } catch (err) {
      console.error("Failed to load SuperAdmin telemetry:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      if (session?.user) {
        fetchAllData();
      } else {
        setLoading(false);
      }
    }
  }, [session, sessionLoading]);

  // Set default hospitalId for modals when hospitalsList loads
  useEffect(() => {
    if (hospitalsList.length > 0) {
      if (!newStaffForm.hospitalId) {
        setNewStaffForm((prev) => ({ ...prev, hospitalId: hospitalsList[0].id }));
      }
      if (!newBedForm.hospitalId) {
        setNewBedForm((prev) => ({ ...prev, hospitalId: hospitalsList[0].id }));
      }
    }
  }, [hospitalsList]);

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

  // -------------------------------------------------------------
  // HOSPITAL ACTIONS
  // -------------------------------------------------------------
  const handleCreateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdatingId("create-hosp");
      const res = await fetch("/api/superadmin/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHospitalForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create hospital");
      }

      setShowAddHospitalModal(false);
      setActionMessage(`Created hospital '${newHospitalForm.name}' with starter bed categories.`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenEditHospital = (hosp: HospitalItem) => {
    setEditingHospital(hosp);
    setEditHospitalForm({
      name: hosp.name,
      address: hosp.address || "",
      city: hosp.city || "",
      state: hosp.state || "",
      phone: hosp.phone || "",
      latitude: hosp.latitude !== null ? String(hosp.latitude) : "",
      longitude: hosp.longitude !== null ? String(hosp.longitude) : "",
      status: hosp.status || "ACTIVE",
    });
  };

  const handleSaveEditHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHospital) return;
    try {
      setUpdatingId(editingHospital.id);
      const res = await fetch("/api/superadmin/hospitals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: editingHospital.id,
          ...editHospitalForm,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update hospital");
      }

      setEditingHospital(null);
      setActionMessage(`Updated parameters for '${editHospitalForm.name}'.`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

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
        setActionMessage(`Set ${hosp.name} status to ${nextStatus}.`);
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteHospital = async (hosp: HospitalItem) => {
    const confirmDelete = confirm(
      `PERMANENT REMOVAL: Are you sure you want to delete '${hosp.name}'?\n\nThis will purge all associated bed records, dispatch requests, and staff memberships from Neon Postgres.`
    );
    if (!confirmDelete) return;

    try {
      setUpdatingId(hosp.id);
      const res = await fetch("/api/superadmin/hospitals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitalId: hosp.id }),
      });

      if (res.ok) {
        setActionMessage(`Deleted hospital '${hosp.name}' and all associated records.`);
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  // -------------------------------------------------------------
  // STAFF ACTIONS
  // -------------------------------------------------------------
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdatingId("add-staff");
      const res = await fetch("/api/superadmin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaffForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add staff member");
      }

      setShowAddStaffModal(false);
      setActionMessage(`Assigned ${newStaffForm.email} as ${newStaffForm.role}.`);
      setNewStaffForm({ hospitalId: hospitalsList[0]?.id || "", name: "", email: "", role: "HOSPITAL_STAFF" });
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

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
        setActionMessage(`Updated role for ${member.userName} to ${nextRole}.`);
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleStaffStatus = async (member: StaffItem) => {
    const nextStatus = member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      setUpdatingId(member.membershipId);
      const res = await fetch("/api/superadmin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: member.membershipId, status: nextStatus }),
      });

      if (res.ok) {
        setActionMessage(`Set status for ${member.userName} to ${nextStatus}.`);
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

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
        setActionMessage(`Revoked access for ${member.userName}.`);
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  // -------------------------------------------------------------
  // BED ACTIONS
  // -------------------------------------------------------------
  const handleAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdatingId("add-bed");
      const res = await fetch("/api/superadmin/beds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBedForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add bed category");
      }

      setShowAddBedModal(false);
      setActionMessage(`Created bed category '${newBedForm.categoryCode}' for hospital.`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenEditBed = (bed: BedItem) => {
    setEditingBed(bed);
    setEditBedForm({
      name: bed.name,
      totalBeds: bed.totalBeds,
      availableBeds: bed.availableBeds,
    });
  };

  const handleSaveEditBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBed) return;
    try {
      setUpdatingId(editingBed.id);
      const res = await fetch("/api/superadmin/beds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: editingBed.id,
          ...editBedForm,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update bed capacity");
      }

      setEditingBed(null);
      setActionMessage(`Updated capacity for '${editingBed.name}'.`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteBed = async (bed: BedItem) => {
    if (!confirm(`Delete bed category '${bed.name}' (${bed.categoryCode}) from ${bed.hospitalName}?`)) return;
    try {
      setUpdatingId(bed.id);
      const res = await fetch("/api/superadmin/beds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: bed.id }),
      });

      if (res.ok) {
        setActionMessage(`Deleted bed category '${bed.name}'.`);
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  // -------------------------------------------------------------
  // DISPATCH ACTIONS
  // -------------------------------------------------------------
  const handleUpdateDispatchStatus = async (dispatchId: string, newStatus: string) => {
    try {
      setUpdatingId(dispatchId);
      const res = await fetch("/api/superadmin/dispatches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatchId, status: newStatus }),
      });

      if (res.ok) {
        setActionMessage(`Updated dispatch ${dispatchId} status to ${newStatus}.`);
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteDispatch = async (dispatchId: string) => {
    if (!confirm(`Purge dispatch request ${dispatchId}?`)) return;
    try {
      setUpdatingId(dispatchId);
      const res = await fetch("/api/superadmin/dispatches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatchId }),
      });

      if (res.ok) {
        setActionMessage(`Purged dispatch request ${dispatchId}.`);
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  // 1. Loading State
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

  // 2. Unauthenticated State
  if (!session?.user) {
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

  // 3. Authenticated but Forbidden
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

  // 4. Authorized SuperAdmin Shell
  const filteredHospitals = hospitalsList.filter((h) => {
    if (!hospSearch.trim()) return true;
    const q = hospSearch.toLowerCase();
    return h.name.toLowerCase().includes(q) || (h.city && h.city.toLowerCase().includes(q));
  });

  const filteredStaff = staffList.filter((s) => {
    const matchesHospital = staffHospitalFilter === "ALL" || s.hospitalId === staffHospitalFilter;
    if (!matchesHospital) return false;
    if (!staffSearch.trim()) return true;
    const q = staffSearch.toLowerCase();
    return (
      s.userName.toLowerCase().includes(q) ||
      s.userEmail.toLowerCase().includes(q) ||
      s.hospitalName.toLowerCase().includes(q)
    );
  });

  const filteredBeds = bedsList.filter((b) => {
    const matchesHospital = bedHospitalFilter === "ALL" || b.hospitalId === bedHospitalFilter;
    if (!matchesHospital) return false;
    if (!bedSearch.trim()) return true;
    const q = bedSearch.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.categoryCode.toLowerCase().includes(q) ||
      b.hospitalName.toLowerCase().includes(q)
    );
  });

  const filteredDispatches = dispatchesList.filter((d) => {
    const matchesStatus = dispStatusFilter === "ALL" || d.status.toUpperCase() === dispStatusFilter.toUpperCase();
    if (!matchesStatus) return false;
    if (!dispSearch.trim()) return true;
    const q = dispSearch.toLowerCase();
    return (
      d.ambulanceUnit.toLowerCase().includes(q) ||
      d.hospitalName.toLowerCase().includes(q) ||
      (d.patientRef && d.patientRef.toLowerCase().includes(q)) ||
      d.bedCategoryCode.toLowerCase().includes(q)
    );
  });

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.resourceType.toLowerCase().includes(q) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(q)) ||
      (log.details && log.details.toLowerCase().includes(q))
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
          <span className="hidden md:inline">ONE SOURCE OF TRUTH (NEON POSTGRES)</span>
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
              onClick={fetchAllData}
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
              <span className="text-amber-600 dark:text-amber-400">{stats?.hospitals.deactivated ?? 0} DEACTIVATED</span>
            </div>
          </div>

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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-[#222222] font-mono text-xs uppercase tracking-wider overflow-x-auto mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "overview"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            System Overview
          </button>
          <Link
            href="/superadmin/hospitals"
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "hospitals"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Hospitals ({hospitalsList.length})
          </Link>
          <Link
            href="/superadmin/staff"
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "staff"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Staff & Memberships ({staffList.length})
          </Link>
          <button
            onClick={() => setActiveTab("beds")}
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "beds"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Bed Records ({bedsList.length})
          </button>
          <button
            onClick={() => setActiveTab("dispatches")}
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "dispatches"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Dispatches ({dispatchesList.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-5 py-3 border-b-2 font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "audit"
                ? "border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#0f0f0f]"
                : "border-transparent text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-[#ededed] hover:border-slate-300 dark:hover:border-[#333]"
            }`}
          >
            Audit Logs ({auditLogs.length})
          </button>
        </div>

        {/* ============================================================= */}
        {/* TAB 1: SYSTEM OVERVIEW */}
        {/* ============================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#ededed] font-sans">
                    National Bed Category Telemetry
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">
                    Live capacity status aggregated directly from Postgres database
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
                  NO BED TELEMETRY DETECTED
                </div>
              )}
            </div>

            {/* Architectural Guarantees */}
            <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#ededed] font-sans mb-4">
                Platform Integration & Zero-Mock Guarantee
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="font-mono font-bold text-slate-900 dark:text-[#ededed] mb-1">
                    [01] SYNCHRONOUS NEON POSTGRES PERSISTENCE
                  </div>
                  <p className="text-slate-600 dark:text-[#888] leading-relaxed">
                    All hospital creations, deactivations, bed modifications, and dispatch state updates write directly to Neon Postgres. No local or mock states exist.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="font-mono font-bold text-slate-900 dark:text-[#ededed] mb-1">
                    [02] INSTANT MULTI-TENANT REFLECTION
                  </div>
                  <p className="text-slate-600 dark:text-[#888] leading-relaxed">
                    Deactivating a facility immediately drops it from EMS dispatcher search, alerts hospital staff on their dashboard, and disables bed modifications.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="font-mono font-bold text-slate-900 dark:text-[#ededed] mb-1">
                    [03] CASCADING POSTGRES REFERENTIAL INTEGRITY
                  </div>
                  <p className="text-slate-600 dark:text-[#888] leading-relaxed">
                    Deleting a hospital automatically cascades deletions to its bed units, memberships, invitations, and dispatch requests, leaving zero orphaned rows.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="font-mono font-bold text-slate-900 dark:text-[#ededed] mb-1">
                    [04] IMMUTABLE CRYPTOGRAPHIC AUDITING
                  </div>
                  <p className="text-slate-600 dark:text-[#888] leading-relaxed">
                    Every create, update, delete, or deactivation by SuperAdmin is recorded into `audit_logs` with actor ID, IP address, and payload diffs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 2: HOSPITALS MANAGEMENT */}
        {/* ============================================================= */}
        {activeTab === "hospitals" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed] font-mono uppercase">
                  National Facility Registry
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#888]">
                  Manage facility identities, geographical coordinates, and activation status
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Filter hospitals by name or city..."
                  value={hospSearch}
                  onChange={(e) => setHospSearch(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm focus:outline-none focus:border-blue-600 text-slate-900 dark:text-[#ededed] w-56"
                />
                <button
                  onClick={() => setShowAddHospitalModal(true)}
                  className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-all cursor-pointer"
                >
                  + Create Hospital
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3 px-4">Hospital Name & ID</th>
                    <th className="py-3 px-4">Location & Phone</th>
                    <th className="py-3 px-4">Coordinates</th>
                    <th className="py-3 px-4">Total Beds</th>
                    <th className="py-3 px-4">Vacant</th>
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
                      <td className="py-3 px-4 text-[11px] text-slate-500">
                        {hosp.latitude?.toFixed(4)}, {hosp.longitude?.toFixed(4)}
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
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditHospital(hosp)}
                          className="px-2 py-1 text-[11px] font-mono font-semibold uppercase rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleHospitalStatus(hosp)}
                          disabled={updatingId === hosp.id}
                          className={`px-2 py-1 text-[11px] font-mono font-bold uppercase rounded-sm border transition-all cursor-pointer ${
                            hosp.status === "ACTIVE"
                              ? "border-amber-300 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              : "border-emerald-300 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          }`}
                        >
                          {updatingId === hosp.id ? "..." : hosp.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDeleteHospital(hosp)}
                          disabled={updatingId === hosp.id}
                          className="px-2 py-1 text-[11px] font-mono font-bold uppercase rounded-sm border border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 3: STAFF & MEMBERSHIPS MANAGEMENT */}
        {/* ============================================================= */}
        {activeTab === "staff" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed] font-mono uppercase">
                  Cross-Hospital Staff & Memberships
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#888]">
                  Manage medical staff personnel, administrator privileges, and hospital affiliations
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={staffHospitalFilter}
                  onChange={(e) => setStaffHospitalFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed]"
                >
                  <option value="ALL">All Hospitals ({hospitalsList.length})</option>
                  {hospitalsList.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Filter staff by name/email..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm focus:outline-none focus:border-blue-600 text-slate-900 dark:text-[#ededed] w-52"
                />

                <button
                  onClick={() => setShowAddStaffModal(true)}
                  className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  + Add Staff
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3 px-4">Staff Member & Email</th>
                    <th className="py-3 px-4">Hospital Facility</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Membership Status</th>
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
                              ? "bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700/60"
                              : "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700/60"
                          }`}
                        >
                          {member.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                            member.status === "ACTIVE"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                              : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-[#777]">
                        {formatDate(member.joinedAt)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStaffRole(member)}
                          disabled={updatingId === member.membershipId}
                          className="px-2 py-1 text-[11px] font-mono font-semibold uppercase rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 transition-all cursor-pointer"
                        >
                          {member.role === "HOSPITAL_ADMIN" ? "Demote" : "Make Admin"}
                        </button>
                        <button
                          onClick={() => handleToggleStaffStatus(member)}
                          disabled={updatingId === member.membershipId}
                          className="px-2 py-1 text-[11px] font-mono font-semibold uppercase rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 transition-all cursor-pointer"
                        >
                          {member.status === "ACTIVE" ? "Suspend" : "Activate"}
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

        {/* ============================================================= */}
        {/* TAB 4: BED RECORDS MANAGEMENT */}
        {/* ============================================================= */}
        {activeTab === "beds" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed] font-mono uppercase">
                  National Bed Telemetry Records
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#888]">
                  Central bed capacity management across all facilities in India
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={bedHospitalFilter}
                  onChange={(e) => setBedHospitalFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed]"
                >
                  <option value="ALL">All Hospitals ({hospitalsList.length})</option>
                  {hospitalsList.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Filter beds by category/hospital..."
                  value={bedSearch}
                  onChange={(e) => setBedSearch(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm focus:outline-none focus:border-blue-600 text-slate-900 dark:text-[#ededed] w-52"
                />

                <button
                  onClick={() => setShowAddBedModal(true)}
                  className="px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  + Add Bed Unit
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3 px-4">Hospital Facility</th>
                    <th className="py-3 px-4">Category Code & Name</th>
                    <th className="py-3 px-4 text-right">Total Capacity</th>
                    <th className="py-3 px-4 text-right">Available Beds</th>
                    <th className="py-3 px-4 text-right">Occupied Beds</th>
                    <th className="py-3 px-4 text-right">Occupancy %</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] font-mono">
                  {filteredBeds.map((bed) => {
                    const occPct = bed.totalBeds > 0 ? Math.round((bed.occupiedBeds / bed.totalBeds) * 100) : 0;
                    return (
                      <tr key={bed.id} className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-[#ededed]">{bed.hospitalName}</div>
                          <div className="text-[10px] text-slate-400 dark:text-[#666]">{bed.hospitalCity}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-blue-700 dark:text-blue-400 mr-2">{bed.categoryCode}</span>
                          <span className="text-slate-700 dark:text-[#ccc]">{bed.name}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-[#ededed]">
                          {bed.totalBeds}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {bed.availableBeds}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-[#aaa]">
                          {bed.occupiedBeds}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-semibold ${occPct > 85 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-[#ccc]"}`}>
                            {occPct}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[10px]">
                          {formatDate(bed.lastUpdated)} {new Date(bed.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEditBed(bed)}
                            className="px-2 py-1 text-[11px] font-mono font-semibold uppercase rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 transition-all cursor-pointer"
                          >
                            Edit Capacity
                          </button>
                          <button
                            onClick={() => handleDeleteBed(bed)}
                            disabled={updatingId === bed.id}
                            className="px-2 py-1 text-[11px] font-mono font-bold uppercase rounded-sm border border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 5: DISPATCH REQUESTS MANAGEMENT */}
        {/* ============================================================= */}
        {activeTab === "dispatches" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed] font-mono uppercase">
                  Central Inbound EMS Dispatches
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#888]">
                  Administrative oversight and status resolution of ambulance dispatch requests
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={dispStatusFilter}
                  onChange={(e) => setDispStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">PENDING</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>

                <input
                  type="text"
                  placeholder="Filter by ambulance/patient/hospital..."
                  value={dispSearch}
                  onChange={(e) => setDispSearch(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm focus:outline-none focus:border-blue-600 text-slate-900 dark:text-[#ededed] w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3 px-4">Dispatch ID & Time</th>
                    <th className="py-3 px-4">Hospital Target</th>
                    <th className="py-3 px-4">Ambulance Unit</th>
                    <th className="py-3 px-4">Category & Beds</th>
                    <th className="py-3 px-4">ETA</th>
                    <th className="py-3 px-4">Patient Condition</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] font-mono">
                  {filteredDispatches.map((disp) => (
                    <tr key={disp.id} className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-[#ededed]">{disp.id}</div>
                        <div className="text-[10px] text-slate-400">{formatDate(disp.createdAt)} {new Date(disp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-[#aaa]">
                        <div>{disp.hospitalName}</div>
                        <div className="text-[10px] text-slate-400">{disp.hospitalCity}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-[#ededed]">{disp.ambulanceUnit}</div>
                        <div className="text-[10px] text-slate-400">{disp.patientRef || "—"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-blue-700 dark:text-blue-400">{disp.bedCategoryCode}</span>
                        <span className="text-slate-500 ml-1">({disp.requestedBeds} requested)</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400">
                        {disp.etaMinutes} mins
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-[#aaa] max-w-xs truncate">
                        {disp.patientCondition}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                            disp.status === "PENDING"
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800/40"
                              : disp.status === "ACCEPTED"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/40"
                              : disp.status === "COMPLETED"
                              ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 border border-blue-300 dark:border-blue-800/40"
                              : "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border border-red-300 dark:border-red-800/40"
                          }`}
                        >
                          {disp.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {disp.status === "PENDING" && (
                          <button
                            onClick={() => handleUpdateDispatchStatus(disp.id, "ACCEPTED")}
                            disabled={updatingId === disp.id}
                            className="px-2 py-1 text-[10px] font-mono font-bold uppercase rounded-sm border border-emerald-300 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all cursor-pointer"
                          >
                            Accept
                          </button>
                        )}
                        {disp.status === "ACCEPTED" && (
                          <button
                            onClick={() => handleUpdateDispatchStatus(disp.id, "COMPLETED")}
                            disabled={updatingId === disp.id}
                            className="px-2 py-1 text-[10px] font-mono font-bold uppercase rounded-sm border border-blue-300 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all cursor-pointer"
                          >
                            Complete
                          </button>
                        )}
                        {disp.status !== "CANCELLED" && disp.status !== "COMPLETED" && (
                          <button
                            onClick={() => handleUpdateDispatchStatus(disp.id, "CANCELLED")}
                            disabled={updatingId === disp.id}
                            className="px-2 py-1 text-[10px] font-mono font-bold uppercase rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-600 dark:text-[#aaa] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDispatch(disp.id)}
                          disabled={updatingId === disp.id}
                          className="px-2 py-1 text-[10px] font-mono font-bold uppercase rounded-sm border border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                        >
                          Purge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 6: SECURITY AUDIT & ACTIVITY STREAM */}
        {/* ============================================================= */}
        {activeTab === "audit" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#ededed] font-mono uppercase">
                  Central Security Audit Stream
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#888]">
                  Immutable audit records captured per privileged administrative operation
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Filter audit logs..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm focus:outline-none focus:border-blue-600 text-slate-900 dark:text-[#ededed] w-56"
                />
              </div>
            </div>

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
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors">
                      <td className="py-3 px-4 text-slate-500 dark:text-[#777] whitespace-nowrap">
                        {formatDateTime(log.createdAt, true)}
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
          </div>
        )}
      </main>

      {/* ============================================================= */}
      {/* MODAL: CREATE HOSPITAL */}
      {/* ============================================================= */}
      {showAddHospitalModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f0f0f] max-w-lg w-full border border-slate-300 dark:border-[#2a2a2a] shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-semibold block">SUPERADMIN PROVISIONING</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Register New Hospital Facility</h3>
              </div>
              <button onClick={() => setShowAddHospitalModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateHospital} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Hospital Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fortis Memorial Research Institute"
                  value={newHospitalForm.name}
                  onChange={(e) => setNewHospitalForm({ ...newHospitalForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={newHospitalForm.city}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={newHospitalForm.state}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Street / Area address"
                  value={newHospitalForm.address}
                  onChange={(e) => setNewHospitalForm({ ...newHospitalForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">Emergency Phone</label>
                  <input
                    type="text"
                    value={newHospitalForm.phone}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">Latitude</label>
                  <input
                    type="text"
                    value={newHospitalForm.latitude}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, latitude: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">Longitude</label>
                  <input
                    type="text"
                    value={newHospitalForm.longitude}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, longitude: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* City Presets Helper */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-500 block mb-1">Quick Indian City Presets:</span>
                <div className="flex flex-wrap gap-1">
                  {CITY_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.city}
                      onClick={() => setNewHospitalForm({
                        ...newHospitalForm,
                        city: p.city,
                        state: p.state,
                        latitude: String(p.lat),
                        longitude: String(p.lng),
                      })}
                      className="px-1.5 py-0.5 bg-slate-100 dark:bg-[#222] hover:bg-slate-200 text-[10px] rounded-xs"
                    >
                      {p.city}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#222]">
                <button
                  type="button"
                  onClick={() => setShowAddHospitalModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-[#333] text-slate-700 dark:text-[#ccc] rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === "create-hosp"}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-sm cursor-pointer"
                >
                  {updatingId === "create-hosp" ? "Saving..." : "Create Facility"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: EDIT HOSPITAL */}
      {/* ============================================================= */}
      {editingHospital && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f0f0f] max-w-lg w-full border border-slate-300 dark:border-[#2a2a2a] shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-semibold block">SUPERADMIN OVERRIDE</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Edit Hospital Identity & Core Location</h3>
              </div>
              <button onClick={() => setEditingHospital(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditHospital} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Hospital Name</label>
                <input
                  type="text"
                  required
                  value={editHospitalForm.name}
                  onChange={(e) => setEditHospitalForm({ ...editHospitalForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={editHospitalForm.city}
                    onChange={(e) => setEditHospitalForm({ ...editHospitalForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={editHospitalForm.state}
                    onChange={(e) => setEditHospitalForm({ ...editHospitalForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Address</label>
                <input
                  type="text"
                  value={editHospitalForm.address}
                  onChange={(e) => setEditHospitalForm({ ...editHospitalForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">Phone</label>
                  <input
                    type="text"
                    value={editHospitalForm.phone}
                    onChange={(e) => setEditHospitalForm({ ...editHospitalForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">Latitude</label>
                  <input
                    type="text"
                    value={editHospitalForm.latitude}
                    onChange={(e) => setEditHospitalForm({ ...editHospitalForm, latitude: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">Longitude</label>
                  <input
                    type="text"
                    value={editHospitalForm.longitude}
                    onChange={(e) => setEditHospitalForm({ ...editHospitalForm, longitude: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Facility Operational Status</label>
                <select
                  value={editHospitalForm.status}
                  onChange={(e) => setEditHospitalForm({ ...editHospitalForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                >
                  <option value="ACTIVE">ACTIVE (Receives ambulance dispatches)</option>
                  <option value="DEACTIVATED">DEACTIVATED (Hidden from dispatches)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#222]">
                <button
                  type="button"
                  onClick={() => setEditingHospital(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-[#333] text-slate-700 dark:text-[#ccc] rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === editingHospital.id}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-sm cursor-pointer"
                >
                  {updatingId === editingHospital.id ? "Saving..." : "Save Modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: ADD STAFF MEMBER */}
      {/* ============================================================= */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f0f0f] max-w-md w-full border border-slate-300 dark:border-[#2a2a2a] shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-semibold block">SUPERADMIN ASSIGNMENT</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Add Personnel to Facility</h3>
              </div>
              <button onClick={() => setShowAddStaffModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Target Hospital Facility</label>
                <select
                  required
                  value={newStaffForm.hospitalId}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, hospitalId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                >
                  {hospitalsList.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} ({h.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Staff Member Email</label>
                <input
                  type="email"
                  required
                  placeholder="doctor.sharma@hospital.org"
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Full Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Dr. Rajesh Sharma"
                  value={newStaffForm.name}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Assigned Role</label>
                <select
                  value={newStaffForm.role}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                >
                  <option value="HOSPITAL_STAFF">HOSPITAL_STAFF (Bed Control & Dispatches)</option>
                  <option value="HOSPITAL_ADMIN">HOSPITAL_ADMIN (Hospital Staff Manager)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#222]">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-[#333] text-slate-700 dark:text-[#ccc] rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === "add-staff"}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-sm cursor-pointer"
                >
                  {updatingId === "add-staff" ? "Assigning..." : "Assign Personnel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: ADD BED CATEGORY */}
      {/* ============================================================= */}
      {showAddBedModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f0f0f] max-w-md w-full border border-slate-300 dark:border-[#2a2a2a] shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-semibold block">SUPERADMIN PROVISIONING</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Add Bed Category to Hospital</h3>
              </div>
              <button onClick={() => setShowAddBedModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleAddBed} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Target Hospital Facility</label>
                <select
                  required
                  value={newBedForm.hospitalId}
                  onChange={(e) => setNewBedForm({ ...newBedForm, hospitalId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                >
                  {hospitalsList.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} ({h.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Category Code (e.g. ICU, VENTILATOR, NICU)</label>
                <input
                  type="text"
                  required
                  value={newBedForm.categoryCode}
                  onChange={(e) => setNewBedForm({ ...newBedForm, categoryCode: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={newBedForm.name}
                  onChange={(e) => setNewBedForm({ ...newBedForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">Total Beds</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newBedForm.totalBeds}
                    onChange={(e) => setNewBedForm({ ...newBedForm, totalBeds: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">Available (Vacant)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newBedForm.availableBeds}
                    onChange={(e) => setNewBedForm({ ...newBedForm, availableBeds: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#222]">
                <button
                  type="button"
                  onClick={() => setShowAddBedModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-[#333] text-slate-700 dark:text-[#ccc] rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === "add-bed"}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-sm cursor-pointer"
                >
                  {updatingId === "add-bed" ? "Creating..." : "Create Bed Unit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: EDIT BED CAPACITY */}
      {/* ============================================================= */}
      {editingBed && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f0f0f] max-w-md w-full border border-slate-300 dark:border-[#2a2a2a] shadow-lg rounded-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-3 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase font-semibold block">SUPERADMIN OVERRIDE</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">{editingBed.name}</h3>
                <span className="text-xs text-slate-500 font-mono">{editingBed.hospitalName} ({editingBed.categoryCode})</span>
              </div>
              <button onClick={() => setEditingBed(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditBed} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editBedForm.name}
                  onChange={(e) => setEditBedForm({ ...editBedForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">Total Beds</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editBedForm.totalBeds}
                    onChange={(e) => setEditBedForm({ ...editBedForm, totalBeds: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1">Available (Vacant)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editBedForm.availableBeds}
                    onChange={(e) => setEditBedForm({ ...editBedForm, availableBeds: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333] rounded-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#222]">
                <button
                  type="button"
                  onClick={() => setEditingBed(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-[#333] text-slate-700 dark:text-[#ccc] rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === editingBed.id}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-sm cursor-pointer"
                >
                  {updatingId === editingBed.id ? "Saving..." : "Save Capacity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
