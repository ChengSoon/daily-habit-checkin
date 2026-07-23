import { Router, type Request, type Response } from "express";
import { getPool } from "../db/pool.js";
import { deleteObjectForScope, isObjectKeyForScope } from "../r2/r2Client.js";
import { requiresOwner } from "./ownerWrite.js";
import {
  fromDbRow,
  READ_ONLY_RESOURCES,
  RESOURCES,
  toDbValue,
  type DataRouterOptions,
  type ResourceConfig
} from "./resourceConfig.js";
export { createWalletRouter } from "./walletRoutes.js";

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

export function createDataRouter(options: DataRouterOptions = {}): Router {
  const router = Router();
  router.get("/:resource", (request, response) => void readResource(request, response));
  router.put("/:resource/:id", (request, response) => void writeResource(request, response, options));
  router.delete("/:resource/:id", (request, response) => void removeResource(request, response, options));
  return router;
}

function routeParam(request: Request, name: string): string {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function resourceConfig(request: Request, response: Response): ResourceConfig | null {
  const config = RESOURCES[routeParam(request, "resource")];
  if (config) return config;
  response.status(404).json({ error: "未知的数据类型" });
  return null;
}

function rejectReadOnly(request: Request, response: Response): boolean {
  if (!READ_ONLY_RESOURCES.has(routeParam(request, "resource"))) return false;
  response.status(405).json({ error: "该资源只能通过服务端业务命令修改" });
  return true;
}

async function readResource(request: Request, response: Response): Promise<void> {
  const config = resourceConfig(request, response);
  if (!config) return;
  const cols = ["id", ...config.columns.map((column) => column.column)].join(", ");
  const { rows } = await getPool().query(
    `SELECT ${cols} FROM ${config.table} WHERE space_id = $1 ORDER BY id ASC`,
    [request.spaceId]
  );
  response.json(rows.map((row) => fromDbRow(config, row as Record<string, unknown>)));
}

function validateImageKey(config: ResourceConfig, body: Record<string, unknown>, spaceId: string): string | null {
  if (!config.imageKeyColumn || !config.imageKind) return null;
  const field = config.columns.find((column) => column.column === config.imageKeyColumn)?.field;
  const key = field ? body[field] : null;
  if (typeof key === "string" && !isObjectKeyForScope(config.imageKind, spaceId, key)) {
    return "图片对象不属于当前空间";
  }
  return null;
}

function buildWriteValues(
  options: {
    config: ResourceConfig;
    id: string;
    spaceId: string;
    accountId: string | undefined;
    body: Record<string, unknown>;
  }
): { columns: string[]; values: unknown[]; error?: string } {
  const { config, id, spaceId, accountId, body } = options;
  const columns = ["id", "space_id", ...config.columns.map((column) => column.column)];
  const values: unknown[] = [id, spaceId];
  for (const column of config.columns) {
    const raw = body[column.field];
    if (column.stampAccount && (raw === undefined || raw === null)) {
      values.push(accountId ?? null);
    } else if (!column.nullable && (raw === undefined || raw === null)) {
      return { columns, values, error: `缺少字段：${column.field}` };
    } else {
      values.push(toDbValue(column.kind, raw));
    }
  }
  return { columns, values };
}

async function ownerWriteDenied(
  config: ResourceConfig,
  request: Request,
  id: string
): Promise<boolean> {
  if (!config.ownerWrite) return false;
  let recordExists = false;
  if (config.ownerWrite === "onUpdate") {
    const existing = await getPool().query(
      `SELECT 1 FROM ${config.table} WHERE id = $1 AND space_id = $2`,
      [id, request.spaceId]
    );
    recordExists = existing.rows.length > 0;
  }
  return requiresOwner(config.ownerWrite, "update", recordExists) && request.role !== "owner";
}

async function previousImageKey(config: ResourceConfig, id: string, spaceId: string): Promise<string | null> {
  if (!config.imageKeyColumn) return null;
  const { rows } = await getPool().query(
    `SELECT ${config.imageKeyColumn} AS image_key FROM ${config.table} WHERE id = $1 AND space_id = $2`,
    [id, spaceId]
  );
  return (rows[0]?.image_key as string | null | undefined) ?? null;
}

async function executeUpsert(
  config: ResourceConfig,
  columns: string[],
  values: unknown[]
): Promise<Record<string, unknown> | null> {
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const updates = config.columns.map((column) => `${column.column} = excluded.${column.column}`).join(", ");
  const { rows } = await getPool().query(
    `INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updates} WHERE ${config.table}.space_id = $2
     RETURNING ${["id", ...config.columns.map((column) => column.column)].join(", ")}`,
    values
  );
  return (rows[0] as Record<string, unknown> | undefined) ?? null;
}

async function writeResource(request: Request, response: Response, options: DataRouterOptions): Promise<void> {
  const config = resourceConfig(request, response);
  if (!config || rejectReadOnly(request, response)) return;
  const id = routeParam(request, "id");
  const body = (request.body ?? {}) as Record<string, unknown>;
  const imageError = validateImageKey(config, body, request.spaceId!);
  if (imageError) {
    response.status(400).json({ error: imageError });
    return;
  }
  const prepared = buildWriteValues({ config, id, spaceId: request.spaceId!, accountId: request.accountId, body });
  if (prepared.error) {
    response.status(400).json({ error: prepared.error });
    return;
  }
  if (await ownerWriteDenied(config, request, id)) {
    response.status(403).json({ error: "仅空间创建者可执行此操作" });
    return;
  }
  const oldImageKey = await previousImageKey(config, id, request.spaceId!);
  const row = await executeUpsert(config, prepared.columns, prepared.values);
  if (!row) {
    response.status(403).json({ error: "无权修改该记录" });
    return;
  }
  await cleanupChangedImage({ config, spaceId: request.spaceId!, oldKey: oldImageKey, row });
  options.onChange?.(request.spaceId!, routeParam(request, "resource"));
  response.json(fromDbRow(config, row));
}

async function cleanupChangedImage(
  options: { config: ResourceConfig; spaceId: string; oldKey: string | null; row: Record<string, unknown> }
): Promise<void> {
  const { config, spaceId, oldKey, row } = options;
  if (!config.imageKeyColumn || !oldKey) return;
  const nextKey = row[config.imageKeyColumn] as string | null;
  if (oldKey !== nextKey) await deleteObjectForScope(config.imageKind!, spaceId, oldKey);
}

async function removeResource(request: Request, response: Response, options: DataRouterOptions): Promise<void> {
  const config = resourceConfig(request, response);
  if (!config || rejectReadOnly(request, response)) return;
  if (requiresOwner(config.ownerWrite, "delete", true) && request.role !== "owner") {
    response.status(403).json({ error: "仅空间创建者可执行此操作" });
    return;
  }

  const id = routeParam(request, "id");
  const removedImageKey = await previousImageKey(config, id, request.spaceId!);
  await getPool().query(`DELETE FROM ${config.table} WHERE id = $1 AND space_id = $2`, [id, request.spaceId]);
  if (removedImageKey) {
    await deleteObjectForScope(config.imageKind!, request.spaceId!, removedImageKey);
  }
  options.onChange?.(request.spaceId!, routeParam(request, "resource"));
  response.status(204).end();
}
