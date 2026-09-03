import { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCATION_TASK_NAME } from "./locationTask";
import { sanitizeDeviceId, MIN_ID_LENGTH } from "./firebaseConfig";

const DEVICE_ID_STORAGE_KEY = "tracker_device_id";

export default function App() {
  const [deviceId, setDeviceId] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState("Not sharing.");

  useEffect(() => {
    (async () => {
      const savedId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (savedId) setDeviceId(savedId);
      const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );
      setIsSharing(alreadyRunning);
      if (alreadyRunning) setStatus("Sharing location in the background.");
    })();
  }, []);

  const startSharing = useCallback(async () => {
    const cleanId = sanitizeDeviceId(deviceId);
    if (cleanId.length < MIN_ID_LENGTH) {
      Alert.alert(
        "Device ID too short",
        `Enter at least ${MIN_ID_LENGTH} characters (letters, numbers, "-", "_").`
      );
      return;
    }
    setDeviceId(cleanId);
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, cleanId);

    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") {
      Alert.alert("Permission needed", "Location permission is required to share your position.");
      return;
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== "granted") {
      Alert.alert(
        "Background permission needed",
        'For this to keep working with the app closed, choose "Allow all the time" when prompted for location access.'
      );
      return;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 20000, // report at most every 20s
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Phone Tracker is sharing your location",
        notificationBody: `Sharing as "${cleanId}". Tap to open the app.`,
      },
    });

    setIsSharing(true);
    setStatus("Sharing location — this keeps running even if you close the app.");
  }, [deviceId]);

  const stopSharing = useCallback(async () => {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    setIsSharing(false);
    setStatus("Stopped sharing location.");
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Phone Tracker</Text>
      <Text style={styles.subtitle}>
        Same Device ID as the web viewer — this app just keeps reporting
        location even when it's closed or the screen is off.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Device ID / PIN (6+ characters)"
        value={deviceId}
        onChangeText={setDeviceId}
        editable={!isSharing}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {!isSharing ? (
        <Pressable style={[styles.button, styles.startButton]} onPress={startSharing}>
          <Text style={styles.buttonText}>Start Sharing</Text>
        </Pressable>
      ) : (
        <Pressable style={[styles.button, styles.stopButton]} onPress={stopSharing}>
          <Text style={styles.buttonText}>Stop Sharing</Text>
        </Pressable>
      )}

      <Text style={styles.status}>{status}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1115",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e7e9ee",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#9aa1ac",
    marginBottom: 24,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: "#2a2f38",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: "#e7e9ee",
    backgroundColor: "#171a1f",
    marginBottom: 16,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#185FA5",
  },
  stopButton: {
    backgroundColor: "#A32D2D",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  status: {
    marginTop: 20,
    fontSize: 13,
    color: "#9aa1ac",
    textAlign: "center",
  },
});
