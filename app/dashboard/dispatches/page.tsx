"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

interface DispatchRequest {
  id: string;
  ambulanceUnit: string;
  bedCategoryCode: string;
  requestedBeds: number;
  etaMinutes: number;
  patientCondition: string;
  status: string;
  createdAt: string;
}

interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
}

export default function HospitalDispatchesPage() {
  const { data: session, isPending } = authClient.useSession();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [dispatches, setDispatches] = useState<DispatchRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDispatches = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/hospital/dispatches");
      if (res.ok) {
        const data = await res.json();
        setHospital(data.hospital);
        setDispatches(data.dispatches || []);
      }
    } catch (err) {
      console.error("Failed to load dispatch requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchDispatches();
    }
  }, [session]);

  const handleUpdateStatus = async (requestId: string, newStatus: "ACCEPTED" | "REJECTED") => {
    try {
      setUpdatingId(requestId);
      setFeedbackMsg(null);

      const res = await fetch("/api/hospital/dispatches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      setFeedbackMsg({
        type: "success",
        text: `Dispatch request ${requestId} marked as ${newStatus}`,
      });

      await fetchDispatches();
    } catch (err: any) {
      setFeedbackMsg({
        type: "error",
        text: err.message || "Failed to update dispatch request",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-sm text-slate-600">
        VERIFYING AUTHENTICATION SESSION...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex items-center justify-center p-4">
        <div className="bg-white p-8 border border-slate-200 rounded-sm max-w-md w-full">
          <div className="text-xs font-mono text-slate-500 uppercase mb-2">AUTH REQUIRED</div>
          <h1 className="text-xl font-bold text-slate-900">Hospital Staff Access Only</h1>
          <p className="mt-2 text-sm text-slate-600">
            You must be logged in with a hospital account to manage dispatch requests.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block w-full text-center px-4 py-2 bg-slate-900 text-white font-semibold text-sm rounded-sm"
          >
            Go to Staff Portal
          </Link>
        </div>
      </div>
    );
  }

  const filteredDispatches = statusFilter === "ALL"
    ? dispatches
    : dispatches.filter((d) => d.status.toUpperCase() === statusFilter);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Top Status Header */}
      <div className="bg-slate-900 text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>INBOUND DISPATCH CONTROL CONSOLE</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">STAFF: {session.user.email}</span>
        </div>
        <button
          onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
          className="text-slate-400 hover:text-white transition-colors underline font-mono text-[11px]"
        >
          Sign Out
        </button>
      </div>

      {/* Main Header & Nav Tabs */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 text-white font-bold flex items-center justify-center text-sm font-mono rounded-sm">
              BR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 font-mono tracking-tight">
                BED<span className="text-blue-700">RELAY</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">
                Hospital Control Console
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-2 font-mono text-xs">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 rounded-sm"
              >
                OVERVIEW
              </Link>
              <Link
                href="/dashboard/beds"
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 rounded-sm"
              >
                BED MANAGEMENT
              </Link>
              <Link
                href="/dashboard/dispatches"
                className="px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-sm"
              >
                DISPATCH REQUESTS
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hospital Header Banner */}
        <div className="bg-white p-6 border border-slate-200 rounded-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-mono font-semibold rounded-sm">
                SCOPED AUTHENTICATED HOSPITAL
              </span>
              <span className="text-xs text-slate-500 font-mono">ID: {hospital?.id}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{hospital?.name || "Loading Hospital..."}</h1>
            <p className="text-xs text-slate-600 font-mono mt-0.5">
              Review and manage inbound ambulance dispatch pre-arrival alerts.
            </p>
          </div>

          <button
            onClick={fetchDispatches}
            className="px-3 py-1.5 text-xs font-mono text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
          >
            Refresh Dispatch Stream
          </button>
        </div>

        {feedbackMsg && (
          <div
            className={`p-4 mb-6 text-xs font-mono rounded-sm flex items-center justify-between ${
              feedbackMsg.type === "success"
                ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
                : "bg-red-50 border border-red-300 text-red-800"
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="font-bold">✕</button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white border border-slate-200 rounded-sm p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-500 uppercase mr-2">Filter Status:</span>
            {["ALL", "PENDING", "ACCEPTED", "REJECTED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-sm transition-colors ${
                  statusFilter === st
                    ? "bg-slate-900 text-white font-semibold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="text-xs font-mono text-slate-500">
            SHOWING <span className="font-bold text-slate-900">{filteredDispatches.length}</span> REQUESTS
          </div>
        </div>

        {/* Dispatch Requests Table */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Inbound Ambulance Pre-Arrival Requests</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Strictly scoped to {hospital?.name || "your facility"}
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm font-mono text-slate-500">LOADING DISPATCH REQUEST STREAM...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-mono text-xs uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-6 font-semibold">Request ID</th>
                    <th className="py-3.5 px-6 font-semibold">Ambulance Unit</th>
                    <th className="py-3.5 px-6 font-semibold">Bed Category</th>
                    <th className="py-3.5 px-6 font-semibold text-center">Beds Requested</th>
                    <th className="py-3.5 px-6 font-semibold">Patient Clinical Condition</th>
                    <th className="py-3.5 px-6 font-semibold text-center">ETA</th>
                    <th className="py-3.5 px-6 font-semibold">Request Time</th>
                    <th className="py-3.5 px-6 font-semibold text-center">Status</th>
                    <th className="py-3.5 px-6 font-semibold text-center">Decision Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredDispatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 px-6 text-center text-xs font-mono text-slate-500">
                        NO DISPATCH REQUESTS LOGGED FOR THIS FILTER
                      </td>
                    </tr>
                  ) : (
                    filteredDispatches.map((disp) => (
                      <tr key={disp.id} className="hover:bg-slate-50">
                        <td className="py-4 px-6 font-mono text-xs text-slate-600 font-semibold">{disp.id}</td>
                        <td className="py-4 px-6 font-mono font-bold text-slate-900">{disp.ambulanceUnit}</td>
                        <td className="py-4 px-6 font-mono text-xs font-semibold">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-sm">
                            {disp.bedCategoryCode}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono text-center font-bold text-slate-900">
                          {disp.requestedBeds || 1}
                        </td>
                        <td className="py-4 px-6 text-slate-800 font-medium max-w-xs">{disp.patientCondition}</td>
                        <td className="py-4 px-6 font-mono text-center font-bold text-slate-900">{disp.etaMinutes}m</td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">
                          {new Date(disp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-4 px-6 text-center font-mono text-xs font-bold">
                          <span
                            className={`px-2.5 py-1 rounded-sm border ${
                              disp.status === "ACCEPTED"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : disp.status === "REJECTED"
                                ? "bg-red-100 text-red-800 border-red-300"
                                : "bg-amber-100 text-amber-800 border-amber-300"
                            }`}
                          >
                            {disp.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {disp.status === "PENDING" ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleUpdateStatus(disp.id, "ACCEPTED")}
                                disabled={updatingId === disp.id}
                                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 rounded-sm transition-colors disabled:opacity-50"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(disp.id, "REJECTED")}
                                disabled={updatingId === disp.id}
                                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-red-700 hover:bg-red-800 rounded-sm transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
