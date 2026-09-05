"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { createAmbulanceIcon, createHospitalIcon, createUserLocationIcon, HospitalMarkerStatus } from "./osm-icons";
import { formatDistanceKm } from "@/lib/geo";

export interface HospitalMapPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  distanceKm?: number | null;
  availableBeds?: number;
  totalBeds?: number;
  targetCategoryBeds?: number;
  isSuitable?: boolean;
  isSelected?: boolean;
}

export interface AmbulanceLocation {
  lat: number;
  lng: number;
  unitId?: string;
  condition?: string;
}

export interface UserLocationPin {
  lat: number;
  lng: number;
  label?: string;
  isLiveGPS?: boolean;
}

export interface OSMMapViewProps {
  ambulanceLocation?: AmbulanceLocation | null;
  userLocation?: UserLocationPin | null;
  hospitals?: HospitalMapPin[];
  center?: [number, number];
  zoom?: number;
  showRoute?: boolean;
  selectedHospitalId?: string | null;
  onSelectHospital?: (hospital: HospitalMapPin) => void;
  onInitiateDispatch?: (hospital: HospitalMapPin) => void;
  className?: string;
  autoFitBounds?: boolean;
}

// Sub-component to handle map viewport bounds & recentering
function MapController({
  center,
  zoom,
  ambulanceLocation,
  userLocation,
  hospitals,
  autoFitBounds = true,
}: {
  center: [number, number];
  zoom: number;
  ambulanceLocation?: AmbulanceLocation | null;
  userLocation?: UserLocationPin | null;
  hospitals?: HospitalMapPin[];
  autoFitBounds?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!autoFitBounds) {
      map.setView(center, zoom);
      return;
    }

    const points: [number, number][] = [];
    if (userLocation) {
      points.push([userLocation.lat, userLocation.lng]);
    }
    if (ambulanceLocation) {
      points.push([ambulanceLocation.lat, ambulanceLocation.lng]);
    }
    if (hospitals && hospitals.length > 0) {
      hospitals.forEach((h) => {
        if (h.latitude && h.longitude) {
          points.push([h.latitude, h.longitude]);
        }
      });
    }

    if (points.length === 1) {
      map.setView(points[0], Math.max(zoom, 13));
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView(center, zoom);
    }
  }, [map, center, zoom, ambulanceLocation, hospitals, autoFitBounds]);

  return null;
}

export default function OSMMapView({
  ambulanceLocation,
  userLocation,
  hospitals = [],
  center = [28.6139, 77.209], // Default New Delhi
  zoom = 12,
  showRoute = false,
  selectedHospitalId,
  onSelectHospital,
  onInitiateDispatch,
  className = "w-full h-96",
  autoFitBounds = true,
}: OSMMapViewProps) {
  const originLocation = userLocation || ambulanceLocation;

  // Find selected hospital or the only hospital for route line
  const targetHospitalForRoute = useMemo(() => {
    if (!showRoute || !originLocation) return null;
    if (selectedHospitalId) {
      return hospitals.find((h) => h.id === selectedHospitalId);
    }
    if (hospitals.length === 1) {
      return hospitals[0];
    }
    return null;
  }, [showRoute, originLocation, selectedHospitalId, hospitals]);

  const routePositions = useMemo(() => {
    if (!originLocation || !targetHospitalForRoute) return [];
    return [
      [originLocation.lat, originLocation.lng] as [number, number],
      [targetHospitalForRoute.latitude, targetHospitalForRoute.longitude] as [number, number],
    ];
  }, [originLocation, targetHospitalForRoute]);

  const ambulanceIcon = useMemo(() => createAmbulanceIcon(), []);
  const userLocationIcon = useMemo(() => createUserLocationIcon(), []);

  return (
    <div className={`relative border border-slate-300 dark:border-[#262626] rounded-sm overflow-hidden ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapController
          center={center}
          zoom={zoom}
          ambulanceLocation={ambulanceLocation}
          userLocation={userLocation}
          hospitals={hospitals}
          autoFitBounds={autoFitBounds}
        />

        {/* Optional connecting dispatch route between ambulance/user & destination */}
        {routePositions.length === 2 && (
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#2563eb",
              weight: 3,
              dashArray: "6, 8",
              opacity: 0.85,
            }}
          />
        )}

        {/* User / Dispatcher Location Marker */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userLocationIcon}
          >
            <Popup>
              <div className="p-3 font-sans min-w-[200px]">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                  {userLocation.isLiveGPS ? "YOUR LIVE LOCATION (GPS)" : "YOUR LOCATION (CITY BASE)"}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {userLocation.label || "Current Dispatcher Position"}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500">
                  Coordinates: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Ambulance GPS Marker */}
        {ambulanceLocation && (!userLocation || (userLocation.lat !== ambulanceLocation.lat || userLocation.lng !== ambulanceLocation.lng)) && (
          <Marker
            position={[ambulanceLocation.lat, ambulanceLocation.lng]}
            icon={ambulanceIcon}
          >
            <Popup>
              <div className="p-3 font-sans min-w-[200px]">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                  AMBULANCE TELEMETRY ORIGIN
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {ambulanceLocation.unitId || "EMS Inbound Unit"}
                </div>
                {ambulanceLocation.condition && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Condition: <span className="font-semibold">{ambulanceLocation.condition}</span>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500">
                  GPS: {ambulanceLocation.lat.toFixed(4)}, {ambulanceLocation.lng.toFixed(4)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Hospital Facility Markers */}
        {hospitals.map((hosp) => {
          let status: HospitalMarkerStatus = "DEFAULT";
          if (hosp.id === selectedHospitalId || hosp.isSelected) {
            status = "SELECTED";
          } else if (hosp.isSuitable === true) {
            status = "SUITABLE";
          } else if (hosp.isSuitable === false) {
            status = "UNSUITABLE";
          }

          const displayBeds =
            hosp.targetCategoryBeds !== undefined
              ? hosp.targetCategoryBeds
              : hosp.availableBeds;

          return (
            <Marker
              key={hosp.id}
              position={[hosp.latitude, hosp.longitude]}
              icon={createHospitalIcon(status, displayBeds)}
              eventHandlers={{
                click: () => onSelectHospital?.(hosp),
              }}
            >
              <Popup>
                <div className="p-3 font-sans min-w-[240px]">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                        hosp.isSuitable
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {hosp.isSuitable ? "SUITABLE" : "FACILITY"}
                    </span>
                    {hosp.distanceKm !== null && hosp.distanceKm !== undefined && (
                      <span className="text-[11px] font-mono font-bold text-blue-700 dark:text-blue-400">
                        {formatDistanceKm(hosp.distanceKm)}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 leading-tight">
                    {hosp.name}
                  </h4>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                    {hosp.city}{hosp.state ? `, ${hosp.state}` : ""}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono text-xs">
                    <span className="text-slate-500">Available:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {hosp.availableBeds ?? 0} {hosp.totalBeds ? `/ ${hosp.totalBeds}` : ""} Beds
                    </span>
                  </div>

                  {hosp.phone && (
                    <div className="mt-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                      Emergency: <span className="font-bold text-slate-900 dark:text-slate-200">{hosp.phone}</span>
                    </div>
                  )}

                  {onInitiateDispatch && (
                    <button
                      onClick={() => onInitiateDispatch(hosp)}
                      className="mt-3 w-full py-1.5 px-3 bg-blue-700 hover:bg-blue-800 text-white font-mono text-xs font-semibold rounded-sm transition-colors cursor-pointer"
                    >
                      Initiate Dispatch Alert →
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
