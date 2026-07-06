import { apiRequest } from "./apiClient";

/**
 * 业务数据同步客户端。对应服务端 /api/data/:resource 的「全量拉取 + 单条 upsert + 删除」模型。
 *
 * 各仓储在此之上实现原有导出函数：拉取整表后在内存里做过滤/排序/去重，
 * 写操作走 upsert/delete。匹配「云端直连、在线才能用」，不做本地缓存。
 */

/** 服务端支持的资源名，与 dataRoutes.RESOURCES 的键一一对应。 */
export type ResourceName =
  | "habits"
  | "check_ins"
  | "habit_plans"
  | "rewards"
  | "reward_redemptions"
  | "xp_transactions";

/** 拉取当前空间某资源的全部记录。字段为 camelCase，与服务端 fromDbRow 输出一致。 */
export async function listResource<T>(resource: ResourceName): Promise<T[]> {
  return apiRequest<T[]>(`/api/data/${resource}`);
}

/** upsert 一条记录，body 为该资源的完整业务字段（不含 id/spaceId）。返回落库后的记录。 */
export async function upsertResource<T>(
  resource: ResourceName,
  id: string,
  fields: Record<string, unknown>
): Promise<T> {
  return apiRequest<T>(`/api/data/${resource}/${id}`, { method: "PUT", body: fields });
}

/** 删除一条记录。 */
export async function deleteResource(resource: ResourceName, id: string): Promise<void> {
  await apiRequest<void>(`/api/data/${resource}/${id}`, { method: "DELETE" });
}
