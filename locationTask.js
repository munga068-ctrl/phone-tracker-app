import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Battery from "expo-battery";
import { FIREBASE_DB_URL } from "./firebaseConfig";

export const LOCATION_TASK_NAME = "phone-tracker-background-location";
const DEVICE_ID_STORAGE_KEY = "tracker_device_id";

// This function runs even when the app is backgrounded or swiped away from
// recents — it's registered with the OS via expo-task-manager, and Android
// keeps it alive through the foreground service (the persistent
// notification you'll see while sharing is active). This is the piece a
// plain website could never do; killing the browser tab always killed the
// code, but a registered background task survives that.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Location task error:", error.message);
    return;
  }
  if (!data) return;

  const { locations } = data;
  const latest = locations && locations[locations.length - 1];
  if (!latest) return;

  const deviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (!deviceId) return; // sharing was stopped / never configured

  let batteryLevel = null;
  try {
    const level = await Battery.getBatteryLevelAsync();
    if (typeof level === "number" && level >= 0) {
      batteryLevel = Math.round(level * 100);
    }
  } catch (e) {
    // Battery API can be unreliable mid-background on some devices — not fatal.
  }

  const payload = {
    lat: latest.coords.latitude,
    lng: latest.coords.longitude,
    accuracy: latest.coords.accuracy,
    battery: batteryLevel,
    timestamp: Date.now(),
  };

  try {
    await fetch(`${FIREBASE_DB_URL}/devices/${deviceId}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("Firebase write failed:", e.message);
    // No network right now (e.g. no signal) — the next location update will
    // retry automatically; nothing further to do here.
  }
});
