import { Router } from "express";
import type { PoolClient } from "pg";
import { getPool } from "../db/pool.js";

/**
 * 同步数据路由。
 *
 * 采用「全量拉取 + 单条 upsert + 删除」的简单同步模型，匹配「云端直连、在线才能用」：
 * - GET  /api/data/:resource        列出当前空间的全部记录
 * - PUT  /api/data/:resource/:id    upsert 一条记录（body 为该资源的完整字段）
 * - DELETE /api/data/:resource/:id  删除一条记录
 *
 * 所有操作都强制带上鉴权中间件解析出的 space_id，实现按空间隔离。
 */

type ColumnKind = "text" | "int" | "real" | "bool" | "json";

type Column = {
  /** 数据库列名（snake_case） */
  column: string;
  /** 客户端字段名（camelCase） */
  field: string;
  kind: ColumnKind;
  nullable?: boolean;
};

type ResourceConfig = {
  table: string;
  columns: Column[];
};

/**
 * 每种资源的字段映射。id 与 space_id 由框架统一处理，这里只列业务列。
 */
const RESOURCES: Record<string, ResourceConfig> = {
  habits: {
    table: "habits",
    columns: [
      { column: "name", field: "name", kind: "text" },
      { column: "description", field: "description", kind: "text", nullable: true },
      { column: "frequency_json", field: "frequencyJson", kind: "text" },
      { column: "reminder_time", field: "reminderTime", kind: "text", nullable: true },
      { column: "is_reminder_enabled", field: "isReminderEnabled", kind: "bool" },
      { column: "is_paused", field: "isPaused", kind: "bool" },
      { column: "track_type", field: "trackType", kind: "text" },
      { column: "numeric_unit", field: "numericUnit", kind: "text", nullable: true },
      { column: "sort_order", field: "sortOrder", kind: "int" },
      { column: "created_at", field: "createdAt", kind: "text" }
    ]
  },
  check_ins: {
    table: "check_ins",
    columns: [
      { column: "habit_id", field: "habitId", kind: "text" },
      { column: "date", field: "date", kind: "text" },
      { column: "status", field: "status", kind: "text" },
      { column: "value", field: "value", kind: "real", nullable: true },
      { column: "note", field: "note", kind: "text", nullable: true },
      { column: "created_at", field: "createdAt", kind: "text" }
    ]
  },
  habit_plans: {
    table: "habit_plans",
    columns: [
      { column: "habit_id", field: "habitId", kind: "text" },
      { column: "duration_days", field: "durationDays", kind: "int" },
      { column: "goal_text", field: "goalText", kind: "text" },
      { column: "daily_actions_json", field: "dailyActionsJson", kind: "text" },
      { column: "start_date", field: "startDate", kind: "text" },
      { column: "end_date", field: "endDate", kind: "text" },
      { column: "current_stage", field: "currentStage", kind: "text" },
      { column: "created_by", field: "createdBy", kind: "text" }
    ]
  },
  rewards: {
    table: "rewards",
    columns: [
      { column: "title", field: "title", kind: "text" },
      { column: "description", field: "description", kind: "text", nullable: true },
      { column: "type", field: "type", kind: "text" },
      { column: "price_xp", field: "priceXp", kind: "int" },
      { column: "status", field: "status", kind: "text" },
      { column: "virtual_kind", field: "virtualKind", kind: "text" },
      { column: "inventory_limit", field: "inventoryLimit", kind: "int", nullable: true },
      { column: "image_data", field: "imageData", kind: "text", nullable: true },
      { column: "image_mime", field: "imageMime", kind: "text", nullable: true },
      { column: "created_at", field: "createdAt", kind: "text" },
      { column: "updated_at", field: "updatedAt", kind: "text" }
    ]
  },
  reward_redemptions: {
    table: "reward_redemptions",
    columns: [
      { column: "reward_id", field: "rewardId", kind: "text" },
      { column: "price_xp", field: "priceXp", kind: "int" },
      { column: "status", field: "status", kind: "text" },
      { column: "created_at", field: "createdAt", kind: "text" },
      { column: "fulfilled_at", field: "fulfilledAt", kind: "text", nullable: true },
      { column: "cancelled_at", field: "cancelledAt", kind: "text", nullable: true },
      { column: "note", field: "note", kind: "text", nullable: true }
    ]
  },
  xp_transactions: {
    table: "xp_transactions",
    columns: [
      { column: "unique_key", field: "uniqueKey", kind: "text" },
      { column: "amount", field: "amount", kind: "int" },
      { column: "type", field: "type", kind: "text" },
      { column: "reason", field: "reason", kind: "text" },
      { column: "habit_id", field: "habitId", kind: "text", nullable: true },
      { column: "check_in_id", field: "checkInId", kind: "text", nullable: true },
      { column: "reward_id", field: "rewardId", kind: "text", nullable: true },
      { column: "redemption_id", field: "redemptionId", kind: "text", nullable: true },
      { column: "date_key", field: "dateKey", kind: "text", nullable: true },
      { column: "created_at", field: "createdAt", kind: "text" }
    ]
  }
};

