// Same Firebase Realtime Database used by the web tracker at
// github.com/munga068-ctrl/Phone-Tracker — this app writes to the exact
// same devices/{deviceId} path, so it works interchangeably with the
// existing viewer page.
export const FIREBASE_DB_URL = "https://phone-tracker-753a9-default-rtdb.firebaseio.com";

// Keep in sync with tracker.js / viewer.js in the Phone-Tracker web repo.
export const SAFE_ID_PATTERN = /[^a-zA-Z0-9_-]/g;
export function sanitizeDeviceId(raw) {
  return raw.trim().replace(SAFE_ID_PATTERN, "");
}
export const MIN_ID_LENGTH = 6;
