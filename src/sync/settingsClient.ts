import { apiRequest } from "./apiClient";

/**
 * 键值型设置同步客户端，对应服务端 /api/settings/:scope。
 * scope = "app"（应用设置）| "admin"（管理 PIN 等）。
 */

export type SettingsScope = "app" | "admin";

/** 读取某 scope 下当前空间的全部键值。 */
export async function fetchSettings(scope: SettingsScope): Promise<Record<string, string>> {
  const result = await apiRequest<{ entries: Record<string, string> }>(`/api/settings/${scope}`);
  return result.entries ?? {};
}

/** 批量 upsert 键值。 */
export async function saveSettings(scope: SettingsScope, entries: Record<string, string>): Promise<void> {
  await apiRequest<void>(`/api/settings/${scope}`, { method: "PUT", body: { entries } });
}
