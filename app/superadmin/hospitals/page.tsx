"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { SuperAdminNav, SuperAdminGateway } from "@/components/superadmin-nav";
import { formatDate } from "@/lib/format-date";

interface BedCategory {
  id: string;
  categoryCode: string;
  name: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
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
  status: "ACTIVE" | "INACTIVE" | "DEACTIVATED";
  createdAt: string;
  updatedAt: string;
  creatorName?: string | null;
  creatorEmail?: string | null;
  beds?: BedCategory[];
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  staffCount: number;
}

const CITY_PRESETS = [
  { city: "New Delhi", state: "Delhi", lat: 28.5921, lng: 77.046, phoneCode: "+91 11" },
  { city: "Mumbai", state: "Maharashtra", lat: 19.0028, lng: 72.8423, phoneCode: "+91 22" },
  { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946, phoneCode: "+91 80" },
  { city: "Chennai", state: "Tamil Nadu", lat: 13.0604, lng: 80.2512, phoneCode: "+91 44" },
  { city: "Hyderabad", state: "Telangana", lat: 17.4649, lng: 78.3686, phoneCode: "+91 40" },
  { city: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639, phoneCode: "+91 33" },
  { city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714, phoneCode: "+91 79" },
  { city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567, phoneCode: "+91 20" },
];

