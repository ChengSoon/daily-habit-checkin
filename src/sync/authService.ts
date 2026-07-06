import { apiRequest } from "./apiClient";
import { clearAuthToken, getAuthToken, saveAuthToken } from "./localSettings";

export type AccountRole = "owner" | "member";

export type Account = {
  id: string;
  email: string;
  displayName: string;
  spaceId: string;
  inviteCode: string | null;
  role: AccountRole;
};

type AuthResponse = {
  token: string;
  account: Account;
};

export async function register(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<Account> {
  const result = await apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: input,
    anonymous: true
  });
  await saveAuthToken(result.token);
  return result.account;
}

export async function login(input: { email: string; password: string }): Promise<Account> {
  const result = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: input,
    anonymous: true
  });
  await saveAuthToken(result.token);
  return result.account;
}

/** 用邀请码加入另一半的空间；服务端会重新签发携带新 spaceId 的 token。 */
export async function joinSpace(inviteCode: string): Promise<Account> {
  const result = await apiRequest<AuthResponse>("/api/auth/join-space", {
    method: "POST",
    body: { inviteCode }
  });
  await saveAuthToken(result.token);
  return result.account;
}

/** 本地是否已登录（有 token 即视为已登录）。无网络也可判断。 */
export async function getCurrentAccount(): Promise<Account | null> {
  if (!(await getAuthToken())) {
    return null;
  }
  try {
    return await refreshAccount();
  } catch {
    return null;
  }
}

/** 从服务器拉取当前账号信息（含最新邀请码/空间）。未登录或出错返回 null。 */
export async function refreshAccount(): Promise<Account | null> {
  if (!(await getAuthToken())) {
    return null;
  }
  try {
    const result = await apiRequest<{ account: Account }>("/api/auth/me");
    return result.account;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await clearAuthToken();
}
