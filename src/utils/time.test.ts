import { describe, expect, it } from "vitest";
import { normalizeTimeInput } from "./time";

describe("normalizeTimeInput", () => {
  it("接受标准 HH:MM 并原样返回", () => {
    expect(normalizeTimeInput("21:30")).toBe("21:30");
    expect(normalizeTimeInput("00:00")).toBe("00:00");
    expect(normalizeTimeInput("23:59")).toBe("23:59");
  });

  it("补齐单位数小时", () => {
    expect(normalizeTimeInput("9:30")).toBe("09:30");
    expect(normalizeTimeInput("8:05")).toBe("08:05");
  });

  it("容忍首尾空格与全角冒号", () => {
    expect(normalizeTimeInput(" 21:30 ")).toBe("21:30");
    expect(normalizeTimeInput("21：30")).toBe("21:30");
  });

  it("拒绝越界时间", () => {
    expect(normalizeTimeInput("24:00")).toBeNull();
    expect(normalizeTimeInput("12:60")).toBeNull();
    expect(normalizeTimeInput("99:99")).toBeNull();
  });

  it("拒绝非法格式", () => {
    expect(normalizeTimeInput("")).toBeNull();
    expect(normalizeTimeInput("abc")).toBeNull();
    expect(normalizeTimeInput("21:3")).toBeNull();
    expect(normalizeTimeInput("21")).toBeNull();
    expect(normalizeTimeInput("21:300")).toBeNull();
  });
});
