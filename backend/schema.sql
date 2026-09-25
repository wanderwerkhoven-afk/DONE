-- ============================================================================
-- DONE. PUSH BACKEND — D1 SCHEMA
-- Stores only delivery/subscription metadata; never task titles or task content.
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  client_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  reminder_time TEXT NOT NULL DEFAULT '17:00',
  has_open_tasks INTEGER NOT NULL DEFAULT 0 CHECK (has_open_tasks IN (0,1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  last_sent_local_date TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_due
ON push_subscriptions(enabled, has_open_tasks, reminder_time);

CREATE INDEX IF NOT EXISTS idx_push_updated
ON push_subscriptions(updated_at);


-- ============================================================================
-- TEMPORARY STATE TRANSFERS
-- Short-lived handoff used when reinstalling the PWA with another app icon.
-- Payloads expire automatically after 15 minutes and are deleted after a
-- successful restore acknowledgement.
-- ============================================================================
CREATE TABLE IF NOT EXISTS state_transfers (
  token TEXT PRIMARY KEY,
  icon_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_state_transfers_expires
ON state_transfers(expires_at);
