/**
 * Request Activity & Timeline Retention Window Calculator
 * Formula: retention = max(15 minutes, ETA duration / 4)
 */

export function calculateRetentionMinutes(etaMinutes: number): number {
  const safeEta = Math.max(1, Number(etaMinutes) || 15);
  return Math.max(15, Math.floor(safeEta / 4));
}

/**
 * Calculates the exact timestamp when the activity log retention expires.
 * Deadline = createdAt + (etaMinutes * 60 * 1000) + (retentionMinutes * 60 * 1000)
 */
export function calculateRetentionDeadline(
  createdAt: string | Date,
  etaMinutes: number
): Date {
  const startMs = new Date(createdAt).getTime();
  const etaMs = (Number(etaMinutes) || 15) * 60 * 1000;
  const retentionMs = calculateRetentionMinutes(etaMinutes) * 60 * 1000;
  return new Date(startMs + etaMs + retentionMs);
}

/**
 * Returns whether a dispatch request's activity timeline is within the active retention window.
 */
export function isWithinRetentionWindow(
  createdAt: string | Date,
  etaMinutes: number,
  currentTime: Date = new Date()
): boolean {
  const deadline = calculateRetentionDeadline(createdAt, etaMinutes);
  return currentTime.getTime() <= deadline.getTime();
}
