import { describe, expect, it } from "vitest";
import { hashString, mulberry32 } from "./seededRandom";

describe("mulberry32", () => {
  it("同种子产生相同序列", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("不同种子产生不同序列", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it("输出落在 [0,1)", () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hashString", () => {
  it("相同输入哈希稳定", () => {
    expect(hashString("station-1")).toBe(hashString("station-1"));
  });
  it("不同输入哈希不同", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});
