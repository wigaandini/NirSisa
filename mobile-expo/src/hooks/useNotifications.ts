// ============================================================================
// useNotifications Hook
// ----------------------------------------------------------------------------
// Hook untuk inisialisasi push notification di level App.
//
// Cara pakai di App.tsx atau komponen top-level SETELAH AuthProvider:
//
//   import { useNotifications } from "./src/hooks/useNotifications";
//
//   function AppContent() {
//     useNotifications();  // <-- tambahkan ini
//     return <AppNavigator />;
//   }
// ============================================================================

import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useAuth } from "../context/AuthContext";
import {
  initNotifications,
  registerPushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from "../services/notifications";

export function useNotifications() {
  const { session } = useAuth();
  const receivedSub = useRef<Notifications.Subscription | null>(null);
  const responseSub = useRef<Notifications.Subscription | null>(null);
  const registered = useRef(false);

  // 1. Init notification channel (sekali saat mount)
  useEffect(() => {
    initNotifications();
  }, []);

  // 2. Register token setelah login
  useEffect(() => {
    if (session?.user && !registered.current) {
      registered.current = true;
      registerPushToken().then((ok) => {
        if (ok) console.log("[useNotifications] Push token registered.");
      });
    }
    if (!session?.user) {
      registered.current = false;
    }
  }, [session?.user]);

  // 3. Listeners
  useEffect(() => {
    // Notifikasi diterima saat app foreground
    receivedSub.current = addNotificationReceivedListener((notification) => {
      console.log("[useNotifications] Received:", notification.request.content.title);
    });

    // User tap notifikasi (dari background/killed)
    responseSub.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      console.log("[useNotifications] Tapped:", data);
      // Navigasi ke screen tertentu bisa ditambahkan di sini
    });

    return () => {
      receivedSub.current?.remove();
      responseSub.current?.remove();
    };
  }, []);
}
