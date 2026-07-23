import { Router } from "express";
import type { PoolClient } from "pg";
import { getPool } from "../db/pool.js";

export function createWalletRouter(): Router {
  const router = Router();
  router.get("/", async (request, response) => {
    const pool = getPool();
    await ensureWallet(pool, request.spaceId!);
    response.json(await readWallet(pool, request.spaceId!));
  });
  router.post("/transactions", (_request, response) => {
    response.status(405).json({ error: "XP 只能由服务端业务命令变更" });
  });
  return router;
}

async function readWallet(client: { query: PoolClient["query"] }, spaceId: string): Promise<unknown> {
  const { rows } = await client.query(
    `SELECT balance, lifetime_earned AS "lifetimeEarned",
            lifetime_spent AS "lifetimeSpent", updated_at AS "updatedAt"
     FROM xp_wallet WHERE space_id = $1`,
    [spaceId]
  );
  return rows[0];
}

async function ensureWallet(client: { query: PoolClient["query"] }, spaceId: string): Promise<void> {
  await client.query(
    `INSERT INTO xp_wallet (space_id, balance, lifetime_earned, lifetime_spent, updated_at)
     VALUES ($1, 0, 0, 0, now()) ON CONFLICT (space_id) DO NOTHING`,
    [spaceId]
  );
}
