import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const SUPABASE_URL = "https://vmogtjfaluwphxjjkptj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtb2d0amZhbHV3cGh4amprcHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTExMjUsImV4cCI6MjA4OTU4NzEyNX0.D4hATobFPN61pcDAX-zkM1394HCZdp_qz0vPUL59Pys";

// Android SecureStore has a 2048-byte limit per key, which Supabase session tokens
// easily exceed. Split large values into chunks to work around this.
const CHUNK_SIZE = 1800;

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const header = await SecureStore.getItemAsync(key);
    if (!header) return null;
    if (!header.startsWith("CHUNKS:")) return header;

    const count = parseInt(header.slice(7), 10);
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}_chunk_${i}`)
      )
    );
    if (parts.some((p) => p === null)) return null;
    return (parts as string[]).join("");
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((chunk, i) =>
        SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk)
      )
    );
    await SecureStore.setItemAsync(key, `CHUNKS:${chunks.length}`);
  },

  removeItem: async (key: string): Promise<void> => {
    const header = await SecureStore.getItemAsync(key);
    if (header?.startsWith("CHUNKS:")) {
      const count = parseInt(header.slice(7), 10);
      await Promise.all(
        Array.from({ length: count }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}_chunk_${i}`)
        )
      );
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
