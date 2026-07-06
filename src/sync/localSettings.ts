import { getDatabase } from "../db/database";

/**
 * 本地专用设置，永不参与云同步。
 * 用于保存同步服务器地址与登录令牌 —— 这些绝不能上传到服务器。
 */

const SYNC_SERVER_URL_KEY = "syncServerUrl";
const AUTH_TOKEN_KEY = "authToken";
const ACCOUNT_KEY = "account";

async function getLocal(key: string): Promise<string | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_settings WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

async function setLocal(key: string, value: string | null): Promise<void> {
  const db = getDatabase();
  if (value === null) {
    await db.runAsync("DELETE FROM local_settings WHERE key = ?", [key]);
    return;
  }
  await db.runAsync(
    "INSERT INTO local_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function getSyncServerUrl(): Promise<string | null> {
  return getLocal(SYNC_SERVER_URL_KEY);
}

export async function setSyncServerUrl(url: string | null): Promise<void> {
  await setLocal(SYNC_SERVER_URL_KEY, url ? url.replace(/\/+$/, "") : null);
}

export async function getAuthToken(): Promise<string | null> {
  return getLocal(AUTH_TOKEN_KEY);
}

export async function saveAuthToken(token: string): Promise<void> {
  await setLocal(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await setLocal(AUTH_TOKEN_KEY, null);
  await setLocal(ACCOUNT_KEY, null);
}

/** 保存当前账号信息（JSON），供离线读取展示。 */
export async function saveStoredAccount<T>(account: T): Promise<void> {
  await setLocal(ACCOUNT_KEY, JSON.stringify(account));
}

/** 读取本地保存的账号信息，未登录返回 null。 */
export async function getStoredAccount<T>(): Promise<T | null> {
  const raw = await getLocal(ACCOUNT_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
