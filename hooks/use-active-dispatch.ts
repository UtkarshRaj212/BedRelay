"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatDateTime } from "@/lib/format-date";

export interface ActiveDispatch {
  id: string;
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalCity: string;
  hospitalState: string;
  hospitalPhone: string;
  hospitalLat: number | null;
  hospitalLng: number | null;
  ambulanceUnit: string;
  ambulanceId?: string;
  ambulanceLat: number | null;
  ambulanceLng: number | null;
  patientRef?: string;
  patientReference?: string;
  bedCategoryCode: string;
  requestedBeds: number;
  approvedBeds?: number | null;
  reviewRequired?: boolean;
  reviewReason?: string | null;
  rejectionReason?: string | null;
  etaMinutes: number;
  patientCondition: string;
  status: "PENDING" | "SENT" | "ACCEPTED" | "REJECTED" | "COMPLETED" | "CANCELLED" | string;
  distanceKm: number | null;
  hospitalBeds?: {
    categoryCode: string;
    name: string;
    availableBeds: number;
    totalBeds: number;
    occupiedBeds: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface RejectedDispatch {
  id: string;
  hospitalId: string;
  hospitalName: string;
  rejectionReason: string;
  rejectedAt: string;
}

export function useActiveDispatch(pollIntervalMs = 1000) {
  const [activeDispatch, setActiveDispatch] = useState<ActiveDispatch | null>(null);
  const [lastRejectedDispatch, setLastRejectedDispatch] = useState<RejectedDispatch | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  const fetchActive = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await fetch("/api/dispatch/active", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.ok) {
        const data = await res.json();
        setActiveDispatch(data.activeDispatch || null);
        
        // Only set lastRejectedDispatch if not dismissed in localStorage
        const rejected = data.lastRejectedDispatch;
        if (rejected && typeof window !== "undefined") {
          const isDismissed = localStorage.getItem(`dismissed_rejection_${rejected.id}`) === "true";
          setLastRejectedDispatch(isDismissed ? null : rejected);
        } else {
          setLastRejectedDispatch(rejected || null);
        }

        setLastUpdated(formatDateTime(new Date(), true));
        setError(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Failed to sync active dispatch telemetry.");
      }
    } catch (err: any) {
      setError(err.message || "Network error syncing active dispatch.");
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActive();

    const interval = setInterval(fetchActive, pollIntervalMs);

    const onFocus = () => {
      fetchActive();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchActive, pollIntervalMs]);

  const cancelActiveDispatch = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/dispatch/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        await fetchActive();
        return { success: true };
      } else {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || "Failed to cancel active dispatch." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Network error cancelling dispatch." };
    }
  };

  const switchHospital = async (params: {
    targetHospitalId: string;
    bedCategoryCode?: string;
    requestedBeds?: number;
    etaMinutes?: number;
    ambulanceUnit?: string;
    ambulanceId?: string;
    patientCondition?: string;
    patientRef?: string;
    patientReference?: string;
    ambulanceLat?: number | null;
    ambulanceLng?: number | null;
  }): Promise<{ success: boolean; error?: string; dispatch?: any }> => {
    try {
      const res = await fetch("/api/dispatch/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchActive();
        return { success: true, dispatch: data.dispatch };
      } else {
        return { success: false, error: data.error || "Failed to switch hospital." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Network error switching hospital." };
    }
  };

  const modifyActiveDispatch = async (params: {
    bedCategoryCode?: string;
    requestedBeds?: number;
    patientCondition?: string;
    etaMinutes?: number;
  }): Promise<{ success: boolean; error?: string; dispatch?: any; reviewRequired?: boolean }> => {
    try {
      const res = await fetch("/api/dispatch/modify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchActive();
        return { success: true, dispatch: data.dispatch, reviewRequired: data.reviewRequired };
      } else {
        return { success: false, error: data.error || "Failed to modify dispatch request." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Network error modifying dispatch." };
    }
  };

  const dismissRejectedDispatch = (id: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`dismissed_rejection_${id}`, "true");
    }
    setLastRejectedDispatch(null);
  };

  return {
    activeDispatch,
    lastRejectedDispatch,
    loading,
    lastUpdated,
    error,
    refresh: fetchActive,
    cancelActiveDispatch,
    switchHospital,
    modifyActiveDispatch,
    dismissRejectedDispatch,
  };
}
