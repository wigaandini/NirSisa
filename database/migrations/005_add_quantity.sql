-- ============================================================
-- NirSisa Migration 005 — Add quantity column (v4 dataset)
-- ============================================================

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS quantity TEXT DEFAULT '';
