// ============================================================================
// API Types — TypeScript mirror dari Pydantic schema backend
// ----------------------------------------------------------------------------
// Ubah file ini KALAU schema backend berubah, supaya client compile-time safe.
// Source of truth: backend/app/schemas/recipe.py & inventory.py
// ============================================================================

import axios from "axios";

// ─── Recommendation (dari /recommend) ─────────────────────────────────────────
export const api = axios.create({
  // Dia akan otomatis mengambil URL Railway saat dideploy
  baseURL: process.env.EXPO_PUBLIC_API_URL, 
});

export const extractApiError = (err: any) => {
  return err.response?.data?.detail || err.message || "Unknown Error";
};
  
export interface RecommendationItem {
  index: number;                  // row index di pickle, BUKAN DB primary key
  title: string;
  ingredients: string;            // raw text, perlu diparse di client
  ingredients_cleaned: string;    // tokenized untuk matching
  steps: string;                  // raw text, perlu diparse di client
  loves: number;
  url: string | null;
  category: string | null;
  total_ingredients: number;
  total_steps: number;
  quantity: string | null;        // v4: takaran per-bahan (comma-separated)
  cosine_score: number;           // 0..1 — kecocokan TF-IDF
  spi_score: number;              // 0..1 — urgensi (normalized)
  final_score: number;            // (1-λ)*cosine + λ*SPI
  match_percentage: number;       // 0..100 — % bahan user yg cocok
  explanation: string | null;     // teks XAI
  id: number; // Tambahkan baris ini (gunakan number karena ID di DB Anda adalah integer/bigint)

}

export interface RecommendationResponse {
  total_results: number;
  latency_ms: number;
  spi_weight: number;
  recommendations: RecommendationItem[];
}

// ─── Inventory (dari /inventory) ──────────────────────────────────────────────

export type FreshnessStatus =
  | "fresh"
  | "warning"
  | "critical"
  | "expired"
  | "unknown";

export interface InventoryItemResponse {
  id: string;
  item_name: string;
  item_name_normalized: string | null;
  category_id: number | null;
  category_name: string | null;
  quantity: number;
  unit: string | null;
  expiry_date: string | null;     // ISO date "YYYY-MM-DD"
  is_natural: boolean;
  days_remaining: number | null;
  spi_score: number | null;
  freshness_status: FreshnessStatus | null;
  added_at: string | null;
  updated_at: string | null;
}

// ─── Reconciliation (POST /inventory/reconcile) ──────────────────────────────

export interface IngredientUsage {
  item_id: string;                // UUID inventory_stock
  quantity_used: number;
}

export interface ReconciliationRequest {
  recipe_id?: number | null;      // optional, recommender index TIDAK dipakai
  recipe_title: string;
  ingredients_used: IngredientUsage[];
}

export interface ReconciliationItemUpdated {
  item_name: string;
  previous_qty: number;
  new_qty: number;
  unit: string | null;
}

export interface ReconciliationResponse {
  status: string;
  recipe_title: string;
  items_updated: ReconciliationItemUpdated[];
  items_removed: string[];
  skipped_items: string[];
}
