import { Pool } from "pg";

/**
 * 全局 PostgreSQL 连接池。
 * 连接串来自 DATABASE_URL，例如：
 *   postgres://habit:habit@localhost:5432/habit
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // 不直接抛错，允许仅跑 AI 接口的老部署；用到数据库的路由会在获取连接时报错。
  console.warn("DATABASE_URL 未设置，账号与同步相关接口将不可用。");
}

export const pool = new Pool(
  connectionString
    ? { connectionString, max: Number(process.env.PG_POOL_MAX ?? 10) }
    : { max: 1 }
);

/** 返回全局连接池，供直接使用 pg 原生 query 的路由调用。 */
export function getPool(): Pool {
  return pool;
}

/** 便捷查询封装，返回行数组。 */
export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/** 取单行，无结果返回 null。 */
export async function queryOne<T = unknown>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** 在单个事务中执行一组操作。 */
export async function withTransaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
