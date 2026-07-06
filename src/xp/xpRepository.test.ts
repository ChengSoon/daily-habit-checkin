import { beforeEach, describe, expect, it } from "vitest";
import { resetSyncBackend } from "../../test/fakes/syncBackend";
import { applyXpTransactions, getWallet, listXpTransactions } from "./xpRepository";

describe("xp repository", () => {
  beforeEach(() => {
    resetSyncBackend();
  });

  it("creates a default wallet on first read", async () => {
    const wallet = await getWallet();

    expect(wallet).toEqual({
      id: "default",
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      updatedAt: expect.any(String)
    });
  });

  it("applies earn transactions once by unique key", async () => {
    await applyXpTransactions([
      {
        uniqueKey: "checkin:habit_1:2026-07-06",
        amount: 10,
        type: "earn",
        reason: "checkin",
        habitId: "habit_1",
        checkInId: "checkin_1",
        rewardId: null,
        redemptionId: null,
        dateKey: "2026-07-06"
      }
    ]);
    await applyXpTransactions([
      {
        uniqueKey: "checkin:habit_1:2026-07-06",
        amount: 10,
        type: "earn",
        reason: "checkin",
        habitId: "habit_1",
        checkInId: "checkin_1",
        rewardId: null,
        redemptionId: null,
        dateKey: "2026-07-06"
      }
    ]);

    expect(await getWallet()).toMatchObject({ balance: 10, lifetimeEarned: 10, lifetimeSpent: 0 });
    expect(await listXpTransactions()).toHaveLength(1);
  });

  it("tracks spend and refund without counting refund as earned XP", async () => {
    await applyXpTransactions([
      {
        uniqueKey: "seed",
        amount: 100,
        type: "earn",
        reason: "checkin",
        habitId: null,
        checkInId: null,
        rewardId: null,
        redemptionId: null,
        dateKey: null
      },
      {
        uniqueKey: "spend:redemption_1",
        amount: -40,
        type: "spend",
        reason: "reward_redeem",
        habitId: null,
        checkInId: null,
        rewardId: "reward_1",
        redemptionId: "redemption_1",
        dateKey: null
      },
      {
        uniqueKey: "refund:redemption_1",
        amount: 40,
        type: "refund",
        reason: "redemption_cancel",
        habitId: null,
        checkInId: null,
        rewardId: "reward_1",
        redemptionId: "redemption_1",
        dateKey: null
      }
    ]);

    expect(await getWallet()).toMatchObject({ balance: 100, lifetimeEarned: 100, lifetimeSpent: 0 });
  });
});
