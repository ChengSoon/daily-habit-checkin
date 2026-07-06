import { syncBackend } from "./syncBackend";

/**
 * 测试用 apiClient 替身：保留与真实模块相同的导出（错误类型 + apiRequest 签名），
 * 但把请求转发到内存版 syncBackend，而不是真的发 HTTP。
 * 通过 vitest alias 注入（见 vitest.config.ts）。
 */

export class SyncError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SyncError";
  }
}

export class UnauthorizedError extends SyncError {
  constructor(message = "登录已失效，请重新登录") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  anonymous?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  return syncBackend.handle(path, method, options.body) as T;
}
