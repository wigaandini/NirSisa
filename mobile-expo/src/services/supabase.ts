// 1. WAJIB: Polyfill untuk Android Standalone (APK)
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

// 2. Hardcode Nilai (Agar tidak lagi Undefined saat Build APK)
const SUPABASE_URL = "https://vmogtjfaluwphxjjkptj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtb2d0amZhbHV3cGh4amprcHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTExMjUsImV4cCI6MjA4OTU4NzEyNX0.D4hATobFPN61pcDAX-zkM1394HCZdp_qz0vPUL59Pys";

// 3. Inisialisasi Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Log untuk memastikan di terminal (saat development)
console.log("Supabase Client Initialized with URL:", SUPABASE_URL);