export default function SuperAdminHospitalsPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [hospitalsList, setHospitalsList] = useState<HospitalItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DEACTIVATED">("ALL");

  // Modals
  const [viewingHospital, setViewingHospital] = useState<HospitalItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHospital, setEditingHospital] = useState<HospitalItem | null>(null);
  const [deletingHospital, setDeletingHospital] = useState<HospitalItem | null>(null);

  // Forms
  const [newHospitalForm, setNewHospitalForm] = useState({
    name: "",
    address: "",
    city: "New Delhi",
    state: "Delhi",
    phone: "+91 11 ",
    latitude: "28.5921",
    longitude: "77.0460",
    status: "ACTIVE" as "ACTIVE" | "DEACTIVATED",
  });

  const [editHospitalForm, setEditHospitalForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    latitude: "",
    longitude: "",
    status: "ACTIVE" as "ACTIVE" | "DEACTIVATED",
  });

  const fetchHospitals = async () => {
    try {
      setRefreshing(true);
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/hospitals");

      if (res.status === 401) {
        setForbidden(false);
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setHospitalsList(data.hospitals || []);
        setForbidden(false);
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Failed to load hospitals registry");
      }
    } catch (err: any) {
      console.error("Error loading hospitals:", err);
      setErrorMessage("Network error while connecting to hospital registry API");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      if (session?.user) {
        fetchHospitals();
      } else {
        setLoading(false);
      }
    }
  }, [session, sessionLoading]);

  // Unique cities list for filtering
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    hospitalsList.forEach((h) => {
      if (h.city) set.add(h.city);
    });
    return Array.from(set).sort();
  }, [hospitalsList]);

  // Filtered hospitals
  const filteredHospitals = useMemo(() => {
    return hospitalsList.filter((h) => {
      const matchesCity = cityFilter === "ALL" || h.city === cityFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && h.status === "ACTIVE") ||
        (statusFilter === "DEACTIVATED" && (h.status === "DEACTIVATED" || h.status === "INACTIVE"));

      if (!matchesCity || !matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        h.name.toLowerCase().includes(q) ||
        (h.city && h.city.toLowerCase().includes(q)) ||
        (h.address && h.address.toLowerCase().includes(q)) ||
        (h.phone && h.phone.toLowerCase().includes(q)) ||
        h.id.toLowerCase().includes(q)
      );
    });
  }, [hospitalsList, searchQuery, cityFilter, statusFilter]);

  // Quick preset apply
  const handleCityPresetSelect = (cityName: string) => {
    const preset = CITY_PRESETS.find((p) => p.city === cityName);
    if (preset) {
      setNewHospitalForm((prev) => ({
        ...prev,
        city: preset.city,
        state: preset.state,
        latitude: preset.lat.toString(),
        longitude: preset.lng.toString(),
        phone: `${preset.phoneCode} `,
      }));
    }
  };

  // Create Hospital
  const handleCreateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHospitalForm.name.trim() || !newHospitalForm.city.trim() || !newHospitalForm.state.trim()) {
      alert("Name, City, and State are required.");
      return;
    }

    try {
      setUpdatingId("create-hosp");
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHospitalForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create hospital facility");
      }

      setShowAddModal(false);
      setNewHospitalForm({
        name: "",
        address: "",
        city: "New Delhi",
        state: "Delhi",
        phone: "+91 11 ",
        latitude: "28.5921",
        longitude: "77.0460",
        status: "ACTIVE",
      });
      setActionMessage(`Created hospital '${newHospitalForm.name}' with baseline ICU, General, and Ventilator bed units.`);
      await fetchHospitals();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (hosp: HospitalItem) => {
    setEditingHospital(hosp);
    setEditHospitalForm({
      name: hosp.name,
      address: hosp.address || "",
      city: hosp.city || "",
      state: hosp.state || "",
      phone: hosp.phone || "",
      latitude: hosp.latitude?.toString() || "",
      longitude: hosp.longitude?.toString() || "",
      status: hosp.status === "DEACTIVATED" || hosp.status === "INACTIVE" ? "DEACTIVATED" : "ACTIVE",
    });
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHospital) return;

    try {
      setUpdatingId(editingHospital.id);
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/hospitals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: editingHospital.id,
          name: editHospitalForm.name,
          address: editHospitalForm.address,
          city: editHospitalForm.city,
          state: editHospitalForm.state,
          phone: editHospitalForm.phone,
          latitude: editHospitalForm.latitude ? parseFloat(editHospitalForm.latitude) : null,
          longitude: editHospitalForm.longitude ? parseFloat(editHospitalForm.longitude) : null,
          status: editHospitalForm.status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update hospital details");
      }

      setEditingHospital(null);
      setActionMessage(`Updated hospital details for '${editHospitalForm.name}'.`);
      await fetchHospitals();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (hosp: HospitalItem) => {
    const nextStatus = hosp.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
    const actionLabel = nextStatus === "DEACTIVATED" ? "Deactivate" : "Activate";

    if (
      !confirm(
        `${actionLabel} facility '${hosp.name}'?\n\n${
          nextStatus === "DEACTIVATED"
            ? "When deactivated, the facility is immediately hidden from ambulance dispatchers and bed updates are restricted."
            : "When activated, the facility is available for emergency ambulance routing."
        }`
      )
    ) {
      return;
    }

    try {
      setUpdatingId(hosp.id);
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/hospitals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: hosp.id,
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update hospital status");
      }

      setActionMessage(`Hospital '${hosp.name}' status set to ${nextStatus}.`);
      await fetchHospitals();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Safe Delete Hospital
  const handleConfirmDelete = async () => {
    if (!deletingHospital) return;

    try {
      setUpdatingId(deletingHospital.id);
      setErrorMessage(null);
      const res = await fetch("/api/superadmin/hospitals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitalId: deletingHospital.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete hospital facility");
      }

      setDeletingHospital(null);
      setActionMessage(data.message || `Hospital '${deletingHospital.name}' removed successfully.`);
      await fetchHospitals();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
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
      <SuperAdminNav activeTab="hospitals" onRefresh={fetchHospitals} refreshing={refreshing} />

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

        {/* Page Title & KPI Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-blue-700 dark:text-blue-400 font-bold">
                CENTRAL FACILITY TELEMETRY
              </span>
              <span className="text-slate-400 dark:text-[#444]">•</span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-[#777]">
                Total: {hospitalsList.length} Facilities
              </span>
            </div>
            <h1 className="text-2xl font-bold font-sans tracking-tight text-slate-900 dark:text-[#ededed] mt-0.5">
              Hospital Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#888] mt-1">
              National hospital registry, live operational status, telemetry bed summaries, and staff allocation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-all cursor-pointer flex items-center gap-2 shadow-2xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create Hospital
            </button>
          </div>
        </div>

        {/* Key Metrics Quick Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 font-mono">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-3.5 rounded-sm shadow-2xs">
            <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase tracking-wider">Total Facilities</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">{hospitalsList.length}</div>
            <div className="text-[11px] text-slate-500 dark:text-[#666] mt-1">
              {uniqueCities.length} Indian Metro Cities
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-3.5 rounded-sm shadow-2xs">
            <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase tracking-wider">Active Units</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {hospitalsList.filter((h) => h.status === "ACTIVE").length}
            </div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">Dispatch-Ready</div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-3.5 rounded-sm shadow-2xs">
            <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase tracking-wider">Deactivated</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {hospitalsList.filter((h) => h.status === "DEACTIVATED" || h.status === "INACTIVE").length}
            </div>
            <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">Temporarily Off-Grid</div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-3.5 rounded-sm shadow-2xs">
            <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase tracking-wider">Total Beds Aggregated</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
              {hospitalsList.reduce((acc, h) => acc + (h.totalBeds || 0), 0)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#666] mt-1">
              {hospitalsList.reduce((acc, h) => acc + (h.availableBeds || 0), 0)} Vacant Currently
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] p-4 rounded-sm shadow-2xs mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <input
                  type="text"
                  placeholder="Search by hospital name, city, address, or phone..."
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
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="ALL">All Cities ({hospitalsList.length})</option>
                {uniqueCities.map((c) => (
                  <option key={c} value={c}>
                    {c} ({hospitalsList.filter((h) => h.city === c).length})
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE Only</option>
                <option value="DEACTIVATED">DEACTIVATED Only</option>
              </select>
            </div>

            <div className="text-xs font-mono text-slate-500 dark:text-[#777] self-end md:self-center">
              Showing {filteredHospitals.length} of {hospitalsList.length} hospitals
            </div>
          </div>
        </div>

        {/* Hospitals Table */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-[#111111] text-slate-600 dark:text-[#888888] font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-[#222222]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Hospital Name & ID</th>
                  <th className="py-3 px-4 font-semibold">Location & Contact</th>
                  <th className="py-3 px-4 font-semibold">Coordinates</th>
                  <th className="py-3 px-4 font-semibold">Beds (Vacant / Total)</th>
                  <th className="py-3 px-4 font-semibold text-center">Staff Count</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] font-mono">
                {filteredHospitals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-[#666]">
                      <div className="font-mono text-sm">NO MATCHING HOSPITALS FOUND</div>
                      <div className="text-xs mt-1">Try broadening your search term or city filter.</div>
                    </td>
                  </tr>
                ) : (
                  filteredHospitals.map((hosp) => (
                    <tr
                      key={hosp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setViewingHospital(hosp)}
                          className="font-bold text-slate-900 dark:text-[#ededed] hover:text-blue-700 dark:hover:text-blue-400 text-left cursor-pointer transition-colors block"
                        >
                          {hosp.name}
                        </button>
                        <div className="text-[10px] text-slate-400 dark:text-[#666] mt-0.5">{hosp.id}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-[#aaa]">
                        <div className="font-semibold text-slate-800 dark:text-[#ccc]">
                          {hosp.city}, {hosp.state}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-[#666]">
                          {hosp.phone ? (
                            <span>📞 {hosp.phone}</span>
                          ) : (
                            <span className="italic">No phone listed</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500 dark:text-[#777]">
                        {hosp.latitude != null && hosp.longitude != null ? (
                          <span>
                            {hosp.latitude.toFixed(4)}, {hosp.longitude.toFixed(4)}
                          </span>
                        ) : (
                          <span className="italic">Unset</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                            {hosp.availableBeds}
                          </span>
                          <span className="text-slate-400 dark:text-[#555]">/</span>
                          <span className="text-slate-700 dark:text-[#bbb] font-medium">{hosp.totalBeds}</span>
                        </div>
                        <div className="w-24 bg-slate-200 dark:bg-[#222] h-1.5 rounded-xs overflow-hidden mt-1">
                          <div
                            className="bg-blue-600 h-full rounded-xs"
                            style={{
                              width: `${
                                hosp.totalBeds > 0
                                  ? Math.min(100, Math.round((hosp.occupiedBeds / hosp.totalBeds) * 100))
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          href={`/superadmin/staff?hospitalId=${hosp.id}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 hover:text-blue-700 dark:hover:text-blue-400 text-xs transition-colors"
                          title="View staff roster for this hospital"
                        >
                          👥 {hosp.staffCount}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
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
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewingHospital(hosp)}
                          className="px-2 py-1 text-[11px] font-mono font-semibold uppercase rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 transition-all cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleOpenEdit(hosp)}
                          className="px-2 py-1 text-[11px] font-mono font-semibold uppercase rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleStatus(hosp)}
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
                          onClick={() => setDeletingHospital(hosp)}
                          disabled={updatingId === hosp.id}
                          className="px-2 py-1 text-[11px] font-mono font-bold uppercase rounded-sm border border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                          title="Safely delete facility if no active dispatches exist"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ============================================================= */}
      {/* MODAL 1: VIEW HOSPITAL DETAILS */}
      {/* ============================================================= */}
      {viewingHospital && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#222222] pb-4 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-700 dark:text-blue-400 font-bold">
                  FACILITY TELEMETRY DOSSIER
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed] font-sans">
                  {viewingHospital.name}
                </h3>
                <div className="text-xs text-slate-500 dark:text-[#777] font-mono mt-0.5">
                  Facility ID: {viewingHospital.id}
                </div>
              </div>
              <button
                onClick={() => setViewingHospital(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-[#eee] text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 text-xs font-mono">
              {/* Basic Details Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm">
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase">Location</div>
                  <div className="font-semibold text-slate-900 dark:text-[#ededed] mt-0.5">
                    {viewingHospital.city}, {viewingHospital.state}
                  </div>
                  <div className="text-slate-600 dark:text-[#888] text-[11px] mt-0.5">
                    {viewingHospital.address || "No street address recorded"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase">Contact & Status</div>
                  <div className="mt-0.5">
                    {viewingHospital.phone ? (
                      <span className="font-semibold text-slate-900 dark:text-[#ededed]">
                        📞 {viewingHospital.phone}
                      </span>
                    ) : (
                      <span className="italic text-slate-400">No telephone</span>
                    )}
                  </div>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                        viewingHospital.status === "ACTIVE"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {viewingHospital.status}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase">GPS Coordinates</div>
                  <div className="font-semibold text-slate-900 dark:text-[#ededed] mt-0.5">
                    {viewingHospital.latitude != null && viewingHospital.longitude != null
                      ? `Lat: ${viewingHospital.latitude}, Lng: ${viewingHospital.longitude}`
                      : "Unset"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 dark:text-[#777] uppercase">Assigned Staff</div>
                  <div className="font-semibold text-slate-900 dark:text-[#ededed] mt-0.5">
                    {viewingHospital.staffCount} Active Personnel
                  </div>
                </div>
              </div>

              {/* Bed Categories Telemetry Breakdown */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 dark:text-[#ededed] uppercase text-[11px]">
                    Live Bed Categories Breakdown
                  </h4>
                  <span className="text-slate-500 dark:text-[#777]">
                    Total: {viewingHospital.totalBeds} Beds ({viewingHospital.availableBeds} Vacant)
                  </span>
                </div>

                {viewingHospital.beds && viewingHospital.beds.length > 0 ? (
                  <div className="space-y-2">
                    {viewingHospital.beds.map((b) => (
                      <div
                        key={b.id}
                        className="p-3 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900 dark:text-[#ededed]">
                            {b.name} ({b.categoryCode})
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {b.availableBeds} Vacant / {b.totalBeds} Total
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-[#222] h-2 rounded-xs overflow-hidden mt-2">
                          <div
                            className="bg-blue-600 h-full rounded-xs"
                            style={{
                              width: `${
                                b.totalBeds > 0
                                  ? Math.min(100, Math.round((b.occupiedBeds / b.totalBeds) * 100))
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-[#777] mt-1.5">
                          <span>{b.occupiedBeds} Occupied</span>
                          <span>
                            {b.totalBeds > 0 ? Math.round((b.occupiedBeds / b.totalBeds) * 100) : 0}% Occupancy
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-sm">
                    No bed categories registered for this hospital.
                  </div>
                )}
              </div>

              {/* Timestamp Audit Trail */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-[#666] border-t border-slate-200 dark:border-[#222222] pt-3">
                <div>Created: {formatDate(viewingHospital.createdAt)}</div>
                <div>Last Updated: {formatDate(viewingHospital.updatedAt)}</div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#222222] flex justify-end gap-3 font-mono">
              <Link
                href={`/superadmin/staff?hospitalId=${viewingHospital.id}`}
                className="px-3.5 py-2 text-xs font-semibold uppercase rounded-sm border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#ccc] hover:border-slate-400 transition-all"
              >
                View Staff Roster →
              </Link>
              <button
                onClick={() => {
                  const target = viewingHospital;
                  setViewingHospital(null);
                  handleOpenEdit(target);
                }}
                className="px-3.5 py-2 text-xs font-semibold uppercase rounded-sm bg-blue-700 hover:bg-blue-800 text-white transition-all cursor-pointer"
              >
                Edit Facility
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: CREATE HOSPITAL */}
      {/* ============================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#222222] pb-4 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-700 dark:text-blue-400 font-bold">
                  NATIONAL REGISTRY
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed] font-sans">
                  Provision New Hospital Facility
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-[#eee] text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Metro Presets */}
            <div className="mb-4">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
                Quick Indian City Preset:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CITY_PRESETS.map((p) => (
                  <button
                    key={p.city}
                    type="button"
                    onClick={() => handleCityPresetSelect(p.city)}
                    className={`px-2 py-1 text-[10px] font-mono rounded-sm border transition-colors cursor-pointer ${
                      newHospitalForm.city === p.city
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-400 font-bold"
                        : "border-slate-300 dark:border-[#2a2a2a] text-slate-600 dark:text-[#888] hover:border-slate-400"
                    }`}
                  >
                    {p.city}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateHospital} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">
                  Hospital Facility Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Fortis Escorts Heart Institute"
                  value={newHospitalForm.name}
                  onChange={(e) => setNewHospitalForm({ ...newHospitalForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">City *</label>
                  <input
                    type="text"
                    required
                    value={newHospitalForm.city}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">State *</label>
                  <input
                    type="text"
                    required
                    value={newHospitalForm.state}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g., Okhla Road, Sukhdev Vihar, Metro Station"
                  value={newHospitalForm.address}
                  onChange={(e) => setNewHospitalForm({ ...newHospitalForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Emergency Phone</label>
                <input
                  type="text"
                  placeholder="+91 11 4713 5000"
                  value={newHospitalForm.phone}
                  onChange={(e) => setNewHospitalForm({ ...newHospitalForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Latitude</label>
                  <input
                    type="text"
                    value={newHospitalForm.latitude}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, latitude: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Longitude</label>
                  <input
                    type="text"
                    value={newHospitalForm.longitude}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, longitude: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Initial Status</label>
                <select
                  value={newHospitalForm.status}
                  onChange={(e) => setNewHospitalForm({ ...newHospitalForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE (Ready for Ambulance Routing)</option>
                  <option value="DEACTIVATED">DEACTIVATED (Offline / Maintenance)</option>
                </select>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-sm text-[11px] text-blue-900 dark:text-blue-300">
                ℹ️ Provisioning automatically initialises baseline bed capacity: 20 ICU beds, 100 General Ward beds, and 10 Ventilator units in Neon Postgres.
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#222222] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-700 dark:text-[#ccc] hover:border-slate-400 uppercase font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === "create-hosp"}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-sm font-semibold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {updatingId === "create-hosp" ? "Registering..." : "Register Facility"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 3: EDIT HOSPITAL */}
      {/* ============================================================= */}
      {editingHospital && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-sm max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#222222] pb-4 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-700 dark:text-blue-400 font-bold">
                  FACILITY MODIFICATION
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed] font-sans">
                  Edit Hospital Details
                </h3>
                <div className="text-xs text-slate-500 dark:text-[#777] font-mono mt-0.5">
                  ID: {editingHospital.id}
                </div>
              </div>
              <button
                onClick={() => setEditingHospital(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-[#eee] text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Hospital Name</label>
                <input
                  type="text"
                  required
                  value={editHospitalForm.name}
                  onChange={(e) => setEditHospitalForm({ ...editHospitalForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">City</label>
                  <input
                    type="text"
                    required
                    value={editHospitalForm.city}
                    onChange={(e) => setEditHospitalForm({ ...editHospitalForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">State</label>
                  <input
                    type="text"
                    required
                    value={editHospitalForm.state}
                    onChange={(e) => setEditHospitalForm({ ...editHospitalForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Street Address</label>
                <input
                  type="text"
                  value={editHospitalForm.address}
                  onChange={(e) => setEditHospitalForm({ ...editHospitalForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Phone</label>
                <input
                  type="text"
                  value={editHospitalForm.phone}
                  onChange={(e) => setEditHospitalForm({ ...editHospitalForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Latitude</label>
                  <input
                    type="text"
                    value={editHospitalForm.latitude}
                    onChange={(e) => setEditHospitalForm({ ...editHospitalForm, latitude: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Longitude</label>
                  <input
                    type="text"
                    value={editHospitalForm.longitude}
                    onChange={(e) => setEditHospitalForm({ ...editHospitalForm, longitude: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#ccc] mb-1 font-semibold">Status</label>
                <select
                  value={editHospitalForm.status}
                  onChange={(e) => setEditHospitalForm({ ...editHospitalForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-900 dark:text-[#ededed] focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DEACTIVATED">DEACTIVATED</option>
                </select>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#222222] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingHospital(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-700 dark:text-[#ccc] hover:border-slate-400 uppercase font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === editingHospital.id}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-sm font-semibold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {updatingId === editingHospital.id ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 4: SAFE DELETE CONFIRMATION */}
      {/* ============================================================= */}
      {deletingHospital && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-red-300 dark:border-red-900/60 rounded-sm max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-mono text-xs font-bold uppercase mb-2">
              <span>⚠️</span>
              <span>CONFIRM FACILITY PURGE</span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-[#ededed] font-sans">
              Delete &apos;{deletingHospital.name}&apos;?
            </h3>

            <p className="text-xs text-slate-600 dark:text-[#888] font-mono mt-2 leading-relaxed">
              This action will permanently delete the facility record from Neon PostgreSQL along with its associated bed records and memberships.
            </p>

            <div className="my-4 p-3 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-sm font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="text-slate-900 dark:text-[#ededed] font-bold">
                  {deletingHospital.city}, {deletingHospital.state}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bed Categories:</span>
                <span className="text-slate-900 dark:text-[#ededed] font-bold">
                  {deletingHospital.totalBeds} Total Beds
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Staff Memberships:</span>
                <span className="text-slate-900 dark:text-[#ededed] font-bold">
                  {deletingHospital.staffCount} Personnel
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-sm text-[11px] font-mono text-amber-800 dark:text-amber-300">
              🛡️ Safe Relation Constraint: Deletion will be blocked by the server if any active emergency dispatches (PENDING or EN_ROUTE) are currently linked to this hospital.
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#222222] flex justify-end gap-3 font-mono">
              <button
                type="button"
                onClick={() => setDeletingHospital(null)}
                className="px-3.5 py-2 border border-slate-300 dark:border-[#2a2a2a] rounded-sm text-slate-700 dark:text-[#ccc] hover:border-slate-400 uppercase font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={updatingId === deletingHospital.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-sm font-bold uppercase tracking-wider cursor-pointer text-xs disabled:opacity-50"
              >
                {updatingId === deletingHospital.id ? "Purging..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
