-- 个推 device tokens + send log
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/migrations/2026-07-21-getui-device-tokens.sql

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'getui',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, provider, token)
);
ALTER TABLE device_push_tokens ADD COLUMN IF NOT EXISTS provider TEXT;
UPDATE device_push_tokens SET provider = 'legacy' WHERE provider IS NULL;
ALTER TABLE device_push_tokens ALTER COLUMN provider SET DEFAULT 'getui';
ALTER TABLE device_push_tokens ALTER COLUMN provider SET NOT NULL;
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
