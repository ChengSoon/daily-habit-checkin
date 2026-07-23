import { Router } from "express";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./passwords.js";
import { signToken } from "./tokens.js";
import {
  deleteAccount,
  findAccountByEmail,
  getAccountById,
  getPasswordHashById,
  getSpaceInviteCode,
  joinSpaceByInviteCode,
  leaveSpace,
  listSpaceMembers,
  registerAccount,
  revokeAccountSessions,
  updateAvatarKey,
  updatePasswordHash
} from "./accountRepository.js";
import { requireAuth } from "./authMiddleware.js";
import { toPublicAccount } from "./accountPresenter.js";
import { createRateLimiter } from "../middleware.js";
import { isObjectKeyForScope } from "../r2/r2Client.js";

export const authRouter = Router();

/**
 * 认证类写接口的限流：防止对 /login 暴力撞密码、对 /register 批量注册刷库。
 * 按客户端 IP 计数，默认每分钟 10 次（可用 AUTH_RATE_LIMIT_* 覆盖）。
 * 只挂在 login/register/join-space 这类写接口上，读接口（/me、/space-members）不受限。
 */
const authRateLimit = createRateLimiter({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10)
});

const RegisterSchema = z.object({
  email: z.string().email().max(120),
  displayName: z.string().min(1).max(40),
  password: z.string().min(6).max(72)
});

const LoginSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(72)
});

const JoinSchema = z.object({
  inviteCode: z.string().min(4).max(16)
});

async function withInviteCode(account: Parameters<typeof toPublicAccount>[0]) {
  const inviteCode = await getSpaceInviteCode(account.spaceId);
  return { ...toPublicAccount(account), inviteCode };
}

authRouter.post("/register", authRateLimit, async (request, response) => {
  try {
    const input = RegisterSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const account = await registerAccount({
      email: input.email,
      displayName: input.displayName,
      passwordHash
    });
    const token = signToken({ accountId: account.id, spaceId: account.spaceId, sessionVersion: account.sessionVersion });
    response.json({ token, account: await withInviteCode(account) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "注册失败" });
  }
});

authRouter.post("/login", authRateLimit, async (request, response) => {
  try {
    const input = LoginSchema.parse(request.body);
    const account = await findAccountByEmail(input.email);
    if (!account || !(await verifyPassword(input.password, account.passwordHash))) {
      response.status(401).json({ error: "邮箱或密码错误" });
      return;
    }
    const token = signToken({ accountId: account.id, spaceId: account.spaceId, sessionVersion: account.sessionVersion });
    response.json({ token, account: await withInviteCode(account) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "登录失败" });
  }
});

authRouter.post("/join-space", authRateLimit, requireAuth, async (request, response) => {
  try {
    const input = JoinSchema.parse(request.body);
    const account = await joinSpaceByInviteCode(request.accountId!, input.inviteCode);
    // 空间变了，重新签发携带新 spaceId 的 token
    const token = signToken({ accountId: account.id, spaceId: account.spaceId, sessionVersion: account.sessionVersion });
    response.json({ token, account: await withInviteCode(account) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "加入空间失败" });
  }
});

authRouter.get("/me", requireAuth, async (request, response) => {
  const account = await getAccountById(request.accountId!);
  if (!account) {
    response.status(404).json({ error: "账号不存在" });
    return;
  }
  response.json({ account: await withInviteCode(account) });
});

/**
 * 列出当前空间的成员（情侣双方）。用于客户端展示成对头像/昵称与打卡归属。
 * 只返回展示所需的公开字段，不含邮箱/密码等敏感信息。
 */
authRouter.get("/space-members", requireAuth, async (request, response) => {
  const members = await listSpaceMembers(request.spaceId!);
  response.json({ members });
});

// 头像现在存 Cloudflare R2，只在库里记对象 key。客户端先经 /api/uploads/presign
// 直传图片到 R2，再把返回的 key 提交到这里。传 { avatarKey: null } 即清除头像。
const AvatarSchema = z.object({
  avatarKey: z.string().min(1).max(512).nullable()
});

/**
 * 更新当前登录账号的头像 key（accounts.avatar_key）。
 * 传 { avatarKey: null } 即删除头像，回退到字母头像。
 * 图片字节不经此接口——它已由客户端直传 R2。
 */
authRouter.put("/me/avatar", requireAuth, async (request, response) => {
  try {
    const input = AvatarSchema.parse(request.body);
    if (input.avatarKey && !isObjectKeyForScope("avatar", request.accountId!, input.avatarKey)) {
      response.status(400).json({ error: "头像对象不属于当前账号" });
      return;
    }
    await updateAvatarKey(request.accountId!, input.avatarKey);
    response.status(204).end();
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "更新头像失败" });
  }
});

// 登录态改密码：校验旧密码后写新哈希。新密码规则与注册一致（至少 6 位）。
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(6).max(72)
});

/**
 * 修改当前登录账号的密码。需提供正确的旧密码，避免他人拿着已登录设备直接改密。
 * 改密后递增 session_version，吊销其他设备旧 token，并给当前设备签发新 token。
 */
authRouter.put("/me/password", requireAuth, authRateLimit, async (request, response) => {
  try {
    const input = ChangePasswordSchema.parse(request.body);
    const currentHash = await getPasswordHashById(request.accountId!);
    if (!currentHash || !(await verifyPassword(input.currentPassword, currentHash))) {
      response.status(400).json({ error: "当前密码不正确" });
      return;
    }
    if (input.newPassword === input.currentPassword) {
      response.status(400).json({ error: "新密码不能与当前密码相同" });
      return;
    }
    const newHash = await hashPassword(input.newPassword);
    const sessionVersion = await updatePasswordHash(request.accountId!, newHash);
    const account = await getAccountById(request.accountId!);
    if (!account) throw new Error("账号不存在");
    const token = signToken({ accountId: account.id, spaceId: account.spaceId, sessionVersion });
    response.json({ token });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "修改密码失败" });
  }
});

/**
 * 退出当前空间（仅 member 可用）：为自己新建独立空间并转 owner，共享数据留给对方。
 * owner 想解散共享需让对方先退出，由仓储层拦截提示。退出后重新签发携带新 spaceId 的 token。
 */
authRouter.post("/leave-space", requireAuth, async (request, response) => {
  try {
    const account = await leaveSpace(request.accountId!);
    const token = signToken({ accountId: account.id, spaceId: account.spaceId, sessionVersion: account.sessionVersion });
    response.json({ token, account: await withInviteCode(account) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "退出空间失败" });
  }
});

/**
 * 删除当前登录账号。唯一成员会连空间与全部共享数据一并删除（不可恢复）；
 * member 删除只移除自己，数据留给对方 owner；owner 在对方仍在时被拒绝。
 */
authRouter.delete("/me", requireAuth, async (request, response) => {
  try {
    await deleteAccount(request.accountId!);
    response.status(204).end();
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "删除账号失败" });
  }
});

authRouter.post("/logout", requireAuth, async (request, response) => {
  await revokeAccountSessions(request.accountId!);
  response.status(204).end();
});
