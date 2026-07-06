import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { PoolClient } from "pg";
import { getPool, withTransaction } from "../db/pool.js";
import { walletDelta, WalletTxType } from "./walletMath.js";

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
  /**
   * 为 true 时，若客户端未提供该字段值，则用鉴权中间件解析出的 accountId 兜底写入。
   * 用于 check_ins.created_by 这类「谁操作的」归属列，避免信任客户端自报身份。
   */
  stampAccount?: boolean;
};

type ResourceConfig = {
  table: string;
  columns: Column[];
  /**
   * 写操作的 owner 权限要求：
   * - "always"：所有写（PUT/DELETE）都要求 owner，用于奖励目录管理。
   * - "onUpdate"：仅更新已有记录时要求 owner，新建放行。用于兑换记录：
   *   任何人可创建兑换（花积分兑换），但兑现/取消（改已有记录状态）仅 owner。
   * 不设则任何登录用户都能写（情侣共享的习惯/打卡/计划等）。
   */
  ownerWrite?: "always" | "onUpdate";
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
      // 记录是谁打的卡（情侣双人归属）。客户端不传时用鉴权账号兜底，见 PUT 处理。
      { column: "created_by", field: "createdBy", kind: "text", nullable: true, stampAccount: true },
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
    // 奖励目录的增删改仅 owner；兑换记录见下方 onUpdate 规则
    ownerWrite: "always",
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
    // 新建（member 兑换）任何登录用户可做；更新已有记录（兑现/取消）仅 owner
    ownerWrite: "onUpdate",
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
      // 归属列（如 created_by）以服务端解析出的 accountId 为准，不信任客户端自报。
      // 仅在客户端未提供时兜底盖章，避免更新已有记录时把归属抹掉。
      if (col.stampAccount && (body[col.field] === undefined || body[col.field] === null)) {
        values.push(request.accountId ?? null);
        continue;
      }
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
 *
 * - GET  /api/wallet               读取当前空间钱包
 * - POST /api/wallet/transactions  批量提交 XP 交易，服务端在单事务里
 *   幂等插入 xp_transactions 并原子更新 xp_wallet，返回最新钱包
 *
 * 余额由服务端计算，客户端只上报交易，避免两台设备各算各的导致钱包不一致。
 */
export function createWalletRouter(): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    const pool = getPool();
    await ensureWallet(pool, request.spaceId!);
    response.json(await readWallet(pool, request.spaceId!));
  });

  router.post("/transactions", async (request, response) => {
    const body = request.body as { transactions?: unknown };
    const rawList = Array.isArray(body?.transactions) ? body.transactions : null;
    if (!rawList) {
      response.status(400).json({ error: "缺少 transactions 数组" });
      return;
    }

    let inputs: WalletTransactionInput[];
    try {
      inputs = rawList.map(parseTransactionInput);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "交易格式不正确" });
      return;
    }

    const spaceId = request.spaceId!;
    const result = await withTransaction(async (client) => {
      await ensureWallet(client, spaceId);

      const inserted: Record<string, unknown>[] = [];
      let balanceDelta = 0;
      let earnedDelta = 0;
      let spentDelta = 0;

      for (const input of inputs) {
        const id = randomUUID();
        const insertResult = await client.query(
          `INSERT INTO xp_transactions (
             id, space_id, unique_key, amount, type, reason,
             habit_id, check_in_id, reward_id, redemption_id, date_key, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
           ON CONFLICT (space_id, unique_key) DO NOTHING
           RETURNING id, unique_key AS "uniqueKey", amount, type, reason,
                     habit_id AS "habitId", check_in_id AS "checkInId",
                     reward_id AS "rewardId", redemption_id AS "redemptionId",
                     date_key AS "dateKey", created_at AS "createdAt"`,
          [
            id,
            spaceId,
            input.uniqueKey,
            input.amount,
            input.type,
            input.reason,
            input.habitId,
            input.checkInId,
            input.rewardId,
            input.redemptionId,
            input.dateKey
          ]
        );

        // 已存在（幂等命中）时不重复计入余额
        if (insertResult.rows.length === 0) {
          continue;
        }

        const delta = walletDelta(input.type, input.amount);
        balanceDelta += delta.balance;
        earnedDelta += delta.earned;
        spentDelta += delta.spent;
        inserted.push(insertResult.rows[0] as Record<string, unknown>);
      }

      if (inserted.length > 0) {
        await client.query(
          `UPDATE xp_wallet SET
             balance = balance + $2,
             lifetime_earned = lifetime_earned + $3,
             lifetime_spent = lifetime_spent + $4,
             updated_at = now()
           WHERE space_id = $1`,
          [spaceId, balanceDelta, earnedDelta, spentDelta]
        );
      }

      const wallet = await readWalletWith(client, spaceId);
      return { inserted, wallet };
    });

    response.json(result);
  });

  return router;
}

type WalletTransactionInput = {
  uniqueKey: string;
  amount: number;
  type: WalletTxType;
  reason: string;
  habitId: string | null;
  checkInId: string | null;
  rewardId: string | null;
  redemptionId: string | null;
  dateKey: string | null;
};

const TRANSACTION_TYPES: WalletTxType[] = ["earn", "spend", "refund", "adjust"];

function parseTransactionInput(raw: unknown): WalletTransactionInput {
  const record = (raw ?? {}) as Record<string, unknown>;
  const uniqueKey = record.uniqueKey;
  const amount = record.amount;
  const type = record.type;
  const reason = record.reason;

  if (typeof uniqueKey !== "string" || uniqueKey.length === 0) {
    throw new Error("交易缺少 uniqueKey");
  }
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error("交易 amount 必须是数字");
  }
  if (typeof type !== "string" || !TRANSACTION_TYPES.includes(type as WalletTxType)) {
    throw new Error("交易 type 不合法");
  }
  if (typeof reason !== "string" || reason.length === 0) {
    throw new Error("交易缺少 reason");
  }

  const optionalText = (value: unknown): string | null =>
    typeof value === "string" && value.length > 0 ? value : null;

  return {
    uniqueKey,
    amount: Math.trunc(amount),
    type: type as WalletTxType,
    reason,
    habitId: optionalText(record.habitId),
    checkInId: optionalText(record.checkInId),
    rewardId: optionalText(record.rewardId),
    redemptionId: optionalText(record.redemptionId),
    dateKey: optionalText(record.dateKey)
  };
}

async function readWallet(pool: { query: PoolClient["query"] }, spaceId: string): Promise<unknown> {
  return readWalletWith(pool, spaceId);
}

async function readWalletWith(
  client: { query: PoolClient["query"] },
  spaceId: string
): Promise<Record<string, unknown> | undefined> {
  const { rows } = await client.query(
    `SELECT balance, lifetime_earned AS "lifetimeEarned",
            lifetime_spent AS "lifetimeSpent", updated_at AS "updatedAt"
     FROM xp_wallet WHERE space_id = $1`,
    [spaceId]
  );
  return rows[0] as Record<string, unknown> | undefined;
}

async function ensureWallet(client: { query: PoolClient["query"] }, spaceId: string): Promise<void> {
  await client.query(
    `INSERT INTO xp_wallet (space_id, balance, lifetime_earned, lifetime_spent, updated_at)
     VALUES ($1, 0, 0, 0, now())
     ON CONFLICT (space_id) DO NOTHING`,
    [spaceId]
  );
}
