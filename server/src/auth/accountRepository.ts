import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../db/pool.js";
import { deleteObject } from "../r2/r2Client.js";

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
};

type AccountRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  space_id: string;
  role: AccountRole;
  avatar_key: string | null;
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
    createdAt: row.created_at
  };
}

/**
 * 账号信息查询的列清单。只取轻量列，头像仅存 key（不再有 base64 大字段），
 * 因此可以随常规账号读取一起带出，不必再单独拆一个取图查询。
 */
const ACCOUNT_COLUMNS =
  "id, email, display_name, password_hash, space_id, role, avatar_key, created_at";

export async function findAccountByEmail(email: string): Promise<(Account & { passwordHash: string }) | null> {
  const rows = await query<AccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE email = $1`,
    [email.toLowerCase()]
  );
  const row = rows[0];
  return row ? { ...mapAccount(row), passwordHash: row.password_hash } : null;
}

export async function getAccountById(id: string): Promise<Account | null> {
  const rows = await query<AccountRow>(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = $1`, [id]);
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
      createdAt: now,
      // 新账号还没上传头像
      avatarKey: null
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

    const currentAccountResult = await client.query<AccountRow>(
      `SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = $1`,
      [accountId]
    );
    const currentAccount = currentAccountResult.rows[0];
    if (!currentAccount) {
      throw new Error("账号不存在");
    }
    if (currentAccount.space_id === space.id) {
      throw new Error("你已在这个空间，无需重复加入");
    }

    const currentSpaceCountResult = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM accounts WHERE space_id = $1",
      [currentAccount.space_id]
    );
    const currentSpaceAccountCount = Number(currentSpaceCountResult.rows[0]?.count ?? 0);
    if (currentSpaceAccountCount > 1) {
      throw new Error("当前空间已有成员，不能加入其他空间");
    }

    // 加入别人的空间即成为该空间的成员（member），不具备奖励管理权限。
    await client.query("UPDATE accounts SET space_id = $1, role = 'member' WHERE id = $2", [space.id, accountId]);

    const accountResult = await client.query<AccountRow>(
      `SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = $1`,
      [accountId]
    );
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

/** 读取账号的密码哈希，供改密码时校验旧密码。账号不存在返回 null。 */
export async function getPasswordHashById(accountId: string): Promise<string | null> {
  const rows = await query<{ password_hash: string }>(
    "SELECT password_hash FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.password_hash ?? null;
}

/** 更新账号密码哈希（旧密码校验在路由层完成后调用）。 */
export async function updatePasswordHash(accountId: string, passwordHash: string): Promise<void> {
  await query("UPDATE accounts SET password_hash = $2 WHERE id = $1", [accountId, passwordHash]);
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
    let inviteCode = generateInviteCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await client.query("SELECT 1 FROM spaces WHERE invite_code = $1", [inviteCode]);
      if (!clash.rowCount) {
        break;
      }
      inviteCode = generateInviteCode();
    }
    await client.query("INSERT INTO spaces (id, invite_code, created_at) VALUES ($1, $2, $3)", [
      newSpaceId,
      inviteCode,
      now
    ]);
    await client.query("UPDATE accounts SET space_id = $1, role = 'owner' WHERE id = $2", [
      newSpaceId,
      accountId
    ]);

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

/**
 * 删除当前账号。
 * - 若账号是空间里唯一成员：连同空间一起删（级联清空该空间全部数据），并 best-effort 清理 R2 图。
 * - 若账号是 member（对方仍在）：只删自己这一行，空间与共享数据留给对方。
 * - 若账号是 owner 且仍有对方：拒绝，提示先让对方退出（避免共享数据无主）。
 * 返回被清理的 R2 对象 key 列表由内部处理，路由层无需感知。
 */
export async function deleteAccount(accountId: string): Promise<void> {
  const orphanKeys = await withTransaction(async (client) => {
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

    const keysToClean: string[] = [];
    if (current.avatar_key) {
      keysToClean.push(current.avatar_key);
    }

    if (memberCount <= 1) {
      // 唯一成员：收集该空间所有奖励图，再删空间（级联清空全部数据 + 本账号）。
      const rewardImages = await client.query<{ image_key: string | null }>(
        "SELECT image_key FROM rewards WHERE space_id = $1 AND image_key IS NOT NULL",
        [current.space_id]
      );
      for (const row of rewardImages.rows) {
        if (row.image_key) {
          keysToClean.push(row.image_key);
        }
      }
      await client.query("DELETE FROM spaces WHERE id = $1", [current.space_id]);
    } else {
      if (current.role === "owner") {
        throw new Error("你是空间创建者，请先让对方退出，再删除账号");
      }
      // member 退出：只删自己，共享数据留给对方 owner。
      await client.query("DELETE FROM accounts WHERE id = $1", [accountId]);
    }

    return keysToClean;
  });

  // 事务提交后再清 R2（best-effort，删失败不影响账号已删除的事实）。
  for (const key of orphanKeys) {
    await deleteObject(key);
  }
}

/**
 * 更新指定账号自己的头像 R2 对象 key。传 null 清除头像（回退到字母头像）。
 * 只改自己那一行，不涉及权限——每个人管理自己的头像。
 * 图片本身由客户端 presigned PUT 直传 R2，这里只落 key。
 */
export async function updateAvatarKey(accountId: string, avatarKey: string | null): Promise<void> {
  // 先取旧 key，更新后再删旧对象，避免换/清头像后旧图在 R2 里成为孤儿长期堆积。
  const rows = await query<{ avatar_key: string | null }>(
    "SELECT avatar_key FROM accounts WHERE id = $1",
    [accountId]
  );
  const previousKey = rows[0]?.avatar_key ?? null;

  await query("UPDATE accounts SET avatar_key = $2 WHERE id = $1", [accountId, avatarKey]);

  // 换了新图或清空头像时，旧图不再被引用，best-effort 清理（失败不阻断）。
  if (previousKey && previousKey !== avatarKey) {
    await deleteObject(previousKey);
  }
}
