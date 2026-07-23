/** 从 OpenAI 兼容 SSE 文本块中解析 delta content。 */
export function parseSseDataLines(buffer: string): { events: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: string[] = [];
  for (const part of parts) {
    const lines = part.split("\n");
    const dataLines = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());
    if (dataLines.length > 0) {
      events.push(dataLines.join("\n"));
    }
  }
  return { events, rest };
}

export function extractDeltaContent(data: string): string | null {
  if (!data || data === "[DONE]") {
    return null;
  }

  let json: {
    choices?: { delta?: { content?: string | null }; message?: { content?: string | null } }[];
    content?: string;
    error?: { message?: string } | string;
  };

  try {
    json = JSON.parse(data) as typeof json;
  } catch {
    // 非 JSON 的纯文本增量
    if (!data.trimStart().startsWith("{") && !data.trimStart().startsWith("[")) {
      return data;
    }
    return null;
  }

  if (typeof json.error === "string" && json.error) {
    throw new Error(json.error);
  }
  if (json.error && typeof json.error === "object" && json.error.message) {
    throw new Error(json.error.message);
  }

  const delta = json.choices?.[0]?.delta?.content;
  if (typeof delta === "string" && delta.length > 0) {
    return delta;
  }

  const message = json.choices?.[0]?.message?.content;
  if (typeof message === "string" && message.length > 0) {
    return message;
  }

  if (typeof json.content === "string" && json.content.length > 0) {
    return json.content;
  }

  return null;
}
