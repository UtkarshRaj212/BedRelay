/**
 * BedRelay Dispatcher Client Session Manager
 * Distinguishes unauthenticated ambulance dispatcher/browser sessions.
 */

export const DISPATCHER_SESSION_KEY = "bedrelay_dispatcher_session_id";

export function getDispatcherSessionId(): string {
  if (typeof window === "undefined") return "";

  // 1. Check localStorage
  let sessionId = localStorage.getItem(DISPATCHER_SESSION_KEY);

  // 2. If not in localStorage, check cookies
  if (!sessionId) {
    const match = document.cookie.match(new RegExp(`(^|;\\s*)${DISPATCHER_SESSION_KEY}=([^;]+)`));
    if (match && match[2]) {
      sessionId = decodeURIComponent(match[2]);
    }
  }

  // 3. If still empty, generate a new persistent session ID
  if (!sessionId) {
    const randomHex = Math.random().toString(36).substring(2, 10);
    sessionId = `disp_sess_${Date.now()}_${randomHex}`;
  }

  // Ensure stored in both localStorage and cookies for 1 year
  try {
    localStorage.setItem(DISPATCHER_SESSION_KEY, sessionId);
    document.cookie = `${DISPATCHER_SESSION_KEY}=${encodeURIComponent(
      sessionId
    )}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {
    // Ignore storage quota or disabled cookie errors
  }

  return sessionId;
}
