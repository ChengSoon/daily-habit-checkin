-- 闯关章节解锁（世界地图里程碑）迁移
-- 日期：2026-07-12
-- 说明：
-- 1) 删除旧版 adventure（campaign/station/point 体系）
-- 2) 建立新版 adventure_chapters / adventure_progress / adventure_claims
-- 3) 可在正式环境维护窗口执行；执行前请备份数据库
--
-- 用法示例：
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/migrations/2026-07-12-adventure-chapter-unlock.sql
-- 或 Docker：
--   docker exec -i <db-container> psql -U habit -d habit -v ON_ERROR_STOP=1 < server/migrations/2026-07-12-adventure-chapter-unlock.sql
--
-- 注意：
-- - 旧闯关进度与站点配置不可自动迁移到新模型，会一并清除
-- - 应用重启后，GET /api/adventure/state 会对各 space 懒播种默认 6 章

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 删除旧版 adventure 相关表（顺序：先子表后父表）
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS adventure_point_transactions CASCADE;
DROP TABLE IF EXISTS adventure_station_rewards CASCADE;
DROP TABLE IF EXISTS adventure_stations CASCADE;
DROP TABLE IF EXISTS adventure_campaigns CASCADE;

-- 旧 progress 与新 progress 同名不同结构，必须重建
DROP TABLE IF EXISTS adventure_progress CASCADE;

-- 若半迁移状态残留 claims（依赖 chapters），先清 claims 再清 chapters 后重建
DROP TABLE IF EXISTS adventure_claims CASCADE;
DROP TABLE IF EXISTS adventure_chapters CASCADE;

-- ---------------------------------------------------------------------------
-- 2. 新版表结构（与 server/src/db/schema.ts 保持一致）
-- ---------------------------------------------------------------------------
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
  UNIQUE(space_id, chapter_id)
);
CREATE INDEX IF NOT EXISTS idx_adventure_claims_space ON adventure_claims(space_id);

COMMIT;

-- 可选校验：
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'adventure%';
-- \d adventure_progress
