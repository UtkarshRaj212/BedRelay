export function isValidCoordinates(lat: unknown, lng: unknown): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (typeof lat === "string" && lat.trim() === "") return false;
  if (typeof lng === "string" && lng.trim() === "") return false;
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) return false;
  return numLat >= -90 && numLat <= 90 && numLng >= -180 && numLng <= 180;
}

export function formatDistanceKm(distanceKm: number | null | undefined): string {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) return "—";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export const INDIAN_CITIES = [
  { name: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { name: "New Delhi", state: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { name: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867 },
  { name: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
];

export type DestinationInput =
  | {
      lat?: number | null;
      lng?: number | null;
      latitude?: number | null;
      longitude?: number | null;
      name?: string | null;
      address?: string | null;
      city?: string | null;
      origin?: {
        lat?: number | null;
        lng?: number | null;
        latitude?: number | null;
        longitude?: number | null;
      } | null;
    }
  | null
  | undefined;

/**
 * Builds a universal Google Maps driving directions URL opening in a new tab.
 * Accurately sets the destination using hospital name and city.
 * If an explicit origin coordinate is provided in dest.origin or options.origin (such as ambulance location at request time),
 * routes from that origin. If omitted, Google Maps routes from the user's real-world current device location.
 */
export function buildGoogleMapsDirectionsUrl(
  destinationOrOrigin: DestinationInput,
  maybeDestination?: DestinationInput,
  options?: {
    origin?: {
      lat?: number | null;
      lng?: number | null;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  }
): string {
  // If called with legacy 2-arg signature (origin, destination), resolve to the destination
  let dest = destinationOrOrigin;
  if (maybeDestination !== undefined && maybeDestination !== null) {
    dest = maybeDestination;
  }

  if (!dest) {
    return "https://www.google.com/maps";
  }

  // Resolve explicit origin if provided
  const origin = dest.origin || options?.origin || null;
  let originParam = "";
  if (origin) {
    const oLat = origin.lat ?? origin.latitude;
    const oLng = origin.lng ?? origin.longitude;
    if (isValidCoordinates(oLat, oLng)) {
      originParam = `&origin=${Number(Number(oLat).toFixed(6))},${Number(Number(oLng).toFixed(6))}`;
    }
  }

  // Prioritize hospital name (+ city/address) for accurate real-world place resolution in Google Maps
  if (dest.name && dest.name.trim()) {
    const parts = [dest.name.trim()];
    if (dest.city && dest.city.trim()) {
      parts.push(dest.city.trim());
    } else if (dest.address && dest.address.trim()) {
      parts.push(dest.address.trim());
    }
    const query = encodeURIComponent(parts.join(", "));
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${query}&travelmode=driving`;
  }

  // Fallback to address/city query if name is missing
  if (dest.address || dest.city) {
    const parts = [dest.address, dest.city].filter(Boolean);
    const query = encodeURIComponent(parts.join(", "));
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${query}&travelmode=driving`;
  }

  // Fallback to coordinates only if no name or address text is available
  const rawLat = dest.lat ?? dest.latitude;
  const rawLng = dest.lng ?? dest.longitude;
  if (isValidCoordinates(rawLat, rawLng)) {
    const lat = Number(Number(rawLat).toFixed(6));
    const lng = Number(Number(rawLng).toFixed(6));
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${lat},${lng}&travelmode=driving`;
  }

  return "https://www.google.com/maps";
}

/**
 * Finds the closest Indian city preset to a given GPS coordinate point.
 */
export function findNearestCity(lat: number, lng: number): (typeof INDIAN_CITIES)[number] | null {
  if (!isValidCoordinates(lat, lng)) return null;
  let closest: (typeof INDIAN_CITIES)[number] | null = null;
  let minDistance = Infinity;

  for (const city of INDIAN_CITIES) {
    const dist = calculateDistanceKm(lat, lng, city.lat, city.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = city;
    }
  }

  return closest;
}


