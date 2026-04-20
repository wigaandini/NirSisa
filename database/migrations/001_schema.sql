-- ============================================================
-- NirSisa Database Schema
-- PostgreSQL (Supabase) - Migration 001
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. RECIPE KNOWLEDGE BASE
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_categories (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL  -- ayam, ikan, kambing, sapi, tahu, telur, tempe, udang
);

CREATE TABLE IF NOT EXISTS recipes (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    title_cleaned       VARCHAR(255) NOT NULL,
    ingredients         TEXT NOT NULL,          -- original raw ingredients
    ingredients_cleaned TEXT NOT NULL,          -- cleaned/tokenized for TF-IDF
    steps               TEXT NOT NULL,
    total_ingredients   SMALLINT NOT NULL,
    total_steps         SMALLINT NOT NULL,
    loves               INTEGER NOT NULL DEFAULT 0,
    url                 TEXT,
    category_id         INTEGER NOT NULL REFERENCES recipe_categories(id),
    quantity            TEXT DEFAULT '',        -- v4: takaran per-bahan (comma-separated)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category_id);
CREATE INDEX IF NOT EXISTS idx_recipes_title_cleaned ON recipes(title_cleaned);
CREATE INDEX IF NOT EXISTS idx_recipes_loves ON recipes(loves DESC);

-- ============================================================
-- 3. TF-IDF CACHE (pre-computed vectors)
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_tfidf_cache (
    id                  SERIAL PRIMARY KEY,
    version             VARCHAR(20) UNIQUE NOT NULL,  -- e.g. 'v4.0'
    vectorizer_blob     BYTEA NOT NULL,               -- joblib serialized TfidfVectorizer
    tfidf_matrix_blob   BYTEA NOT NULL,               -- joblib serialized sparse matrix
    recipe_id_order     JSONB NOT NULL,                -- ordered recipe IDs matching matrix rows
    fitted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. SHELF-LIFE REFERENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredient_categories (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS shelf_life_reference (
    id                 SERIAL PRIMARY KEY,
    ingredient_name    VARCHAR(150) NOT NULL,
    category_id        INTEGER NOT NULL REFERENCES ingredient_categories(id),
    shelf_life_days    INTEGER NOT NULL,
    storage_condition  VARCHAR(50) NOT NULL DEFAULT 'kulkas',
    source             VARCHAR(255),
    UNIQUE(ingredient_name, storage_condition)
);

CREATE INDEX IF NOT EXISTS idx_shelf_life_ingredient ON shelf_life_reference(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_shelf_life_category ON shelf_life_reference(category_id);

-- ============================================================
-- 5. USER INVENTORY (Digital Kulkas)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_stock (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_name               VARCHAR(150) NOT NULL,
    item_name_normalized    VARCHAR(150),
    category_id             INTEGER REFERENCES ingredient_categories(id),
    quantity                DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit                    VARCHAR(30) DEFAULT 'buah',
    expiry_date             DATE,
    is_natural              BOOLEAN NOT NULL DEFAULT FALSE,
    added_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory_stock(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory_stock(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_user_item ON inventory_stock(user_id, item_name_normalized);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_updated_at
    BEFORE UPDATE ON inventory_stock
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. CONSUMPTION HISTORY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS consumption_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipe_id     INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
    recipe_title  VARCHAR(255),
    cooked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumption_user ON consumption_history(user_id);
CREATE INDEX IF NOT EXISTS idx_consumption_date ON consumption_history(cooked_at);

CREATE TABLE IF NOT EXISTS consumption_history_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumption_id      UUID NOT NULL REFERENCES consumption_history(id) ON DELETE CASCADE,
    inventory_stock_id  UUID REFERENCES inventory_stock(id) ON DELETE SET NULL,
    item_name           VARCHAR(150) NOT NULL,
    quantity_used       DECIMAL(10,2) NOT NULL,
    unit                VARCHAR(30)
);

CREATE INDEX IF NOT EXISTS idx_consumption_items_consumption ON consumption_history_items(consumption_id);

-- ============================================================
-- 7. DEVICE TOKENS (FCM Push Notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS device_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    fcm_token   TEXT UNIQUE NOT NULL,
    device_info VARCHAR(255),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

CREATE TRIGGER trg_device_tokens_updated_at
    BEFORE UPDATE ON device_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 8. NOTIFICATION LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    inventory_stock_id  UUID REFERENCES inventory_stock(id) ON DELETE SET NULL,
    notification_type   VARCHAR(50) NOT NULL,
    title               VARCHAR(255),
    body                TEXT,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered           BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_notification_user ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_sent ON notification_log(sent_at);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW inventory_with_spi AS
SELECT
    inv.*,
    CASE
        WHEN inv.expiry_date IS NOT NULL
        THEN (inv.expiry_date - CURRENT_DATE)
        ELSE NULL
    END AS days_remaining,
    CASE
        WHEN inv.expiry_date IS NOT NULL
        THEN ROUND(1.0 / POWER(GREATEST((inv.expiry_date - CURRENT_DATE), 0) + 1, 2.0)::NUMERIC, 4)
        ELSE 0
    END AS spi_score,
    CASE
        WHEN inv.expiry_date IS NULL THEN 'unknown'
        WHEN (inv.expiry_date - CURRENT_DATE) <= 0 THEN 'expired'
        WHEN (inv.expiry_date - CURRENT_DATE) <= 2 THEN 'critical'
        WHEN (inv.expiry_date - CURRENT_DATE) <= 5 THEN 'warning'
        ELSE 'fresh'
    END AS freshness_status,
    ic.name AS category_name
FROM inventory_stock inv
LEFT JOIN ingredient_categories ic ON inv.category_id = ic.id
WHERE inv.quantity > 0;