function toDbValue(kind: ColumnKind, raw: unknown): unknown {
  if (raw === null || raw === undefined) {
    return null;
  }
  switch (kind) {
    case "bool":
      return raw === true || raw === 1 || raw === "true" ? true : false;
    case "int":
      return Math.trunc(Number(raw));
    case "real":
      return Number(raw);
    case "json":
      return typeof raw === "string" ? raw : JSON.stringify(raw);
    default:
      return String(raw);
  }
}

function fromDbRow(config: ResourceConfig, row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { id: row.id };
  for (const col of config.columns) {
    const value = row[col.column];
    result[col.field] = value === undefined ? null : value;
  }
  return result;
}

export function createDataRouter(): Router {
  const router = Router();

  router.get("/:resource", async (request, response) => {
    const config = RESOURCES[request.params.resource];
    if (!config) {
      response.status(404).json({ error: "未知的数据类型" });
      return;
    }

    const pool = getPool();
    const cols = ["id", ...config.columns.map((c) => c.column)].join(", ");
    const { rows } = await pool.query(
      `SELECT ${cols} FROM ${config.table} WHERE space_id = $1 ORDER BY id ASC`,
      [request.spaceId]
    );
    response.json(rows.map((row) => fromDbRow(config, row as Record<string, unknown>)));
  });

  router.put("/:resource/:id", async (request, response) => {
    const config = RESOURCES[request.params.resource];
    if (!config) {
      response.status(404).json({ error: "未知的数据类型" });
      return;
    }

    const id = request.params.id;
    const body = (request.body ?? {}) as Record<string, unknown>;

    const columns = ["id", "space_id", ...config.columns.map((c) => c.column)];
    const values: unknown[] = [id, request.spaceId];
    for (const col of config.columns) {
      if (!col.nullable && (body[col.field] === undefined || body[col.field] === null)) {
        response.status(400).json({ error: `缺少字段：${col.field}` });
        return;
      }
      values.push(toDbValue(col.kind, body[col.field]));
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    // 冲突时按 (space_id, id) 更新，且只更新属于本空间的记录，防止越权覆盖。
    const updates = config.columns.map((c) => `${c.column} = excluded.${c.column}`).join(", ");

    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO ${config.table} (${columns.join(", ")})
       VALUES (${placeholders})
       ON CONFLICT (id) DO UPDATE SET ${updates}
       WHERE ${config.table}.space_id = $2
       RETURNING ${["id", ...config.columns.map((c) => c.column)].join(", ")}`,
      values
    );

    if (rows.length === 0) {
      response.status(403).json({ error: "无权修改该记录" });
      return;
    }
    response.json(fromDbRow(config, rows[0] as Record<string, unknown>));
  });

  router.delete("/:resource/:id", async (request, response) => {
    const config = RESOURCES[request.params.resource];
    if (!config) {
      response.status(404).json({ error: "未知的数据类型" });
      return;
    }

    const pool = getPool();
    await pool.query(`DELETE FROM ${config.table} WHERE id = $1 AND space_id = $2`, [
      request.params.id,
      request.spaceId
    ]);
    response.status(204).end();
  });

  return router;
}

/**
 * XP 钱包是每个空间一条的单例记录，单独处理。
 */
export function createWalletRouter(): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    const pool = getPool();
    await ensureWallet(pool, request.spaceId!);
    const { rows } = await pool.query(
      `SELECT balance, lifetime_earned AS "lifetimeEarned",
              lifetime_spent AS "lifetimeSpent", updated_at AS "updatedAt"
       FROM xp_wallet WHERE space_id = $1`,
      [request.spaceId]
    );
    response.json(rows[0]);
  });

  return router;
}

async function ensureWallet(pool: { query: PoolClient["query"] }, spaceId: string): Promise<void> {
  await pool.query(
    `INSERT INTO xp_wallet (space_id, balance, lifetime_earned, lifetime_spent, updated_at)
     VALUES ($1, 0, 0, 0, now())
     ON CONFLICT (space_id) DO NOTHING`,
    [spaceId]
  );
}
