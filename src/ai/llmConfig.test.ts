import { describe, expect, it } from "vitest";
import { detectLlmMode, normalizeOpenAiCompatibleBase, trimTrailingSlash } from "./llmConfigCore";

describe("detectLlmMode", () => {
  it("detects openai-compatible hosts and /v1 paths", () => {
    expect(detectLlmMode("https://api.openai.com/v1")).toBe("openai_compatible");
    expect(detectLlmMode("https://api.deepseek.com")).toBe("openai_compatible");
    expect(detectLlmMode("https://api.siliconflow.cn/v1")).toBe("openai_compatible");
  });

  it("treats habit backend as habit_server", () => {
    expect(detectLlmMode("http://127.0.0.1:8787")).toBe("habit_server");
    expect(detectLlmMode("https://habit.example.com")).toBe("habit_server");
    expect(detectLlmMode("")).toBe("habit_server");
  });
});

describe("normalizeOpenAiCompatibleBase", () => {
  it("appends /v1 for bare hosts", () => {
    expect(normalizeOpenAiCompatibleBase("https://api.deepseek.com")).toBe("https://api.deepseek.com/v1");
  });

  it("keeps existing /v1 and strips chat path", () => {
    expect(normalizeOpenAiCompatibleBase("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
    expect(normalizeOpenAiCompatibleBase("https://proxy.example.com/v1/chat/completions")).toBe(
      "https://proxy.example.com/v1"
    );
  });

  it("trims trailing slash", () => {
    expect(trimTrailingSlash("https://a.com/")).toBe("https://a.com");
  });
});
