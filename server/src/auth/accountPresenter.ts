import type { Account } from "./accountRepository.js";

export type PublicAccount = Pick<
  Account,
  "id" | "email" | "displayName" | "spaceId" | "role" | "avatarKey"
>;

/** 账号响应使用显式白名单，避免密码哈希和会话版本随对象扩展泄漏。 */
export function toPublicAccount(account: Account): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    spaceId: account.spaceId,
    role: account.role,
    avatarKey: account.avatarKey
  };
}
