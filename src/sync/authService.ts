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

/** 空间成员的公开信息，用于渲染「你 + TA」的成对头像与打卡归属。 */
export type SpaceMember = {
  id: string;
  displayName: string;
  role: AccountRole;
  /** 自定义头像（base64），未设置时为 null，回退到字母头像。 */
  avatarData: string | null;
  avatarMime: string | null;
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

/**
 * 列出当前空间的成员（情侣双方）。未登录或出错返回空数组，
 * 让双人 UI 优雅降级为「邀请另一半」引导。
 */
export async function listSpaceMembers(): Promise<SpaceMember[]> {
  try {
    const result = await apiRequest<{ members: SpaceMember[] }>("/api/auth/space-members");
    return result.members;
  } catch {
    return [];
  }
}

/**
 * 更新当前登录账号的头像。传入压缩后的图片（base64 + mime），
 * 传 null 则清空头像、回退到字母头像。
 */
export async function updateMyAvatar(avatar: { data: string; mime: string } | null): Promise<void> {
  await apiRequest<void>("/api/auth/me/avatar", {
    method: "PUT",
    body: avatar
      ? { avatarData: avatar.data, avatarMime: avatar.mime }
      : { avatarData: null, avatarMime: null }
  });
}
