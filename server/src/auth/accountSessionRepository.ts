import { query } from "../db/pool.js";

/** 读取账号的密码哈希，供改密码时校验旧密码。账号不存在返回 null。 */
export async function getPasswordHashById(accountId: string): Promise<string | null> {
  const rows = await query<{ password_hash: string }>(
    "SELECT password_hash FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.password_hash ?? null;
}

/** 更新密码并吊销旧会话，返回签发当前设备新 token 所需的版本。 */
export async function updatePasswordHash(accountId: string, passwordHash: string): Promise<number> {
  const rows = await query<{ session_version: number }>(
    `UPDATE accounts SET password_hash = $2, session_version = session_version + 1
     WHERE id = $1 RETURNING session_version`,
    [accountId, passwordHash]
  );
  if (!rows[0]) throw new Error("账号不存在");
  return rows[0].session_version;
}

export async function revokeAccountSessions(accountId: string): Promise<void> {
  await query("UPDATE accounts SET session_version = session_version + 1 WHERE id = $1", [accountId]);
}
