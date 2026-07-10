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
  avatar_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounts_space ON accounts(space_id);
-- 兼容已有部署：老库没有 role 列时补上
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
-- 头像改存 Cloudflare R2：这里只保留对象 key（如 avatars/<accountId>/<uuid>.jpg），
-- 图片字节走 R2 公开域名直连，不再进 Postgres，也不塞进任何 JSON 接口。
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar_key TEXT;
-- 兼容已有部署：老库的 base64 头像列停用（保留列不读，避免破坏旧数据），
-- 迁移后需重新上传一次头像。avatar_data/avatar_mime/avatar_updated_at 不再读写。

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
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);
CREATE INDEX IF NOT EXISTS idx_checkins_space ON check_ins(space_id);
-- 兼容已有部署：老库没有 created_by 列时补上（记录是谁打的卡，用于情侣双人归属显示）
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS created_by TEXT;

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
  image_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rewards_space ON rewards(space_id);
-- 奖励图改存 Cloudflare R2：只保留对象 key，图片走 R2 公开域名直连。
-- 兼容已有部署补列；旧的 image_data/image_mime 停用（保留列不读）。
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS image_key TEXT;

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

CREATE TABLE IF NOT EXISTS adventure_campaigns (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, id),
  UNIQUE (space_id)
);

CREATE TABLE IF NOT EXISTS adventure_stations (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  unlock_at INTEGER NOT NULL CHECK (unlock_at > 0),
  xp_enabled BOOLEAN NOT NULL DEFAULT false,
  xp_amount INTEGER NOT NULL DEFAULT 0 CHECK (xp_amount >= 0),
  badge_enabled BOOLEAN NOT NULL DEFAULT false,
  badge_title TEXT,
  badge_image_key TEXT,
  badge_icon TEXT,
  badge_color TEXT,
  story_enabled BOOLEAN NOT NULL DEFAULT false,
  story_title TEXT,
  story_body TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, id),
  FOREIGN KEY (space_id, campaign_id)
    REFERENCES adventure_campaigns(space_id, id) ON DELETE CASCADE,
  UNIQUE (space_id, campaign_id, sort_order),
  UNIQUE (space_id, campaign_id, unlock_at)
);
CREATE INDEX IF NOT EXISTS idx_adventure_stations_campaign
  ON adventure_stations(space_id, campaign_id, sort_order);

CREATE TABLE IF NOT EXISTS adventure_point_transactions (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  unique_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  habit_id TEXT,
  check_in_id TEXT,
  date_key TEXT NOT NULL,
  account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(space_id, unique_key)
);
CREATE INDEX IF NOT EXISTS idx_adventure_points_space ON adventure_point_transactions(space_id);

CREATE TABLE IF NOT EXISTS adventure_progress (
  space_id TEXT PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  total_points INTEGER NOT NULL,
  current_station_id TEXT NOT NULL,
  next_station_id TEXT,
  segment_points INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adventure_station_rewards (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  station_id TEXT NOT NULL,
  xp_transaction_key TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  UNIQUE(space_id, station_id)
);
CREATE INDEX IF NOT EXISTS idx_adventure_rewards_space ON adventure_station_rewards(space_id);
`;

export async function runSchema(): Promise<void> {
  await pool.query(SCHEMA_SQL);
}
