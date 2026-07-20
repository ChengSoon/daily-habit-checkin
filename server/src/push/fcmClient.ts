import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Firebase Admin / FCM 发送封装。
 * 密钥路径优先级：
 *   1. GOOGLE_APPLICATION_CREDENTIALS
 *   2. FCM_SERVICE_ACCOUNT_PATH
 *   3. server/secrets/firebase-adminsdk.json（本地开发，已 gitignore）
 */

type Messaging = {
  send(message: Record<string, unknown>): Promise<string>;
  sendEachForMulticast(message: Record<string, unknown>): Promise<{
    successCount: number;
    failureCount: number;
    responses: Array<{ success: boolean; error?: { code?: string; message?: string } }>;
  }>;
};

type AdminApp = {
  messaging(): Messaging;
};

let messaging: Messaging | null = null;
let initError: string | null = null;

function resolveCredentialPath(): string | null {
  const fromEnv =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    process.env.FCM_SERVICE_ACCOUNT_PATH?.trim() ||
    "";
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }

  const local = path.resolve(process.cwd(), "secrets", "firebase-adminsdk.json");
  if (fs.existsSync(local)) {
    return local;
  }

  // 从 monorepo 根目录启动时 cwd 可能是仓库根
  const fromRoot = path.resolve(process.cwd(), "server", "secrets", "firebase-adminsdk.json");
  if (fs.existsSync(fromRoot)) {
    return fromRoot;
  }

  return null;
}

export function isFcmConfigured(): boolean {
  return Boolean(resolveCredentialPath());
}

export function getFcmInitError(): string | null {
  return initError;
}

export function getFcmMessaging(): Messaging | null {
  if (messaging) {
    return messaging;
  }
  if (initError) {
    return null;
  }

  const credentialPath = resolveCredentialPath();
  if (!credentialPath) {
    initError = "未配置 FCM 服务账号密钥（GOOGLE_APPLICATION_CREDENTIALS / secrets/firebase-adminsdk.json）";
    return null;
  }

  try {
    // 动态加载，避免未安装 firebase-admin 时拖垮整个服务启动
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require("firebase-admin") as {
      apps: unknown[];
      initializeApp: (options: { credential: unknown }) => AdminApp;
      credential: { cert: (pathOrObject: string | object) => unknown };
      messaging: () => Messaging;
    };

    if (!admin.apps.length) {
      const raw = fs.readFileSync(credentialPath, "utf8");
      const serviceAccount = JSON.parse(raw) as object;
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    messaging = admin.messaging();
    console.log(`FCM 已初始化（密钥: ${path.basename(credentialPath)}）`);
    return messaging;
  } catch (error) {
    initError = error instanceof Error ? error.message : "FCM 初始化失败";
    console.warn("FCM 初始化失败:", initError);
    return null;
  }
}

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
};

export async function sendFcmToToken(token: string, payload: PushPayload): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const msg = getFcmMessaging();
  if (!msg) {
    return { ok: false, error: getFcmInitError() ?? "FCM 未配置" };
  }

  try {
    const id = await msg.send({
      token,
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: payload.data,
      android: {
        priority: "high",
        notification: {
          channelId: payload.channelId ?? "habit-reminders-v4",
          sound: "default",
          priority: "max",
          defaultVibrateTimings: true
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1
          }
        }
      }
    });
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "发送失败" };
  }
}

export async function sendFcmToTokens(
  tokens: string[],
  payload: PushPayload
): Promise<{ successCount: number; failureCount: number; invalidTokens: string[]; errors: string[] }> {
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [], errors: [] };
  }

  const msg = getFcmMessaging();
  if (!msg) {
    return {
      successCount: 0,
      failureCount: unique.length,
      invalidTokens: [],
      errors: [getFcmInitError() ?? "FCM 未配置"]
    };
  }

  // 分批最多 500
  const invalidTokens: string[] = [];
  const errors: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500);
    try {
      const result = await msg.sendEachForMulticast({
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body
        },
        data: payload.data,
        android: {
          priority: "high",
          notification: {
            channelId: payload.channelId ?? "habit-reminders-v4",
            sound: "default",
            priority: "max",
            defaultVibrateTimings: true
          }
        },
        apns: {
          payload: {
            aps: {
              sound: "default"
            }
          }
        }
      });
      successCount += result.successCount;
      failureCount += result.failureCount;
      result.responses.forEach((response, index) => {
        if (!response.success) {
          const code = response.error?.code ?? "unknown";
          const message = response.error?.message ?? "send failed";
          errors.push(`${code}: ${message}`);
          if (
            code.includes("registration-token-not-registered") ||
            code.includes("invalid-registration-token") ||
            code.includes("invalid-argument")
          ) {
            invalidTokens.push(batch[index]);
          }
        }
      });
    } catch (error) {
      failureCount += batch.length;
      errors.push(error instanceof Error ? error.message : "FCM batch failed");
    }
  }

  return { successCount, failureCount, invalidTokens, errors };
}
