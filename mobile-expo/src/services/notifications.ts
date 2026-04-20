// ============================================================================
// Push Notification Service — Expo Push Notifications
// ============================================================================

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
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
 * Inisialisasi notification channel (Android) dan request permission.
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
 * Return null jika gagal atau bukan physical device.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[notifications] Push notification hanya untuk physical device.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[notifications] Permission tidak diberikan.");
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined,
    });
    console.log("[notifications] Expo Push Token:", tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.error("[notifications] Gagal dapatkan push token:", err);
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
    console.error("[notifications] Gagal registrasi token:", err);
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
    console.error("[notifications] Gagal hapus token:", err);
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