import { useEffect, useState, useCallback, useMemo, useContext } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  StatusBar as RNStatusBar,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { LOCATION_TASK_NAME } from "./locationTask";
import { sanitizeDeviceId, MIN_ID_LENGTH } from "./firebaseConfig";
import { checkForUpdate } from "./updateChecker";
import { ThemeContext, DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY } from "./theme";

const DEVICE_ID_STORAGE_KEY = "tracker_device_id";
const VIEWER_URL = "https://munga068-ctrl.github.io/Phone-Tracker/";

// Show the update notification even if the app happens to be open in the
// foreground when the check completes.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [activeTab, setActiveTab] = useState("share");
  const [updateInfo, setUpdateInfo] = useState(null);
  const [themeName, setThemeNameState] = useState("dark");

  const theme = themeName === "light" ? LIGHT_THEME : DARK_THEME;
  const styles = useMemo(() => getStyles(theme), [theme]);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark") setThemeNameState(saved);
    })();
  }, []);

  const setThemeName = useCallback(async (name) => {
    setThemeNameState(name);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, name);
  }, []);

  useEffect(() => {
    (async () => {
      const update = await checkForUpdate();
      if (!update) return;
      setUpdateInfo(update);

      // Local notification is best-effort — if permission isn't granted the
      // in-app banner below still tells them, so this failing silently is fine.
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Phone Tracker update available",
              body: `Version ${update.latestVersion} is ready — tap to download.`,
              data: { url: update.downloadUrl },
            },
            trigger: null, // fire immediately
          });
        }
      } catch (e) {
        // Notifications not available/denied — banner below still covers it.
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (url) Linking.openURL(url);
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName }}>
      <SafeAreaView style={styles.container}>
        <StatusBar style={theme.statusBarStyle} />

        {updateInfo && (
          <Pressable
            style={styles.updateBanner}
            onPress={() => Linking.openURL(updateInfo.downloadUrl)}
          >
            <Text style={styles.updateBannerText}>
              Update {updateInfo.latestVersion} available — tap to download
            </Text>
          </Pressable>
        )}

        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabButton, activeTab === "share" && styles.tabButtonActive]}
            onPress={() => setActiveTab("share")}
          >
            <Text style={[styles.tabText, activeTab === "share" && styles.tabTextActive]}>
              Share My Location
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === "find" && styles.tabButtonActive]}
            onPress={() => setActiveTab("find")}
          >
            <Text style={[styles.tabText, activeTab === "find" && styles.tabTextActive]}>
              Find My Phone
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === "settings" && styles.tabButtonActive]}
            onPress={() => setActiveTab("settings")}
          >
            <Text style={[styles.tabText, activeTab === "settings" && styles.tabTextActive]}>
              Settings
            </Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          {activeTab === "share" && <ShareScreen />}
          {activeTab === "find" && <FindPhoneScreen />}
          {activeTab === "settings" && <SettingsScreen />}
        </View>
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

function ShareScreen() {
  const { theme } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [deviceId, setDeviceId] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState("Not sharing.");

  const beginSharing = useCallback(async (rawId, { silent = false } = {}) => {
    const cleanId = sanitizeDeviceId(rawId);
    if (cleanId.length < MIN_ID_LENGTH) {
      if (!silent) {
        Alert.alert(
          "Device ID too short",
          `Enter at least ${MIN_ID_LENGTH} characters (letters, numbers, "-", "_").`
        );
      }
      return;
    }
    setDeviceId(cleanId);
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, cleanId);

    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") {
      if (!silent) {
        Alert.alert("Permission needed", "Location permission is required to share your position.");
      } else {
        setStatus("Couldn't resume automatically — tap Start Sharing.");
      }
      return;
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== "granted") {
      if (!silent) {
        Alert.alert(
          "Background permission needed",
          'For this to keep working with the app closed, choose "Allow all the time" when prompted for location access.'
        );
      } else {
        setStatus("Couldn't resume automatically — tap Start Sharing.");
      }
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
  }, []);

  useEffect(() => {
    (async () => {
      const savedId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (savedId) setDeviceId(savedId);

      const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );
      setIsSharing(alreadyRunning);

      if (alreadyRunning) {
        setStatus("Sharing location in the background.");
      } else if (savedId) {
        // A saved ID but no running task means either this is the first
        // open after a reboot (the OS kills the foreground service on
        // restart, nothing auto-restarts it) or the task was otherwise
        // killed. Since permission grants persist across reboots, we can
        // safely resume without asking the user to do anything — this is
        // what makes the "tap to resume" boot notification effectively
        // one tap instead of a full manual reconfiguration.
        setStatus("Resuming sharing after restart…");
        await beginSharing(savedId, { silent: true });
      }
    })();
  }, [beginSharing]);

  const startSharing = useCallback(() => beginSharing(deviceId), [beginSharing, deviceId]);

  const stopSharing = useCallback(async () => {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    setIsSharing(false);
    setStatus("Stopped sharing location.");
  }, []);

  return (
    <View style={styles.shareScreen}>
      <Text style={styles.title}>Phone Tracker</Text>
      <Text style={styles.subtitle}>
        Same Device ID as the web viewer — this app keeps reporting location
        even when it's closed, the screen is off, or the phone restarts
        (you'll get a notification to tap after a reboot).
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Device ID / PIN (6+ characters)"
        placeholderTextColor={theme.placeholder}
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
    </View>
  );
}

