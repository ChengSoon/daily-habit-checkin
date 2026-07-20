import { randomUUID } from "node:crypto";
import { query, queryOne } from "../db/pool.js";

export type DevicePushToken = {
  id: string;
  accountId: string;
  spaceId: string;
  token: string;
  platform: string;
  updatedAt: string;
};

type TokenRow = {
  id: string;
  account_id: string;
  space_id: string;
  token: string;
  platform: string;
  updated_at: Date | string;
};

function mapRow(row: TokenRow): DevicePushToken {
  return {
    id: row.id,
    accountId: row.account_id,
    spaceId: row.space_id,
    token: row.token,
    platform: row.platform,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : row.updated_at.toISOString()
  };
}

export async function upsertDevicePushToken(input: {
  accountId: string;
  spaceId: string;
  token: string;
  platform: string;
}): Promise<DevicePushToken> {
  const existing = await queryOne<TokenRow>(
    `SELECT id, account_id, space_id, token, platform, updated_at
     FROM device_push_tokens
     WHERE account_id = $1 AND token = $2`,
    [input.accountId, input.token]
  );

  if (existing) {
    const row = await queryOne<TokenRow>(
      `UPDATE device_push_tokens
       SET space_id = $1, platform = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, account_id, space_id, token, platform, updated_at`,
      [input.spaceId, input.platform, existing.id]
    );
    return mapRow(row!);
  }

  const id = `dpt_${randomUUID().replaceAll("-", "")}`;
  const row = await queryOne<TokenRow>(
    `INSERT INTO device_push_tokens (id, account_id, space_id, token, platform)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, account_id, space_id, token, platform, updated_at`,
    [id, input.accountId, input.spaceId, input.token, input.platform]
  );
  return mapRow(row!);
}

export async function listTokensForAccount(accountId: string): Promise<DevicePushToken[]> {
  const rows = await query<TokenRow>(
    `SELECT id, account_id, space_id, token, platform, updated_at
     FROM device_push_tokens
     WHERE account_id = $1
     ORDER BY updated_at DESC`,
    [accountId]
  );
  return rows.map(mapRow);
}

export async function listTokensForSpace(spaceId: string): Promise<DevicePushToken[]> {
  const rows = await query<TokenRow>(
    `SELECT id, account_id, space_id, token, platform, updated_at
     FROM device_push_tokens
     WHERE space_id = $1
     ORDER BY updated_at DESC`,
    [spaceId]
  );
  return rows.map(mapRow);
}

export async function deleteTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) {
    return;
  }
  await query(`DELETE FROM device_push_tokens WHERE token = ANY($1::text[])`, [tokens]);
}

export async function deleteTokenForAccount(accountId: string, token: string): Promise<void> {
  await query(`DELETE FROM device_push_tokens WHERE account_id = $1 AND token = $2`, [accountId, token]);
}
