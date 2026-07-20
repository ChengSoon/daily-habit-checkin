-- FCM device tokens + send log
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/migrations/2026-07-20-fcm-device-tokens.sql

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, token)
);
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_space ON device_push_tokens(space_id);
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_account ON device_push_tokens(account_id);

CREATE TABLE IF NOT EXISTS push_send_log (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, habit_id, date_key, kind)
);
CREATE INDEX IF NOT EXISTS idx_push_send_log_date ON push_send_log(date_key);
