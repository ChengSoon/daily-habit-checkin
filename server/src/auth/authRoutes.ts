import { Router } from "express";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./passwords.js";
import { signToken } from "./tokens.js";
import {
  findAccountByEmail,
  getAccountById,
  getSpaceInviteCode,
  joinSpaceByInviteCode,
  registerAccount
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

async function withInviteCode(account: {
  id: string;
  email: string;
  displayName: string;
  spaceId: string;
}) {
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
