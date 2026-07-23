import { randomInt, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { ensureAdventureForSpace } from "../adventure/adventureService.js";
import { query, withTransaction } from "../db/pool.js";
export { deleteAccount, updateAvatarKey } from "./accountAssetRepository.js";
export { getPasswordHashById, revokeAccountSessions, updatePasswordHash } from "./accountSessionRepository.js";
export type AccountRole = "owner" | "member";

export type Account = {
  id: string;
  email: string;
  displayName: string;
  spaceId: string;
  role: AccountRole;
  createdAt: string;
  /**
   * 头像的 R2 对象 key（如 avatars/<accountId>/<uuid>.jpg）；未设置为 null。
   * 客户端用 publicUrl(key) 拼成 R2 公开域名 URL 直连显示，图片字节不进 Postgres、
   * 也不随任何 JSON 接口下发——这正是原先 base64 拖慢接口的根因所在。
   */
  avatarKey: string | null;
  sessionVersion: number;
};

type AccountRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  space_id: string;
  role: AccountRole;
  avatar_key: string | null;
  session_version: number;
  created_at: string;
};

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    spaceId: row.space_id,
    role: row.role,
    avatarKey: row.avatar_key,
    sessionVersion: row.session_version,
    createdAt: row.created_at
  };
}

/**
 * 账号信息查询的列清单。只取轻量列，头像仅存 key（不再有 base64 大字段），
 * 因此可以随常规账号读取一起带出，不必再单独拆一个取图查询。
 */
const ACCOUNT_COLUMNS =
  "id, email, display_name, password_hash, space_id, role, avatar_key, session_version, created_at";

export async function findAccountByEmail(email: string): Promise<(Account & { passwordHash: string }) | null> {
  const rows = await query<AccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE email = $1`,
    [email.toLowerCase()]
  );
  return rows[0] ? { ...mapAccount(rows[0]), passwordHash: rows[0].password_hash } : null;
}

export async function getAccountById(id: string): Promise<Account | null> {
  const rows = await query<AccountRow>(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = $1`, [id]);
  return rows[0] ? mapAccount(rows[0]) : null;
}

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += alphabet[randomInt(alphabet.length)];
  }
  return code;
}

async function generateUniqueInviteCode(client: Pick<PoolClient, "query">): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inviteCode = generateInviteCode();
    const clash = await client.query("SELECT 1 FROM spaces WHERE invite_code = $1", [inviteCode]);
    if (!clash.rowCount) return inviteCode;
  }
  throw new Error("邀请码生成失败，请稍后重试");
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
    const inviteCode = await generateUniqueInviteCode(client);

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
    await ensureAdventureForSpace(spaceId, client);

    return {
      id: accountId,
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      spaceId,
      role: "owner",
      createdAt: now,
      // 新账号还没上传头像
      avatarKey: null,
      sessionVersion: 0
    };
  });
}

async function loadJoinCandidate(client: PoolClient, accountId: string, inviteCode: string) {
  const target = await client.query<{ id: string }>(
    "SELECT id FROM spaces WHERE invite_code = $1",
    [inviteCode]
  );
  if (!target.rows[0]) throw new Error("邀请码无效");
  const current = await client.query<AccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = $1 FOR UPDATE`,
    [accountId]
  );
  if (!current.rows[0]) throw new Error("账号不存在");
  if (current.rows[0].space_id === target.rows[0].id) {
    throw new Error("你已在这个空间，无需重复加入");
  }
  return { current: current.rows[0], targetSpaceId: target.rows[0].id };
}

async function lockAndRevalidateInvite(
  client: PoolClient,
  options: { currentSpaceId: string; targetSpaceId: string; inviteCode: string }
): Promise<void> {
  const { currentSpaceId, targetSpaceId, inviteCode } = options;
  for (const spaceId of [currentSpaceId, targetSpaceId].sort()) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [spaceId]);
  }
  const currentInvite = await client.query(
    "SELECT 1 FROM spaces WHERE id = $1 AND invite_code = $2",
    [targetSpaceId, inviteCode]
  );
  if (!currentInvite.rowCount) throw new Error("邀请码已失效，请获取新邀请码");
}

async function assertJoinCapacity(
  client: PoolClient,
  currentSpaceId: string,
  targetSpaceId: string
): Promise<void> {
  const [target, current] = await Promise.all([
    client.query<{ count: string }>("SELECT COUNT(*) FROM accounts WHERE space_id = $1", [targetSpaceId]),
    client.query<{ count: string }>("SELECT COUNT(*) FROM accounts WHERE space_id = $1", [currentSpaceId])
  ]);
  if (Number(target.rows[0]?.count ?? 0) >= 2) {
    throw new Error("目标空间已有两位成员，不能继续加入");
  }
  if (Number(current.rows[0]?.count ?? 0) > 1) {
    throw new Error("当前空间已有成员，不能加入其他空间");
  }
}

async function moveAccountToSpace(client: PoolClient, accountId: string, targetSpaceId: string) {
  await client.query("UPDATE accounts SET space_id = $1, role = 'member' WHERE id = $2", [targetSpaceId, accountId]);
  const nextInviteCode = await generateUniqueInviteCode(client);
  await client.query("UPDATE spaces SET invite_code = $2 WHERE id = $1", [targetSpaceId, nextInviteCode]);
  const result = await client.query<AccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = $1`,
    [accountId]
  );
  if (!result.rows[0]) throw new Error("账号不存在");
  return mapAccount(result.rows[0]);
}

