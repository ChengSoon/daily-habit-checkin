import crypto from "node:crypto";

/**
 * 轻量 JWT（HS256）签发与校验，仅依赖 Node 内置 crypto，避免额外依赖。
 * 用于双人情侣场景足够；密钥来自环境变量 JWT_SECRET。
 */

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET 未配置");
  }
  return secret;
}

export type TokenPayload = {
  accountId: string;
  spaceId: string;
};

export function signToken(payload: TokenPayload, expiresInSeconds = 60 * 60 * 24 * 30): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds
    })
  );
  const data = `${header}.${body}`;
  const signature = base64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
  return `${data}.${signature}`;
}

export function verifyToken(token: string): (TokenPayload & { exp: number }) | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  const expected = base64url(
    crypto.createHmac("sha256", getSecret()).update(`${header}.${body}`).digest()
  );

  // 定长比较，避免时序侧信道
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return null;
  }

  try {
    const decoded = JSON.parse(fromBase64url(body).toString("utf8")) as TokenPayload & { exp: number };
    if (decoded.exp * 1000 < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
