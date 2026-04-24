import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Alert } from "react-native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
import * as SecureStore from "expo-secure-store";

// ============================================================================
// KONFIGURASI SESSION TIMEOUT
// ============================================================================
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 menit idle → auto-logout

// Hard session limit: maksimal berapa lama user bisa stay logged in
// sejak login, REGARDLESS of activity. Pengganti Supabase Pro "time-box".
// Set 0 untuk disable. Default: 24 jam.
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 jam

const SESSION_START_KEY = "nirsisa_session_start";

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  photoUri: string | null;
  setPhotoUri: (uri: string | null) => void;
  uploadAndPersistPhoto: (localUri: string) => Promise<string | null>;
  /** Panggil dari screen mana saja saat user melakukan aksi (tap, scroll, dll)
   *  untuk reset inactivity timer. Sudah otomatis dipanggil oleh api interceptor. */
  touchActivity: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  signOut: async () => {},
  photoUri: null,
  setPhotoUri: () => {},
  uploadAndPersistPhoto: async () => null,
  touchActivity: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Inactivity tracking
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track waktu app masuk background
  const backgroundSinceRef = useRef<number | null>(null);

  // ─── CORE AUTH SETUP ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // ▼▼▼ FIX Error 2: handle "Refresh Token Not Found" gracefully ▼▼▼
      if (error) {
        console.warn("[AuthContext] getSession error (stale token?):", error.message);
        // Session rusak — bersihkan dan arahkan ke login
        supabase.auth.signOut().catch(() => {});
        setSession(null);
        setLoading(false);
        return;
      }
      // ▲▲▲
      setSession(session);
      if (session?.user) {
        loadAvatarFromDB(session.user.id);
      }
      setLoading(false);
    }).catch((err) => {
      // Catch unexpected errors (network, dll)
      console.warn("[AuthContext] Unexpected getSession error:", err);
      setSession(null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === "SIGNED_IN" && session?.user) {
        loadAvatarFromDB(session.user.id);
        resetInactivityTimer();
        // Catat waktu login untuk hard session limit
        SecureStore.setItemAsync(SESSION_START_KEY, Date.now().toString());
      }

      if (event === "SIGNED_OUT") {
        setPhotoUri(null);
        clearInactivityTimer();
      }

      // Token berhasil di-refresh oleh Supabase client
      if (event === "TOKEN_REFRESHED") {
        console.log("[AuthContext] Token refreshed otomatis oleh Supabase.");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─── APPSTATE LISTENER ────────────────────────────────────────────────────
  // Cek session validity saat app kembali dari background
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === "active") {
        // App kembali ke foreground
        const bgSince = backgroundSinceRef.current;
        backgroundSinceRef.current = null;

        if (!session) return;

        // ── Hard session limit check ──
        // Pengganti Supabase Pro "time-box session"
        if (MAX_SESSION_AGE_MS > 0) {
          const isExpired = await isSessionTooOld();
          if (isExpired) {
            Alert.alert(
              "Sesi Berakhir",
              "Sesi login Anda telah melampaui batas waktu 24 jam. Silakan login kembali.",
              [{ text: "OK" }]
            );
            await signOut();
            return;
          }
        }

        // ── Inactivity check ──
        if (bgSince && INACTIVITY_TIMEOUT_MS > 0) {
          const idleDuration = Date.now() - bgSince;
          if (idleDuration >= INACTIVITY_TIMEOUT_MS) {
            console.log(
              `[AuthContext] Idle ${Math.round(idleDuration / 60000)} menit di background → auto-logout`
            );
            Alert.alert(
              "Sesi Berakhir",
              "Anda telah tidak aktif terlalu lama. Silakan login kembali.",
              [{ text: "OK" }]
            );
            await signOut();
            return;
          }
        }

        // Coba refresh session (token mungkin expired selama di background)
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error || !data.session) {
            console.warn("[AuthContext] Session refresh gagal setelah resume:", error?.message);
            Alert.alert(
              "Sesi Berakhir",
              "Sesi Anda telah berakhir. Silakan login kembali.",
              [{ text: "OK" }]
            );
            await signOut();
          } else {
            console.log("[AuthContext] Session valid setelah resume dari background.");
            resetInactivityTimer();
          }
        } catch (err) {
          console.error("[AuthContext] Error checking session on resume:", err);
        }
      } else if (nextState === "background" || nextState === "inactive") {
        // App masuk background — catat waktu
        backgroundSinceRef.current = Date.now();
        clearInactivityTimer();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [session]);

  // ─── INACTIVITY TIMEOUT ──────────────────────────────────────────────────
  // Auto-logout setelah INACTIVITY_TIMEOUT_MS tanpa aktivitas user
  const touchActivity = () => {
    lastActivityRef.current = Date.now();
    resetInactivityTimer();
  };

  const resetInactivityTimer = () => {
    clearInactivityTimer();

    if (INACTIVITY_TIMEOUT_MS <= 0) return; // disabled

    inactivityTimerRef.current = setTimeout(async () => {
      // Cek hard session limit dulu
      if (MAX_SESSION_AGE_MS > 0) {
        const tooOld = await isSessionTooOld();
        if (tooOld) {
          console.log("[AuthContext] Hard session limit (24h) → auto-logout");
          Alert.alert(
            "Sesi Berakhir",
            "Sesi login Anda telah melampaui batas waktu 24 jam. Silakan login kembali.",
            [{ text: "OK" }]
          );
          await signOut();
          return;
        }
      }

      // Cek inactivity
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        console.log("[AuthContext] Inactivity timeout → auto-logout");
        Alert.alert(
          "Sesi Berakhir",
          "Anda telah tidak aktif selama 30 menit. Silakan login kembali untuk keamanan.",
          [{ text: "OK" }]
        );
        await signOut();
      }
    }, INACTIVITY_TIMEOUT_MS);
  };

  const clearInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  };

  // Start inactivity timer saat session aktif
  useEffect(() => {
    if (session) {
      resetInactivityTimer();
    } else {
      clearInactivityTimer();
    }
    return () => clearInactivityTimer();
  }, [session]);

  // ─── HARD SESSION LIMIT ────────────────────────────────────────────────
  // Cek apakah session sudah melebihi MAX_SESSION_AGE_MS sejak login
  const isSessionTooOld = async (): Promise<boolean> => {
    try {
      const startStr = await SecureStore.getItemAsync(SESSION_START_KEY);
      if (!startStr) return false; // belum ada record → anggap fresh
      const elapsed = Date.now() - parseInt(startStr, 10);
      return elapsed >= MAX_SESSION_AGE_MS;
    } catch {
      return false;
    }
  };

  // ─── AVATAR ──────────────────────────────────────────────────────────────
  const loadAvatarFromDB = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();

      if (data?.avatar_url) {
        setPhotoUri(data.avatar_url);
      }
    } catch (err) {
      console.warn("[AuthContext] gagal load avatar:", err);
    }
  };

  const uploadAndPersistPhoto = async (localUri: string): Promise<string | null> => {
    if (!session?.user?.id) return null;

    try {
      const userId = session.user.id;
      const fileExt = localUri.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${userId}/avatar.${fileExt}`;
      const contentType = fileExt === "jpg" ? "image/jpeg" : `image/${fileExt}`;

      const response = await fetch(localUri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          cacheControl: "3600",
          upsert: true,
          contentType,
        });

      if (uploadError) {
        console.error("[AuthContext] upload error:", uploadError.message);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) return null;

      const finalUrl = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from("profiles")
        .update({
          avatar_url: finalUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      setPhotoUri(finalUrl);
      return finalUrl;
    } catch (err) {
      console.error("[AuthContext] uploadAndPersistPhoto error:", err);
      return null;
    }
  };

  // ─── SIGN OUT ────────────────────────────────────────────────────────────
  const signOut = async () => {
    clearInactivityTimer();
    backgroundSinceRef.current = null;
    setPhotoUri(null);
    await SecureStore.deleteItemAsync(SESSION_START_KEY);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        signOut,
        photoUri,
        setPhotoUri,
        uploadAndPersistPhoto,
        touchActivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);