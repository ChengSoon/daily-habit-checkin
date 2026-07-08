/**
 * 写操作的 owner 权限判定（纯函数，便于脱离 DB 单测）。
 *
 * 资源的 ownerWrite 策略：
 * - "always"：任何写（新建/更新/删除）都要求 owner。用于奖励目录管理。
 * - "onUpdate"：新建放行，更新已有记录才要 owner。用于兑换记录——
 *   任何人可花积分新建兑换，但兑现/取消（改已有记录）仅 owner。
 * - undefined：任何登录用户都能写（情侣共享的习惯/打卡/计划等）。
 *
 * 删除总是针对已存在记录，故 always 与 onUpdate 都要求 owner，
 * 调用方传 operation="delete" 即可，无需再单独查存在性。
 */

export type OwnerWritePolicy = "always" | "onUpdate";
export type WriteOperation = "create" | "update" | "delete";

/**
 * 判断某次写操作是否要求 owner 权限。
 *
 * @param policy       资源的 ownerWrite 策略（undefined 表示不限制）
 * @param operation    本次写操作类型
 * @param recordExists upsert 时该记录是否已存在（决定 create/update）。
 *                     operation 为 "delete" 时忽略。
 */
export function requiresOwner(
  policy: OwnerWritePolicy | undefined,
  operation: WriteOperation,
  recordExists: boolean
): boolean {
  if (!policy) {
    return false;
  }
  if (policy === "always") {
    return true;
  }
  // onUpdate：删除已有记录、或 upsert 命中已存在记录时要 owner；纯新建放行。
  if (operation === "delete") {
    return true;
  }
  return recordExists;
}
