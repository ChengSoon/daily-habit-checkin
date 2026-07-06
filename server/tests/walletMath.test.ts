import { describe, expect, it } from "vitest";
import { applyDeltas, walletDelta } from "../src/data/walletMath.js";

describe("walletDelta", () => {
  it("earn 增加余额与累计获得", () => {
    expect(walletDelta("earn", 10)).toEqual({ balance: 10, earned: 10, spent: 0 });
  });

  it("spend 用负 amount 扣余额并累计消费", () => {
    expect(walletDelta("spend", -30)).toEqual({ balance: -30, earned: 0, spent: 30 });
  });

  it("refund 用正 amount 加回余额并冲减累计消费", () => {
    expect(walletDelta("refund", 30)).toEqual({ balance: 30, earned: 0, spent: -30 });
  });

  it("adjust 为正时计入累计获得", () => {
    expect(walletDelta("adjust", 5)).toEqual({ balance: 5, earned: 5, spent: 0 });
  });

  it("adjust 为负时计入累计消费", () => {
    expect(walletDelta("adjust", -5)).toEqual({ balance: -5, earned: 0, spent: 5 });
  });
});

describe("applyDeltas", () => {
  it("把一批交易叠加到初始钱包状态", () => {
    const start = { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };
    const result = applyDeltas(start, [
      walletDelta("earn", 100),
      walletDelta("spend", -30),
      walletDelta("refund", 30)
    ]);
    // 100 - 30 + 30 = 100 余额；累计获得 100；累计消费 30 - 30 = 0
    expect(result).toEqual({ balance: 100, lifetimeEarned: 100, lifetimeSpent: 0 });
  });
});
