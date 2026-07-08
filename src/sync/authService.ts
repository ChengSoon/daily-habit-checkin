import { apiRequest } from "./apiClient";
import { clearAuthToken, getAuthToken, getStoredAccount, saveAuthToken, saveStoredAccount } from "./localSettings";
import { publicUrl } from "./publicUrl";

export type AccountRole = "owner" | "member";

export type Account = {
  id: string;
  email: string;
  displayName: string;
  spaceId: string;
  inviteCode: string | null;
  role: AccountRole;
  /** 头像的 R2 对象 key；用 avatarUrl(avatarKey) 拼公开域名取图，无图为 null（字母头像）。 */
  avatarKey: string | null;
};

/** 空间成员的公开信息，用于渲染「你 + TA」的成对头像与打卡归属。 */
export type SpaceMember = {
  id: string;
  displayName: string;
  role: AccountRole;
  /** 头像的 R2 对象 key；用 avatarUrl(avatarKey) 拼公开域名取图，无图为 null。 */
  avatarKey: string | null;
};

/**
 * 把头像的 R2 对象 key 拼成可直接交给 <Image source={{ uri }}> 的公开地址。
 * 头像存 R2、走公开域名直连（CDN + 系统缓存），不再塞进 /me、/space-members 的 JSON——
 * 这是把这两个接口从 ~690KB 降回几乎 0 的关键。
 *
 * 没头像（avatarKey 为 null）或未配置公开域名时返回 null，让组件回退到字母头像。
 */
export function avatarUrl(avatarKey: string | null): string | null {
  return publicUrl(avatarKey);
}

type AuthResponse = {
  token: string;
  account: Account;
};

async function saveAuthSession(result: AuthResponse): Promise<Account> {
  await saveStoredAccount(result.account);
  await saveAuthToken(result.token);
  return result.account;
}

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
  return saveAuthSession(result);
}

export async function login(input: { email: string; password: string }): Promise<Account> {
  const result = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: input,
    anonymous: true
  });
  return saveAuthSession(result);
}

/** 用邀请码加入另一半的空间；服务端会重新签发携带新 spaceId 的 token。 */
export async function joinSpace(inviteCode: string): Promise<Account> {
  const result = await apiRequest<AuthResponse>("/api/auth/join-space", {
    method: "POST",
    body: { inviteCode }
  });
  return saveAuthSession(result);
}

/** 本地是否已登录（有 token 即视为已登录）。无网络也可判断。 */
export async function getCurrentAccount(): Promise<Account | null> {
  if (!(await getAuthToken())) {
    return null;
  }
  const cached = await getStoredAccount<Account>();
  if (cached) {
    return cached;
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
    await saveStoredAccount(result.account);
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
 * 更新当前登录账号的头像。传入已上传到 R2 后拿到的对象 key，
 * 传 null 则清空头像、回退到字母头像。图片本身已由 uploadImage 直传 R2。
 */
export async function updateMyAvatar(avatarKey: string | null): Promise<void> {
  await apiRequest<void>("/api/auth/me/avatar", {
    method: "PUT",
    body: { avatarKey }
  });
}

/**
 * 修改当前登录账号的密码。服务端校验旧密码后更新，成功即完成——
 * 不改变登录态（token 仍有效），失败会抛出带原因的错误交给调用方展示。
 */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiRequest<void>("/api/auth/me/password", {
    method: "PUT",
    body: input
  });
}

/**
 * 退出当前共享空间。仅 member（对方是创建者）可用：服务端为你新建独立空间并转为其
 * owner，原空间数据留给对方。会重新签发携带新 spaceId 的 token，因此更新本地登录态。
 */
export async function leaveSpace(): Promise<Account> {
  const result = await apiRequest<AuthResponse>("/api/auth/leave-space", {
    method: "POST"
  });
  return saveAuthSession(result);
}

/**
 * 删除当前账号。服务端按「是否唯一成员」决定连同空间数据一起删、还是只删自己
 * （member 退出、数据留给对方）。成功后清掉本地登录态。
 */
export async function deleteMyAccount(): Promise<void> {
  await apiRequest<void>("/api/auth/me", { method: "DELETE" });
  await clearAuthToken();
}
