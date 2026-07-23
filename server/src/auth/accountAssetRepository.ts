import { query, withTransaction } from "../db/pool.js";
import { deleteObjectForScope, isObjectKeyForScope, type UploadKind } from "../r2/r2Client.js";
import type { PoolClient } from "pg";

type AccountAssetRow = {
  id: string;
  space_id: string;
  role: "owner" | "member";
  avatar_key: string | null;
};

type ObjectToClean = { kind: UploadKind; scope: string; key: string };

async function collectAccountObjects(account: AccountAssetRow): Promise<ObjectToClean[]> {
  const objects: ObjectToClean[] = [];
  if (account.avatar_key) {
    objects.push({ kind: "avatar", scope: account.id, key: account.avatar_key });
  }
  return objects;
}

async function collectSpaceObjects(client: Pick<PoolClient, "query">, spaceId: string): Promise<ObjectToClean[]> {
  const [rewards, chapters] = await Promise.all([
    client.query<{ image_key: string | null }>(
      "SELECT image_key FROM rewards WHERE space_id = $1 AND image_key IS NOT NULL",
      [spaceId]
    ),
    client.query<{ badge_image_key: string | null; node_image_key: string | null; background_image_key: string | null }>(
      `SELECT badge_image_key, node_image_key, background_image_key
       FROM adventure_chapters WHERE space_id = $1`,
      [spaceId]
    )
  ]);
  const objects: ObjectToClean[] = rewards.rows.flatMap((row) =>
    row.image_key ? [{ kind: "reward" as const, scope: spaceId, key: row.image_key }] : []
  );
  for (const row of chapters.rows) {
    for (const key of [row.badge_image_key, row.node_image_key, row.background_image_key]) {
      if (key) objects.push({ kind: "adventure", scope: spaceId, key });
    }
  }
  return objects;
}

/** 删除账号；唯一成员会连同空间数据删除，R2 清理在事务提交后 best-effort 执行。 */
export async function deleteAccount(accountId: string): Promise<void> {
  const orphanKeys = await withTransaction(async (client) => {
    const currentResult = await client.query<AccountAssetRow>(
      "SELECT id, space_id, role, avatar_key FROM accounts WHERE id = $1",
      [accountId]
    );
    const current = currentResult.rows[0];
    if (!current) throw new Error("账号不存在");

    const countResult = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM accounts WHERE space_id = $1",
      [current.space_id]
    );
    const memberCount = Number(countResult.rows[0]?.count ?? 0);
    const keysToClean = await collectAccountObjects(current);

    if (memberCount <= 1) {
      keysToClean.push(...await collectSpaceObjects(client, current.space_id));
      await client.query("DELETE FROM spaces WHERE id = $1", [current.space_id]);
    } else {
      if (current.role === "owner") {
        throw new Error("你是空间创建者，请先让对方退出，再删除账号");
      }
      await client.query("DELETE FROM accounts WHERE id = $1", [accountId]);
    }
    return keysToClean;
  });

  for (const object of orphanKeys) {
    await deleteObjectForScope(object.kind, object.scope, object.key);
  }
}

/** 更新当前账号的头像 key，并在成功后清理不再引用的旧对象。 */
export async function updateAvatarKey(accountId: string, avatarKey: string | null): Promise<void> {
  if (avatarKey && !isObjectKeyForScope("avatar", accountId, avatarKey)) {
    throw new Error("头像对象不属于当前账号");
  }
  const rows = await query<{ avatar_key: string | null }>(
    "SELECT avatar_key FROM accounts WHERE id = $1",
    [accountId]
  );
  const previousKey = rows[0]?.avatar_key ?? null;
  await query("UPDATE accounts SET avatar_key = $2 WHERE id = $1", [accountId, avatarKey]);

  if (previousKey && previousKey !== avatarKey) {
    await deleteObjectForScope("avatar", accountId, previousKey);
  }
}
