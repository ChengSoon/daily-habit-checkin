import { describe, expect, it } from "vitest";
import { formatIslandLevel, shouldUseIslandImage } from "./islandHero";

describe("shouldUseIslandImage", () => {
  it("无有效 key 时回退抽象柔光（false）", () => {
    expect(shouldUseIslandImage(null)).toBe(false);
    expect(shouldUseIslandImage(undefined)).toBe(false);
    expect(shouldUseIslandImage("")).toBe(false);
    expect(shouldUseIslandImage("   ")).toBe(false);
  });

  it("有真实主题 key 时显示岛图（true）", () => {
    expect(shouldUseIslandImage("lighthouse")).toBe(true);
    expect(shouldUseIslandImage("camp")).toBe(true);
    // 未知 key 也算"有意向"，交给 resolveDefaultIslandSource 兜底成 fallback 岛
    expect(shouldUseIslandImage("mystery")).toBe(true);
  });
});

describe("formatIslandLevel", () => {
  it("正整数格式化为 Lv.N", () => {
    expect(formatIslandLevel(4)).toBe("Lv.4");
    expect(formatIslandLevel(1)).toBe("Lv.1");
  });

  it("缺失/零/负数返回空串", () => {
    expect(formatIslandLevel(undefined)).toBe("");
    expect(formatIslandLevel(null)).toBe("");
    expect(formatIslandLevel(0)).toBe("");
    expect(formatIslandLevel(-2)).toBe("");
  });
});
