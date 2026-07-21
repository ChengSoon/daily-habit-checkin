import { getDatabase, initializeDatabase } from "../db/database";

/**
 * 本地专用设置，永不参与云同步。
 * 用于保存登录令牌与账号缓存 —— 这些绝不能上传到服务器。
 * 服务器地址内置在 app 构建配置（app.json 的 extra.apiBaseUrl），不再本地存储。
 */

const AUTH_TOKEN_KEY = "authToken";
const ACCOUNT_KEY = "account";
const VOICE_WAKE_ENABLED_KEY = "voiceWakeEnabled";
const authTokenListeners = new Set<() => void>();

function notifyAuthTokenChanged(): void {
  for (const listener of [...authTokenListeners]) {
    listener();
  }
}

export function subscribeAuthTokenChanges(listener: () => void): () => void {
  authTokenListeners.add(listener);
  return () => {
    authTokenListeners.delete(listener);
  };
}

async function getLocal(key: string): Promise<string | null> {
  await initializeDatabase();
  const db = getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_settings WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

async function setLocal(key: string, value: string | null): Promise<void> {
  await initializeDatabase();
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

export async function getAuthToken(): Promise<string | null> {
  return getLocal(AUTH_TOKEN_KEY);
}

export async function saveAuthToken(token: string): Promise<void> {
  await setLocal(AUTH_TOKEN_KEY, token);
  notifyAuthTokenChanged();
}

export async function clearAuthToken(): Promise<void> {
  await setLocal(AUTH_TOKEN_KEY, null);
  await setLocal(ACCOUNT_KEY, null);
  notifyAuthTokenChanged();
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

export async function getVoiceWakeEnabled(): Promise<boolean> {
  return (await getLocal(VOICE_WAKE_ENABLED_KEY)) === "true";
}

export async function saveVoiceWakeEnabled(enabled: boolean): Promise<void> {
  await setLocal(VOICE_WAKE_ENABLED_KEY, String(enabled));
}
