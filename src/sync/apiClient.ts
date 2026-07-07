import Constants from "expo-constants";
import { clearAuthToken, getAuthToken } from "./localSettings";

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

/**
 * 返回内置后端地址（已去掉尾部斜杠）。供构造头像等静态资源 URL 使用——
 * 这类 URL 直接交给 <Image>，由系统 HTTP 缓存接管，不走 apiRequest。
 * 未配置地址时返回 null，让上层优雅回退到字母头像。
 */
export function getApiBaseUrl(): string | null {
  return BASE_URL || null;
}

/**
 * R2 公开域名（已去尾斜杠），供 publicUrl(key) 拼图片直读地址。
 * 图片走 R2 CDN 直连，不经本服务；未配置时返回 null，组件回退到占位图/字母头像。
 */
const R2_PUBLIC_BASE = ((Constants.expoConfig?.extra?.r2PublicBase as string | undefined) ?? "").replace(/\/+$/, "");

export function getR2PublicBase(): string | null {
  return R2_PUBLIC_BASE || null;
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

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  // 认证失效：401（token 过期/非法），或账号/空间已不存在导致的 404。
  // 本地 token 已无效，清掉它并让上层降级到「请先登录」，而不是卡在「加载失败」。
  if (response.status === 401 || (response.status === 404 && !options.anonymous && isAuthGone(data))) {
    await clearAuthToken();
    const message = (data && typeof data.error === "string" && data.error) || undefined;
    throw new UnauthorizedError(message);
  }

  if (!response.ok) {
    const message = (data && typeof data.error === "string" && data.error) || "请求失败";
    throw new SyncError(message, response.status);
  }

  return data as T;
}

/** 服务端在 token 有效但账号已被删除时返回的 404 文案，视为登录失效。 */
function isAuthGone(data: unknown): boolean {
  return !!data && typeof (data as { error?: unknown }).error === "string" && (data as { error: string }).error === "账号不存在";
}
