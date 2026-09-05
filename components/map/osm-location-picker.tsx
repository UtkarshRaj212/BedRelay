"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { createLocationPickerIcon } from "./osm-icons";
import { INDIAN_CITIES, isValidCoordinates } from "@/lib/geo";

export interface OSMLocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  className?: string;
  cityName?: string;
}

// Map Click Listener
function MapClickEvents({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(
        Math.round(e.latlng.lat * 10000) / 10000,
        Math.round(e.latlng.lng * 10000) / 10000
      );
    },
  });
  return null;
}

// Controller to programmatic view adjustments
function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();
  const prevCenterRef = useRef<[number, number]>(center);

  useEffect(() => {
    if (
      Math.abs(prevCenterRef.current[0] - center[0]) > 0.0001 ||
      Math.abs(prevCenterRef.current[1] - center[1]) > 0.0001
    ) {
      map.setView(center, map.getZoom());
      prevCenterRef.current = center;
    }
  }, [center, map]);

  return null;
}

export default function OSMLocationPicker({
  latitude,
  longitude,
  onChange,
  className = "w-full h-80",
  cityName,
}: OSMLocationPickerProps) {
  const valid = isValidCoordinates(latitude, longitude);
  const currentPos: [number, number] = valid ? [latitude, longitude] : [28.6139, 77.209];

  const markerIcon = useMemo(() => createLocationPickerIcon(), []);

  const handleDragEnd = (event: any) => {
    const marker = event.target;
    if (marker) {
      const position = marker.getLatLng();
      onChange(
        Math.round(position.lat * 10000) / 10000,
        Math.round(position.lng * 10000) / 10000
      );
    }
  };

  const handleCityPreset = (cityLat: number, cityLng: number) => {
    onChange(cityLat, cityLng);
  };

  return (
    <div className="space-y-2">
      {/* Controls / Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#181818] border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#a1a1a1] rounded-sm font-semibold">
            CLICK OR DRAG PIN TO PINPOINT FACILITY
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <span>Lat: <strong className="text-slate-900 dark:text-white">{latitude ? latitude.toFixed(4) : "—"}</strong></span>
          <span>•</span>
          <span>Lng: <strong className="text-slate-900 dark:text-white">{longitude ? longitude.toFixed(4) : "—"}</strong></span>
        </div>
      </div>

      {/* Map Container */}
      <div className={`relative border border-slate-300 dark:border-[#262626] rounded-sm overflow-hidden ${className}`}>
        <MapContainer
          center={currentPos}
          zoom={13}
          scrollWheelZoom={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapCenterController center={currentPos} />
          <MapClickEvents onLocationSelect={(lat, lng) => onChange(lat, lng)} />

          <Marker
            position={currentPos}
            icon={markerIcon}
            draggable={true}
            eventHandlers={{
              dragend: handleDragEnd,
            }}
          />
        </MapContainer>
      </div>

      {/* Metro Jump Shortcuts */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">Metro Presets:</span>
        {INDIAN_CITIES.map((city) => (
          <button
            type="button"
            key={city.name}
            onClick={() => handleCityPreset(city.lat, city.lng)}
            className="px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-[#0f0f0f] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#262626] rounded-sm whitespace-nowrap transition-colors cursor-pointer"
          >
            {city.name}
          </button>
        ))}
      </div>
    </div>
  );
}
