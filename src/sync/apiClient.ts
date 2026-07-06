import { getAuthToken, getSyncServerUrl } from "./localSettings";

/**
 * 与自建同步服务器通信的底层 HTTP 客户端。
 * 匹配「云端直连、在线才能用」：未配置服务器或未登录时直接抛出明确错误。
 */

export class SyncError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SyncError";
  }
}

/** 401 时置位，供上层触发登出。 */
export class UnauthorizedError extends SyncError {
  constructor(message = "登录已失效，请重新登录") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

async function baseUrl(): Promise<string> {
  const url = await getSyncServerUrl();
  if (!url) {
    throw new SyncError("尚未配置同步服务器地址，请到「我的 → 账号与同步」设置。");
  }
  return url;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** 无需登录的请求（注册/登录）设为 true。 */
  anonymous?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${await baseUrl()}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (!options.anonymous) {
    const token = await getAuthToken();
    if (!token) {
      throw new UnauthorizedError("尚未登录");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new SyncError("无法连接同步服务器，请检查网络或服务器地址。");
  }

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data && typeof data.error === "string" && data.error) || "请求失败";
    throw new SyncError(message, response.status);
  }

  return data as T;
}
