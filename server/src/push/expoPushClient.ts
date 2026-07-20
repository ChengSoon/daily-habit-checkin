export type ExpoPushMessage = {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default" | null;
  channelId?: string;
  priority?: "default" | "normal" | "high";
};

export function isExpoPushToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

export async function sendExpoPush(
  messages: ExpoPushMessage[]
): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
  if (messages.length === 0) {
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(messages)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      successCount: 0,
      failureCount: messages.length,
      errors: [`Expo Push HTTP ${response.status}: ${text.slice(0, 200)}`]
    };
  }

  const payload = (await response.json()) as {
    data?: Array<{ status?: string; message?: string; details?: { error?: string } }>;
  };
  const rows = Array.isArray(payload.data) ? payload.data : [];
  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (row.status === "ok") {
      successCount += 1;
    } else {
      failureCount += 1;
      const detail = row.message || row.details?.error || row.status || "unknown";
      errors.push(String(detail));
    }
  }

  // Expo 有时返回单个对象
  if (rows.length === 0 && payload && typeof payload === "object") {
    successCount = messages.length;
  }

  return { successCount, failureCount, errors };
}
