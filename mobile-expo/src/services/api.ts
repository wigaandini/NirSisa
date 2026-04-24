// ============================================================================
// API Client — axios instance terpusat
// ============================================================================
// Features:
// - Auto-inject Authorization header dari Supabase session
// - Response interceptor: 401 → coba refresh token → retry request
// - Kalau refresh gagal → force signOut (redirect ke login)
// ============================================================================

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { supabase } from "./supabase";

export const API_URL = "https://nirsisa-production.up.railway.app";

// Flag untuk mencegah multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── REQUEST INTERCEPTOR ────────────────────────────────────────────────────
// Auto-inject token di setiap request
api.interceptors.request.use(async (config) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn("[api] gagal ambil session:", err);
  }
  return config;
});

// ─── RESPONSE INTERCEPTOR ───────────────────────────────────────────────────
// Handle 401: coba refresh token, retry request. Kalau gagal → force logout.
api.interceptors.response.use(
  // Success — pass through
  (response) => response,

  // Error — intercept 401
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Hanya handle 401 (Unauthorized / Token Expired)
    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Jangan retry kalau sudah pernah retry (infinite loop prevention)
    if (originalRequest._retry) {
      console.warn("[api] Token refresh sudah dicoba, force logout.");
      await forceSignOut();
      return Promise.reject(error);
    }

    // Kalau sedang ada refresh in progress, queue request ini
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject: (err: any) => {
            reject(err);
          },
        });
      });
    }

    // Mulai refresh
    originalRequest._retry = true;
    isRefreshing = true;

    try {
      console.log("[api] Token expired, mencoba refresh...");
      const { data, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !data.session) {
        console.warn("[api] Refresh gagal:", refreshError?.message);
        processQueue(refreshError, null);
        await forceSignOut();
        return Promise.reject(refreshError || new Error("Session expired"));
      }

      // Refresh berhasil — retry request dengan token baru
      const newToken = data.session.access_token;
      console.log("[api] Token berhasil di-refresh.");
      processQueue(null, newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshErr) {
      console.error("[api] Refresh error:", refreshErr);
      processQueue(refreshErr, null);
      await forceSignOut();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

// Force sign out — trigger onAuthStateChange → redirect ke LoginScreen
async function forceSignOut() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[api] Force signOut error (non-critical):", err);
  }
}

// Helper untuk extract error message dari FastAPI HTTPException
export const extractApiError = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError<{ detail?: string | object }>;
    const detail = axErr.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail) return JSON.stringify(detail);
    return axErr.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
};