-- 岛屿自定义背景（每章可上传静态/动态背景）
-- 日期：2026-07-13

ALTER TABLE adventure_chapters ADD COLUMN IF NOT EXISTS background_image_key TEXT;