export async function joinSpaceByInviteCode(accountId: string, inviteCode: string): Promise<Account> {
  return withTransaction(async (client) => {
    const normalizedCode = inviteCode.trim().toUpperCase();
    const candidate = await loadJoinCandidate(client, accountId, normalizedCode);
    await lockAndRevalidateInvite(client, {
      currentSpaceId: candidate.current.space_id,
      targetSpaceId: candidate.targetSpaceId,
      inviteCode: normalizedCode
    });
    await assertJoinCapacity(client, candidate.current.space_id, candidate.targetSpaceId);
    return moveAccountToSpace(client, accountId, candidate.targetSpaceId);
  });
}

export async function getSpaceInviteCode(spaceId: string): Promise<string | null> {
  const rows = await query<{ invite_code: string }>("SELECT invite_code FROM spaces WHERE id = $1", [spaceId]);
  return rows[0]?.invite_code ?? null;
}

export type SpaceMember = {
  id: string;
  displayName: string;
  role: AccountRole;
  /**
   * 头像的 R2 对象 key；未设置为 null。客户端用 publicUrl(key) 直连 R2 显示。
   * 成员列表只带这个短字符串，不再有 base64——这正是拖慢 /space-members 的元凶所在。
   */
  avatarKey: string | null;
};

/**
 * 列出一个空间里的全部成员（情侣场景通常是 1~2 人），按注册时间升序。
 * 供客户端渲染「你 + TA」的成对头像与打卡归属。不含邮箱等敏感信息，
 * 头像只给 R2 对象 key，图另走 R2 公开域名直连。
 */
export async function listSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const rows = await query<{
    id: string;
    display_name: string;
    role: AccountRole;
    avatar_key: string | null;
  }>(
    `SELECT id, display_name, role, avatar_key
     FROM accounts WHERE space_id = $1 ORDER BY created_at ASC`,
    [spaceId]
  );
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    avatarKey: row.avatar_key
  }));
}

/**
 * 退出当前空间：为该账号新建一个独立的个人空间并转为其 owner，原空间数据留给对方。
 * 仅当账号是空间里的 member（另一半是 owner）时允许——owner 直接退出会让共享数据无主，
 * 这种情况由路由层拦截并提示「让对方先退出」。
 * 返回迁移后的账号（含新 spaceId、role=owner、新邀请码所属空间）。
 */
export async function leaveSpace(accountId: string): Promise<Account> {
  return withTransaction(async (client) => {
    const currentResult = await client.query<AccountRow>(
      `SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = $1`,
      [accountId]
    );
    const current = currentResult.rows[0];
    if (!current) {
      throw new Error("账号不存在");
    }

    const countResult = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM accounts WHERE space_id = $1",
      [current.space_id]
    );
    const memberCount = Number(countResult.rows[0]?.count ?? 0);
    if (memberCount <= 1) {
      throw new Error("你已是独立空间，无需退出");
    }
    if (current.role === "owner") {
      throw new Error("你是空间创建者，请先让对方退出，再操作");
    }

    // 建个人新空间，转为其 owner；原空间连同共享数据留给创建者。
    const newSpaceId = randomUUID();
    const now = new Date().toISOString();
    const inviteCode = await generateUniqueInviteCode(client);
    await client.query("INSERT INTO spaces (id, invite_code, created_at) VALUES ($1, $2, $3)", [
      newSpaceId,
      inviteCode,
      now
    ]);
    await client.query("UPDATE accounts SET space_id = $1, role = 'owner' WHERE id = $2", [
      newSpaceId,
      accountId
    ]);
    await ensureAdventureForSpace(newSpaceId, client);

    const movedResult = await client.query<AccountRow>(
      `SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = $1`,
      [accountId]
    );
    const moved = movedResult.rows[0];
    if (!moved) {
      throw new Error("账号不存在");
    }
    return mapAccount(moved);
  });
}