function FindPhoneScreen() {
  const { theme } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.findScreen}>
      <WebView
        source={{ uri: VIEWER_URL }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
        // The viewer page uses browser geolocation for the "Directions"
        // feature — this grants that permission through to the WebView.
        geolocationEnabled
        javaScriptEnabled
        domStorageEnabled
      />
      {loading && (
        <View style={styles.webviewLoading}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.webviewLoadingText}>Loading map…</Text>
        </View>
      )}
    </View>
  );
}

function SettingsScreen() {
  const { theme, themeName, setThemeName } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={styles.settingsScreen}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Choose how Phone Tracker looks on this device.</Text>

      <View style={styles.themeRow}>
        <Pressable
          style={[styles.themeOption, themeName === "dark" && styles.themeOptionActive]}
          onPress={() => setThemeName("dark")}
        >
          <Text style={[styles.themeOptionText, themeName === "dark" && styles.themeOptionTextActive]}>
            🌙 Night Mode
          </Text>
        </Pressable>
        <Pressable
          style={[styles.themeOption, themeName === "light" && styles.themeOptionActive]}
          onPress={() => setThemeName("light")}
        >
          <Text style={[styles.themeOptionText, themeName === "light" && styles.themeOptionTextActive]}>
            ☀️ Light Mode
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Regenerated per theme rather than a single static StyleSheet, since
// colors need to swap between the dark and light palettes at runtime.
function getStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      // React Native's core SafeAreaView only accounts for safe-area insets
      // on iOS — on Android it does nothing, which is why the tab bar was
      // sitting flush against the very top of the screen. This adds the
      // actual status bar height back in on Android.
      paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 24 : 0,
    },
    updateBanner: {
      backgroundColor: theme.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    updateBannerText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingTop: 6,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 14,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabButtonActive: {
      borderBottomColor: theme.accent,
    },
    tabText: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "600",
    },
    tabTextActive: {
      color: theme.ink,
    },
    content: {
      flex: 1,
    },
    shareScreen: {
      flex: 1,
      padding: 24,
      justifyContent: "center",
    },
    settingsScreen: {
      flex: 1,
      padding: 24,
    },
    findScreen: {
      flex: 1,
    },
    webview: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    webviewLoading: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bg,
    },
    webviewLoadingText: {
      marginTop: 12,
      color: theme.muted,
      fontSize: 13,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.ink,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 13,
      color: theme.muted,
      marginBottom: 24,
      lineHeight: 18,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 14,
      fontSize: 16,
      color: theme.ink,
      backgroundColor: theme.panel,
      marginBottom: 16,
    },
    button: {
      borderRadius: 8,
      padding: 16,
      alignItems: "center",
    },
    startButton: {
      backgroundColor: theme.accent,
    },
    stopButton: {
      backgroundColor: theme.danger,
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    status: {
      marginTop: 20,
      fontSize: 13,
      color: theme.muted,
      textAlign: "center",
    },
    themeRow: {
      flexDirection: "row",
      gap: 12,
    },
    themeOption: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingVertical: 20,
      alignItems: "center",
      backgroundColor: theme.panel,
    },
    themeOptionActive: {
      borderColor: theme.accent,
      borderWidth: 2,
    },
    themeOptionText: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: "600",
    },
    themeOptionTextActive: {
      color: theme.ink,
    },
  });
}
