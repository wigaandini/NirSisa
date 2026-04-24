// ============================================================================
// Push Notification Service — Expo Push Notifications (Fix SDK 53 Expo Go)
// ============================================================================

import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// Cek lingkungan runtime
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isAndroid = Platform.OS === "android";

/**
 * PENTING: Di SDK 53, mengimport expo-notifications langsung akan membuat 
 * aplikasi crash di Expo Go Android. Kita gunakan require() agar library 
 * hanya dimuat jika bukan di Expo Go Android.
 */
let Notifications: any = null;
if (!(isExpoGo && isAndroid)) {
  try {
    Notifications = require("expo-notifications");
  } catch (e) {
    console.error("Gagal memuat expo-notifications:", e);
  }
}

// Konfigurasi handler (hanya jika library berhasil dimuat)
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
  if (!Notifications || (isExpoGo && isAndroid)) {
    console.log("[notifications] Berjalan di Expo Go Android. Init channel dilewati.");
    return;
  }

  if (isAndroid) {
    try {
      await Notifications.setNotificationChannelAsync("expiry-alerts", {
        name: "Peringatan Kedaluwarsa",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#BB0009",
        sound: "default",
      });
    } catch (err) {
      console.log("[notifications] Gagal membuat channel:", err);
    }
  }
}

/**
 * Minta izin push notification dan dapatkan Expo Push Token.
 */
export async function getExpoPushToken(): Promise<string | null> {
  // 1. Cek apakah ini perangkat fisik
  if (!Device.isDevice) {
    console.log("[notifications] Bukan physical device, skip push token.");
    return null;
  }

  // 2. Cek ketersediaan library (Cegah error SDK 53)
  if (!Notifications || (isExpoGo && isAndroid)) {
    console.warn(
      "[notifications] Remote notifications tidak didukung di Expo Go Android (SDK 53+). " +
      "Gunakan Development Build untuk mengetes fitur ini."
    );
    return null;
  }

  try {
    // 3. Kelola Izin (Permissions)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[notifications] Izin notifikasi ditolak oleh pengguna.");
      return null;
    }

    // 4. Dapatkan Project ID
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.error("[notifications] Project ID tidak ditemukan di app.json.");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("[notifications] Expo Push Token didapat:", tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.log("[notifications] Gagal mengambil Push Token:", (err as Error).message);
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
    console.log("[notifications] Token berhasil didaftarkan ke server.");
    return true;
  } catch (err) {
    console.warn("[notifications] Gagal mengirim token ke server:", err);
    return false;
  }
}

/**
 * Hapus push token dari backend.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!Notifications || (isExpoGo && isAndroid)) return;

  const token = await getExpoPushToken();
  if (!token) return;

  try {
    await api.delete("/notifications/token", {
      params: { expo_push_token: token },
    });
    console.log("[notifications] Token dihapus dari backend.");
  } catch (err) {
    console.warn("[notifications] Gagal menghapus token dari server:", err);
  }
}

// Listener standar
export function addNotificationReceivedListener(
  callback: (notification: any) => void
): any {
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: any) => void
): any {
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function setBadgeCount(count: number): Promise<void> {
  if (!Notifications || (isExpoGo && isAndroid)) return;
  await Notifications.setBadgeCountAsync(count);
}