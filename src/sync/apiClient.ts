import Constants from "expo-constants";
import { getAuthToken } from "./localSettings";

/**
 * 与统一后端通信的底层 HTTP 客户端。
 * 服务器地址内置在 app 构建配置（app.json 的 extra.apiBaseUrl）里，
 * 所有用户连同一个后端；匹配「云端直连、在线才能用」，未登录时抛出明确错误。
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

const BASE_URL = ((Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? "").replace(/\/+$/, "");

function baseUrl(): string {
  if (!BASE_URL) {
    throw new SyncError("应用未正确配置后端地址，请联系开发者。");
  }
  return BASE_URL;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** 无需登录的请求（注册/登录）设为 true。 */
  anonymous?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${baseUrl()}${path}`;
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
    throw new SyncError("无法连接服务器，请检查网络连接。");
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
