import L from "leaflet";

// Defensive monkeypatch for Leaflet DomUtil to prevent 'Cannot read properties of undefined (reading _leaflet_pos)'
if (typeof window !== "undefined" && L && L.DomUtil) {
  const origGetPosition = L.DomUtil.getPosition;
  if (origGetPosition) {
    L.DomUtil.getPosition = function (el: any) {
      if (!el) return new L.Point(0, 0);
      try {
        return origGetPosition.call(L.DomUtil, el) || new L.Point(0, 0);
      } catch {
        return new L.Point(0, 0);
      }
    };
  }

  const origSetPosition = L.DomUtil.setPosition;
  if (origSetPosition) {
    L.DomUtil.setPosition = function (el: any, point: any) {
      if (!el) return;
      try {
        origSetPosition.call(L.DomUtil, el, point);
      } catch {
        // Safe no-op if element is in transition or unmounted
      }
    };
  }
}

/**
 * Custom SVG DivIcons designed specifically for BedRelay.
 * Eliminates Webpack/Next.js broken marker image paths and aligns with
 * BedRelay's minimalist, high-contrast aesthetic.
 */

export function createAmbulanceIcon(): L.DivIcon {
  return L.divIcon({
    className: "bedrelay-ambulance-marker",
    html: `
      <div style="position: relative; width: 24px; height: 24px;">
        <div class="ambulance-pulse-ring"></div>
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 24px;
          height: 24px;
          background: #2563eb;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v9c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

export function createUserLocationIcon(): L.DivIcon {
  return L.divIcon({
    className: "bedrelay-user-location-marker",
    html: `
      <div style="position: relative; width: 26px; height: 26px;">
        <div class="ambulance-pulse-ring" style="top: -7px; left: -7px; width: 38px; height: 38px;"></div>
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 26px;
          height: 26px;
          background: #1d4ed8;
          border: 2.5px solid #ffffff;
          box-shadow: 0 2px 8px rgba(29,78,216,0.6);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>
        </div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -15],
  });
}

export type HospitalMarkerStatus = "SUITABLE" | "UNSUITABLE" | "DEFAULT" | "SELECTED";

export function createHospitalIcon(
  status: HospitalMarkerStatus = "DEFAULT",
  bedsCount?: number | null
): L.DivIcon {
  let bg = "#0f172a"; // Slate 900
  let border = "#ffffff";
  let textColor = "#ffffff";

  if (status === "SUITABLE") {
    bg = "#059669"; // Emerald 600
  } else if (status === "UNSUITABLE") {
    bg = "#d97706"; // Amber 600
  } else if (status === "SELECTED") {
    bg = "#1d4ed8"; // Blue 700
  }

  const badgeHtml =
    bedsCount !== undefined && bedsCount !== null
      ? `<div style="
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ffffff;
          color: #0f172a;
          border: 1.5px solid ${bg};
          font-family: monospace;
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
          padding: 2px 4px;
          border-radius: 2px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        ">${bedsCount}</div>`
      : "";

  return L.divIcon({
    className: `bedrelay-hospital-marker bedrelay-marker-${status.toLowerCase()}`,
    html: `
      <div style="position: relative; width: 28px; height: 34px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));">
        <div style="
          width: 28px;
          height: 28px;
          background: ${bg};
          border: 2px solid ${border};
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${textColor};
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </div>
        <!-- Pin Triangle Bottom -->
        <div style="
          position: absolute;
          bottom: 2px;
          left: 9px;
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid ${bg};
        "></div>
        ${badgeHtml}
      </div>
    `,
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -32],
  });
}

export function createLocationPickerIcon(): L.DivIcon {
  return L.divIcon({
    className: "bedrelay-picker-marker",
    html: `
      <div style="position: relative; width: 32px; height: 40px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35)); cursor: grab;">
        <div style="
          width: 32px;
          height: 32px;
          background: #dc2626;
          border: 2px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background: #ffffff;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -38],
  });
}
