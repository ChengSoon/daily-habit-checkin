import { createHash, randomUUID } from "node:crypto";

const GETUI_API_ORIGIN = "https://restapi.getui.com/v2";
const AUTH_REFRESH_MARGIN_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

type GetuiConfig = {
  appId: string;
  appKey: string;
  masterSecret: string;
  baseUrl: string;
};

type GetuiResponse<T> = {
  code: number;
  msg?: string;
  data?: T;
};

type CachedToken = { value: string; expiresAt: number };

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
};

export type GetuiBatchResult = {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  errors: string[];
};

let cachedToken: CachedToken | null = null;

function readGetuiConfig(): GetuiConfig | null {
  const appId = process.env.GETUI_APP_ID?.trim();
  const appKey = process.env.GETUI_APP_KEY?.trim();
  const masterSecret = process.env.GETUI_MASTER_SECRET?.trim();
  if (!appId || !appKey || !masterSecret) return null;
  const origin = process.env.GETUI_API_BASE_URL?.trim() || GETUI_API_ORIGIN;
  return { appId, appKey, masterSecret, baseUrl: `${origin.replace(/\/$/, "")}/${appId}` };
}

export function isGetuiConfigured(): boolean {
  return readGetuiConfig() !== null;
}

export function getGetuiConfigError(): string | null {
  if (isGetuiConfigured()) return null;
  return "未配置个推密钥（GETUI_APP_ID / GETUI_APP_KEY / GETUI_MASTER_SECRET）";
}

export function buildGetuiAuthSign(appKey: string, timestamp: string, masterSecret: string): string {
  return createHash("sha256").update(`${appKey}${timestamp}${masterSecret}`).digest("hex");
}

async function requestJson<T>(url: string, init: RequestInit): Promise<GetuiResponse<T>> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json;charset=utf-8", ...init.headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const text = await response.text();
  const result = JSON.parse(text) as GetuiResponse<T>;
  if (!response.ok) {
    throw new Error(`个推 HTTP ${response.status}: ${result.msg ?? text}`);
  }
  return result;
}

async function requestAuthToken(config: GetuiConfig): Promise<CachedToken> {
  const timestamp = Date.now().toString();
  const response = await requestJson<{ token?: string; expire_time?: string }>(`${config.baseUrl}/auth`, {
    method: "POST",
    body: JSON.stringify({
      sign: buildGetuiAuthSign(config.appKey, timestamp, config.masterSecret),
      timestamp,
      appkey: config.appKey
    })
  });
  const value = response.data?.token;
  const expiresAt = Number(response.data?.expire_time);
  if (response.code !== 0 || !value || !Number.isFinite(expiresAt)) {
    throw new Error(`个推鉴权失败 (${response.code}): ${response.msg ?? "响应无 token"}`);
  }
  return { value, expiresAt };
}

async function getAccessToken(config: GetuiConfig, forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt - AUTH_REFRESH_MARGIN_MS > Date.now()) {
    return cachedToken.value;
  }
  cachedToken = await requestAuthToken(config);
  return cachedToken.value;
}

async function postAuthorized<T>(path: string, body: unknown, retry = true): Promise<GetuiResponse<T>> {
  const config = readGetuiConfig();
  if (!config) throw new Error(getGetuiConfigError() ?? "个推未配置");
  const token = await getAccessToken(config);
  const response = await requestJson<T>(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { token },
    body: JSON.stringify(body)
  });
  if (response.code === 10001 && retry) {
    cachedToken = null;
    await getAccessToken(config, true);
    return postAuthorized<T>(path, body, false);
  }
  return response;
}

export function buildGetuiNotification(payload: PushPayload): Record<string, unknown> {
  const notification: Record<string, unknown> = {
    title: payload.title,
    body: payload.body,
    logo: "push.png",
    channel_id: payload.channelId ?? "habit-reminders-v4",
    channel_name: "习惯提醒",
    channel_level: 4,
    click_type: payload.data ? "payload" : "startapp"
  };
  if (payload.data) notification.payload = JSON.stringify(payload.data);
  return notification;
}

export async function sendGetuiToCid(
  cid: string,
  payload: PushPayload
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const response = await postAuthorized<Record<string, unknown>>("/push/single/cid", {
      request_id: randomUUID().replaceAll("-", ""),
      settings: { ttl: DEFAULT_TTL_MS },
      audience: { cid: [cid] },
      push_message: { notification: buildGetuiNotification(payload) }
    });
    if (response.code !== 0) {
      return { ok: false, error: `个推发送失败 (${response.code}): ${response.msg ?? "unknown"}` };
    }
    return { ok: true, id: Object.keys(response.data ?? {})[0] ?? "accepted" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "个推发送失败" };
  }
}

export async function sendGetuiToCids(cids: string[], payload: PushPayload): Promise<GetuiBatchResult> {
  const unique = [...new Set(cids.map((cid) => cid.trim()).filter(Boolean))];
  const result: GetuiBatchResult = {
    successCount: 0,
    failureCount: 0,
    invalidTokens: [],
    errors: []
  };
  for (const cid of unique) {
    const sent = await sendGetuiToCid(cid, payload);
    if (sent.ok) result.successCount += 1;
    else {
      result.failureCount += 1;
      result.errors.push(sent.error);
    }
  }
  return result;
}
