import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../db/pool.js";

export type AccountRole = "owner" | "member";

export type Account = {
  id: string;
  email: string;
  displayName: string;
  spaceId: string;
  role: AccountRole;
  createdAt: string;
};

type AccountRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  space_id: string;
  role: AccountRole;
  created_at: string;
};

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    spaceId: row.space_id,
    role: row.role,
    createdAt: row.created_at
  };
}

export async function findAccountByEmail(email: string): Promise<(Account & { passwordHash: string }) | null> {
  const rows = await query<AccountRow>("SELECT * FROM accounts WHERE email = $1", [email.toLowerCase()]);
  const row = rows[0];
  return row ? { ...mapAccount(row), passwordHash: row.password_hash } : null;
}

export async function getAccountById(id: string): Promise<Account | null> {
  const rows = await query<AccountRow>("SELECT * FROM accounts WHERE id = $1", [id]);
  return rows[0] ? mapAccount(rows[0]) : null;
}

/** 生成 8 位大写字母数字邀请码，排除易混字符。 */
function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/**
 * 注册新账号并创建一个新空间，账号自动成为该空间成员。
 * 返回账号信息（含 spaceId）。
 */
export async function registerAccount(input: {
  email: string;
  displayName: string;
  passwordHash: string;
}): Promise<Account> {
  return withTransaction(async (client) => {
    const existing = await client.query("SELECT 1 FROM accounts WHERE email = $1", [input.email.toLowerCase()]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error("该邮箱已注册");
    }

    const spaceId = randomUUID();
    const accountId = randomUUID();
    const now = new Date().toISOString();
    let inviteCode = generateInviteCode();

    // 极小概率邀请码碰撞，重试几次
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await client.query("SELECT 1 FROM spaces WHERE invite_code = $1", [inviteCode]);
      if (!clash.rowCount) {
        break;
      }
      inviteCode = generateInviteCode();
    }

    await client.query(
      "INSERT INTO spaces (id, invite_code, created_at) VALUES ($1, $2, $3)",
      [spaceId, inviteCode, now]
    );
    // 注册即创建空间，注册者是空间的 owner（拥有奖励管理权限）。
    await client.query(
      `INSERT INTO accounts (id, email, display_name, password_hash, space_id, role, created_at)
       VALUES ($1, $2, $3, $4, $5, 'owner', $6)`,
      [accountId, input.email.toLowerCase(), input.displayName, input.passwordHash, spaceId, now]
    );

    return {
      id: accountId,
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      spaceId,
      role: "owner",
      createdAt: now
    };
  });
}

/** 用邀请码把当前账号加入到已有空间，切换其 space_id。 */
export async function joinSpaceByInviteCode(accountId: string, inviteCode: string): Promise<Account> {
  return withTransaction(async (client) => {
    const spaceResult = await client.query<{ id: string }>(
      "SELECT id FROM spaces WHERE invite_code = $1",
      [inviteCode.trim().toUpperCase()]
    );
    const space = spaceResult.rows[0];
    if (!space) {
      throw new Error("邀请码无效");
    }

    // 加入别人的空间即成为该空间的成员（member），不具备奖励管理权限。
    await client.query("UPDATE accounts SET space_id = $1, role = 'member' WHERE id = $2", [space.id, accountId]);

    const accountResult = await client.query<AccountRow>("SELECT * FROM accounts WHERE id = $1", [accountId]);
    const row = accountResult.rows[0];
    if (!row) {
      throw new Error("账号不存在");
    }
    return mapAccount(row);
  });
}

/** 读取空间的邀请码，供分享给另一半。 */
export async function getSpaceInviteCode(spaceId: string): Promise<string | null> {
  const rows = await query<{ invite_code: string }>("SELECT invite_code FROM spaces WHERE id = $1", [spaceId]);
  return rows[0]?.invite_code ?? null;
}
