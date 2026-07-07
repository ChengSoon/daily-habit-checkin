import { Router } from "express";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./passwords.js";
import { signToken } from "./tokens.js";
import {
  findAccountByEmail,
  getAccountById,
  getSpaceInviteCode,
  joinSpaceByInviteCode,
  listSpaceMembers,
  registerAccount,
  updateAvatarKey
} from "./accountRepository.js";
import { requireAuth } from "./authMiddleware.js";

export const authRouter = Router();

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

async function withInviteCode<T extends { spaceId: string }>(account: T) {
  const inviteCode = await getSpaceInviteCode(account.spaceId);
  return { ...account, inviteCode };
}

authRouter.post("/register", async (request, response) => {
  try {
    const input = RegisterSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const account = await registerAccount({
      email: input.email,
      displayName: input.displayName,
      passwordHash
    });
    const token = signToken({ accountId: account.id, spaceId: account.spaceId });
    response.json({ token, account: await withInviteCode(account) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "注册失败" });
  }
});

authRouter.post("/login", async (request, response) => {
  try {
    const input = LoginSchema.parse(request.body);
    const account = await findAccountByEmail(input.email);
    if (!account || !(await verifyPassword(input.password, account.passwordHash))) {
      response.status(401).json({ error: "邮箱或密码错误" });
      return;
    }
    const token = signToken({ accountId: account.id, spaceId: account.spaceId });
    response.json({ token, account: await withInviteCode(account) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "登录失败" });
  }
});

authRouter.post("/join-space", requireAuth, async (request, response) => {
  try {
    const input = JoinSchema.parse(request.body);
    const account = await joinSpaceByInviteCode(request.accountId!, input.inviteCode);
    // 空间变了，重新签发携带新 spaceId 的 token
    const token = signToken({ accountId: account.id, spaceId: account.spaceId });
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
    await updateAvatarKey(request.accountId!, input.avatarKey);
    response.status(204).end();
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "更新头像失败" });
  }
});
