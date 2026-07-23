import { pool } from "./pool.js";
import { runCompanionSchema } from "../companion/companionSchema.js";

/**
 * PostgreSQL 建表脚本。所有业务数据都挂在 space_id 下，实现按空间隔离。
 * 使用 IF NOT EXISTS，可重复执行（幂等）。
 */
export const SCHEMA_SQL = `
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
  session_version INTEGER NOT NULL DEFAULT 0,
  avatar_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounts_space ON accounts(space_id);
-- 兼容已有部署：老库没有 role 列时补上
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
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

-- 兼容旧版站点闯关：把整套旧表移入 legacy schema，再创建章节解锁模型的新表。
-- SET SCHEMA 会一并隔离旧索引名，避免仅改表名后新版主键索引发生重名冲突。
CREATE SCHEMA IF NOT EXISTS legacy;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'adventure_progress'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'adventure_progress'
      AND column_name = 'highest_unlocked_order'
  ) THEN
    IF to_regclass('legacy.adventure_progress') IS NOT NULL THEN
      RAISE EXCEPTION 'legacy adventure backup already exists; manual migration required';
    END IF;
    IF to_regclass('public.adventure_point_transactions') IS NOT NULL THEN
      ALTER TABLE adventure_point_transactions SET SCHEMA legacy;
    END IF;
    IF to_regclass('public.adventure_station_rewards') IS NOT NULL THEN
      ALTER TABLE adventure_station_rewards SET SCHEMA legacy;
    END IF;
    IF to_regclass('public.adventure_stations') IS NOT NULL THEN
      ALTER TABLE adventure_stations SET SCHEMA legacy;
    END IF;
    IF to_regclass('public.adventure_campaigns') IS NOT NULL THEN
      ALTER TABLE adventure_campaigns SET SCHEMA legacy;
    END IF;
    IF to_regclass('public.adventure_claims') IS NOT NULL THEN
      ALTER TABLE adventure_claims SET SCHEMA legacy;
    END IF;
    IF to_regclass('public.adventure_chapters') IS NOT NULL THEN
      ALTER TABLE adventure_chapters SET SCHEMA legacy;
    END IF;
    ALTER TABLE adventure_progress SET SCHEMA legacy;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS adventure_chapters (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  story_text TEXT NOT NULL,
  threshold_lifetime_xp INTEGER NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_emoji TEXT,
  badge_image_key TEXT,
  node_image_key TEXT,
  background_image_key TEXT,
  reward_type TEXT NOT NULL DEFAULT 'badge_story',
  map_theme_key TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(space_id, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_adventure_chapters_space ON adventure_chapters(space_id);

CREATE TABLE IF NOT EXISTS adventure_progress (
  space_id TEXT PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
  highest_unlocked_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adventure_claims (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES adventure_chapters(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_by TEXT,
  fulfillment_status TEXT NOT NULL DEFAULT 'none',
  fulfilled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  note TEXT,
  UNIQUE(space_id, chapter_id)
);
CREATE INDEX IF NOT EXISTS idx_adventure_claims_space ON adventure_claims(space_id);

-- 阶段 2 兼容已有库：补徽章图/节点图与现实惊喜兑现字段
ALTER TABLE adventure_chapters ADD COLUMN IF NOT EXISTS badge_image_key TEXT;
ALTER TABLE adventure_chapters ADD COLUMN IF NOT EXISTS node_image_key TEXT;
ALTER TABLE adventure_chapters ADD COLUMN IF NOT EXISTS background_image_key TEXT;
ALTER TABLE adventure_claims ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE adventure_claims ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;
ALTER TABLE adventure_claims ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE adventure_claims ADD COLUMN IF NOT EXISTS note TEXT;

`;

export async function runSchema(): Promise<void> {
  await pool.query(SCHEMA_SQL);
  await runCompanionSchema();
}
