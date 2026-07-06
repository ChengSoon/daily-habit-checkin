import { pool } from "./pool.js";

/**
 * PostgreSQL 建表脚本。所有业务数据都挂在 space_id 下，实现按空间隔离。
 * 使用 IF NOT EXISTS，可重复执行（幂等）。
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounts_space ON accounts(space_id);
-- 兼容已有部署：老库没有 role 列时补上
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  frequency_json TEXT NOT NULL,
  reminder_time TEXT,
  is_reminder_enabled BOOLEAN NOT NULL,
  is_paused BOOLEAN NOT NULL,
  track_type TEXT NOT NULL,
  numeric_unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_habits_space ON habits(space_id);

CREATE TABLE IF NOT EXISTS check_ins (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  value REAL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);
CREATE INDEX IF NOT EXISTS idx_checkins_space ON check_ins(space_id);

CREATE TABLE IF NOT EXISTS habit_plans (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  duration_days INTEGER NOT NULL,
  goal_text TEXT NOT NULL,
  daily_actions_json TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plans_space ON habit_plans(space_id);

CREATE TABLE IF NOT EXISTS app_settings (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (space_id, key)
);

CREATE TABLE IF NOT EXISTS xp_wallet (
  space_id TEXT PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL,
  lifetime_earned INTEGER NOT NULL,
  lifetime_spent INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  unique_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  habit_id TEXT,
  check_in_id TEXT,
  reward_id TEXT,
  redemption_id TEXT,
  date_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(space_id, unique_key)
);
CREATE INDEX IF NOT EXISTS idx_xptx_space ON xp_transactions(space_id);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  price_xp INTEGER NOT NULL,
  status TEXT NOT NULL,
  virtual_kind TEXT NOT NULL,
  inventory_limit INTEGER,
  image_data TEXT,
  image_mime TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rewards_space ON rewards(space_id);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL REFERENCES rewards(id),
  price_xp INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_redemptions_space ON reward_redemptions(space_id);

CREATE TABLE IF NOT EXISTS admin_settings (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (space_id, key)
);
`;

export async function runSchema(): Promise<void> {
  await pool.query(SCHEMA_SQL);
}
