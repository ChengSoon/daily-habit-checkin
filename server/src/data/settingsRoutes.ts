import { Router } from "express";
import { getPool } from "../db/pool.js";

/**
 * 键值型设置同步路由。
 *
 * app_settings 与 admin_settings 都是 (space_id, key) 复合主键的键值表，
 * 不适配按 id 的通用 CRUD，因此单独用 scope 区分：
 * - GET  /api/settings/:scope        读取当前空间该 scope 下全部键值
 * - PUT  /api/settings/:scope        批量 upsert 键值（body: { entries: { key: value } }）
 *
 * scope 只允许 app | admin，映射到对应的表。
 */

const SCOPE_TABLES: Record<string, string> = {
  app: "app_settings",
  admin: "admin_settings"
};

export function createSettingsRouter(): Router {
  const router = Router();

  router.get("/:scope", async (request, response) => {
    const table = SCOPE_TABLES[request.params.scope];
    if (!table) {
      response.status(404).json({ error: "未知的设置类型" });
      return;
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT key, value FROM ${table} WHERE space_id = $1`,
      [request.spaceId]
    );

    const entries: Record<string, string> = {};
    for (const row of rows as { key: string; value: string }[]) {
      entries[row.key] = row.value;
    }
    response.json({ entries });
  });

  router.put("/:scope", async (request, response) => {
    const table = SCOPE_TABLES[request.params.scope];
    if (!table) {
      response.status(404).json({ error: "未知的设置类型" });
      return;
    }

    const body = request.body as { entries?: unknown };
    const entries = body?.entries;
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
      response.status(400).json({ error: "缺少 entries 对象" });
      return;
    }

    const pairs = Object.entries(entries as Record<string, unknown>);
    for (const [, value] of pairs) {
      if (typeof value !== "string") {
        response.status(400).json({ error: "设置值必须是字符串" });
        return;
      }
    }

    const pool = getPool();
    for (const [key, value] of pairs) {
      await pool.query(
        `INSERT INTO ${table} (space_id, key, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (space_id, key) DO UPDATE SET value = excluded.value`,
        [request.spaceId, key, value]
      );
    }

    response.status(204).end();
  });

  return router;
}
