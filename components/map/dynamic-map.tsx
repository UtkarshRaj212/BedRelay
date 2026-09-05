"use client";

import dynamic from "next/dynamic";
import type { OSMMapViewProps } from "./osm-map-view";
import type { OSMLocationPickerProps } from "./osm-location-picker";

export const DynamicOSMMapView = dynamic<OSMMapViewProps>(
  () => import("./osm-map-view"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 bg-slate-100 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] rounded-sm flex flex-col items-center justify-center font-mono text-xs text-slate-500 gap-2">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span>INITIALIZING OPENSTREETMAP TELEMETRY...</span>
      </div>
    ),
  }
);

export const DynamicOSMLocationPicker = dynamic<OSMLocationPickerProps>(
  () => import("./osm-location-picker"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 bg-slate-100 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] rounded-sm flex flex-col items-center justify-center font-mono text-xs text-slate-500 gap-2">
        <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <span>LOADING LOCATION PICKER MAP...</span>
      </div>
    ),
  }
);
