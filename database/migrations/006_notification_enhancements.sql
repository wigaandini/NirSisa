-- ============================================================
-- NirSisa Migration 006 — Notification enhancements
-- ============================================================
-- Adds is_read flag for notification history UI

ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_notification_is_read ON notification_log(user_id, is_read);
