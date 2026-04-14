// ============================================================================
// API Client — axios instance terpusat
// ----------------------------------------------------------------------------
// Sebelumnya tiap screen punya `const API_URL = "..."` + manual header
// Authorization. Sekarang semua API call lewat instance ini dengan
// auto-inject token via Supabase session.
// ============================================================================

import axios, { AxiosError } from "axios";
import { supabase } from "./supabase";

export const API_URL = "https://nirsisa-production.up.railway.app";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

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