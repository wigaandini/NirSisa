// ============================================================================
// Push Notification Service — Expo Push Notifications
// ============================================================================

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// Konfigurasi handler: tampilkan notif walau app foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowAlert: true,
  }),
});

/**
 * Inisialisasi notification channel (Android).
 * Panggil sekali saat app start (di App.tsx).
 */
export async function initNotifications(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("expiry-alerts", {
      name: "Peringatan Kedaluwarsa",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#BB0009",
      sound: "default",
    });
  }
}

/**
 * Minta izin push notification dan dapatkan Expo Push Token.
 * Return null jika:
 * - Bukan physical device (simulator)
 * - Permission ditolak
 * - Running di Expo Go (push tidak didukung)
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[notifications] Bukan physical device, skip push token.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[notifications] Permission tidak diberikan.");
    return null;
  }

  // Ambil projectId dari EAS config atau Constants
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined;

  // ▼▼▼ FIX: jangan console.error (red box), pakai console.warn ▼▼▼
  if (!projectId) {
    console.warn(
      "[notifications] Project ID tidak tersedia. " +
      "Push token memerlukan EAS build, bukan Expo Go. " +
      "Pastikan extra.eas.projectId diisi di app.json."
    );
    return null;
  }
  // ▲▲▲

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    console.log("[notifications] Expo Push Token:", tokenData.data);
    return tokenData.data;
  } catch (err) {
    // Expo Go tidak mendukung push notification — ini expected, bukan fatal
    console.log(
      "[notifications] Push token tidak tersedia (kemungkinan Expo Go):",
      (err as Error).message
    );
    return null;
  }
}

/**
 * Registrasi push token ke backend NirSisa.
 * Panggil setelah user berhasil login.
 */
export async function registerPushToken(): Promise<boolean> {
  const token = await getExpoPushToken();
  if (!token) return false;

  try {
    await api.post("/notifications/token", {
      expo_push_token: token,
      device_info: `${Device.brand ?? "Unknown"} ${Device.modelName ?? ""}`.trim(),
    });
    console.log("[notifications] Token berhasil diregistrasi ke backend.");
    return true;
  } catch (err) {
    console.warn("[notifications] Gagal registrasi token:", err);
    return false;
  }
}

/**
 * Hapus/nonaktifkan push token dari backend (saat logout).
 */
export async function unregisterPushToken(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;

  try {
    await api.delete("/notifications/token", {
      params: { expo_push_token: token },
    });
    console.log("[notifications] Token berhasil dihapus dari backend.");
  } catch (err) {
    console.warn("[notifications] Gagal hapus token:", err);
  }
}

/**
 * Listener untuk notifikasi yang diterima saat app foreground.
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Listener untuk tap notifikasi (dari background/killed state).
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Set badge count (iOS).
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}