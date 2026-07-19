export type LlmMode = "openai_compatible" | "habit_server";

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** 判断用户填写的地址更像 LLM 中转/官方接口，还是本应用习惯后端。 */
export function detectLlmMode(baseUrl: string): LlmMode {
  const url = baseUrl.trim().toLowerCase();
  if (!url) {
    return "habit_server";
  }
  if (/\/v1(\/|$)/.test(url) || /\/chat\/completions/.test(url)) {
    return "openai_compatible";
  }
  if (
    /(openai\.com|deepseek\.com|siliconflow|together\.ai|groq\.com|dashscope|bigmodel\.cn|moonshot|minimax|openrouter\.ai|volces\.com|byteplus|aliyuncs|geekai|azure\.com|anthropic|mistral|fireworks\.ai|nebius|infini|baichuan|zhipu|yi\.ai)/i.test(
      url
    )
  ) {
    return "openai_compatible";
  }
  return "habit_server";
}

/** 规范成可拼 `/chat/completions` 的 base（保留 /v1）。 */
export function normalizeOpenAiCompatibleBase(baseUrl: string): string {
  let url = trimTrailingSlash(baseUrl.trim());
  url = url.replace(/\/chat\/completions$/i, "");
  url = trimTrailingSlash(url);
  if (!/\/v1$/i.test(url)) {
    const path = url.replace(/^https?:\/\/[^/]+/i, "");
    if (!path || path === "") {
      url = `${url}/v1`;
    }
  }
  return url;
}
