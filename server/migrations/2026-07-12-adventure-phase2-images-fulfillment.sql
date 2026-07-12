-- 闯关阶段 2：徽章/节点图 + 现实惊喜兑现字段
-- 可重复执行（IF NOT EXISTS / ADD COLUMN IF NOT EXISTS）

BEGIN;

ALTER TABLE adventure_chapters ADD COLUMN IF NOT EXISTS badge_image_key TEXT;
ALTER TABLE adventure_chapters ADD COLUMN IF NOT EXISTS node_image_key TEXT;

ALTER TABLE adventure_claims ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE adventure_claims ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;
ALTER TABLE adventure_claims ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE adventure_claims ADD COLUMN IF NOT EXISTS note TEXT;

COMMIT;
