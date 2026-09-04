/**
 * BedRelay Universal Date Formatting Utilities
 * Mandates DD/MM/YYYY format across the entire application.
 */

/**
 * Formats a Date, timestamp, or ISO string to "DD/MM/YYYY" (e.g. 04/09/2026).
 */
export function formatDate(date: string | number | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats a Date, timestamp, or ISO string to "DD/MM/YYYY, HH:mm" or "DD/MM/YYYY, HH:mm:ss".
 */
export function formatDateTime(
  date: string | number | Date | null | undefined,
  includeSeconds = false
): string {
  if (!date) return "—";
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  if (includeSeconds) {
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
  }
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}
