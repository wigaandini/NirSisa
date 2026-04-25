// ============================================================================
// Push Notification Service — Expo Push Notifications (Fixed for SDK 53)
// ============================================================================

import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// Cek apakah aplikasi berjalan di dalam Expo Go (Store Client)
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Helper untuk mendapatkan modul notifications secara dinamis.
 * Ini mencegah error "Module removed from Expo Go" di SDK 53.
 */
const getNotificationsModule = () => {
  if (isExpoGo && Platform.OS === "android") return null;
  try {
    return require("expo-notifications");
  } catch (e) {
    return null;
  }
};

// Konfigurasi handler (Hanya jika bukan Expo Go Android)
const Notifications = getNotificationsModule();
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowAlert: true,
    }),
  });
}

/**
 * Inisialisasi notification channel (Android).
 */
export async function initNotifications(): Promise<void> {
  const Notif = getNotificationsModule();
  if (!Notif || Platform.OS !== "android") return;

  try {
    await Notif.setNotificationChannelAsync("expiry-alerts", {
      name: "Peringatan Kedaluwarsa",
      importance: Notif.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#BB0009",
      sound: "default",
    });
  } catch (err) {
    console.log("[notifications] Gagal membuat channel:", err);
  }
}

/**
 * Dapatkan Expo Push Token.
 */
export async function getExpoPushToken(): Promise<string | null> {
  const Notif = getNotificationsModule();
  
  if (!Device.isDevice || !Notif) {
    console.log("[notifications] Fitur push dilewati (Simulator/Expo Go Android)");
    return null;
  }

  const { status: existingStatus } = await Notif.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notif.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const projectId = 
    Constants.expoConfig?.extra?.eas?.projectId ?? 
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("[notifications] Project ID tidak ditemukan di app.json");
    return null;
  }

  try {
    const tokenData = await Notif.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err) {
    return null;
  }
}

/**
 * Registrasi push token ke backend.
 */
export async function registerPushToken(): Promise<boolean> {
  const token = await getExpoPushToken();
  if (!token) return false;

  try {
    await api.post("/notifications/token", {
      expo_push_token: token,
      device_info: `${Device.brand ?? "Unknown"} ${Device.modelName ?? ""}`.trim(),
    });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Hapus push token dari backend.
 */
export async function unregisterPushToken(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;

  try {
    await api.delete("/notifications/token", {
      params: { expo_push_token: token },
    });
  } catch (err) {}
}

/**
 * Listeners
 */
export function addNotificationReceivedListener(callback: (n: any) => void) {
  const Notif = getNotificationsModule();
  return Notif ? Notif.addNotificationReceivedListener(callback) : { remove: () => {} };
}

export function addNotificationResponseListener(callback: (r: any) => void) {
  const Notif = getNotificationsModule();
  return Notif ? Notif.addNotificationResponseReceivedListener(callback) : { remove: () => {} };
}

export async function setBadgeCount(count: number): Promise<void> {
  const Notif = getNotificationsModule();
  if (Notif) await Notif.setBadgeCountAsync(count);
}