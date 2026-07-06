import { beforeEach, describe, expect, it } from "vitest";
import { resetSyncBackend } from "../../test/fakes/syncBackend";
import { applyXpTransactions, getWallet } from "../xp/xpRepository";
import { createReward, getRewardById, listRewards } from "./rewardRepository";
import { cancelRedemption, fulfillRedemption, redeemReward } from "./rewardService";

describe("reward service", () => {
  beforeEach(() => {
    resetSyncBackend();
  });

  it("redeems a real-world reward as pending fulfillment", async () => {
    await applyXpTransactions([
      {
        uniqueKey: "seed",
        amount: 500,
        type: "earn",
        reason: "checkin",
        habitId: null,
        checkInId: null,
        rewardId: null,
        redemptionId: null,
        dateKey: null
      }
    ]);
    const reward = await createReward({
      title: "奶茶一杯",
      description: "周末兑现",
      type: "real_world",
      priceXp: 300,
      status: "active",
      virtualKind: "none",
      inventoryLimit: null,
      imageData: null,
      imageMime: null
    });

    const redemption = await redeemReward(reward.id);

    expect(redemption).toMatchObject({ rewardId: reward.id, priceXp: 300, status: "pending_fulfillment" });
    expect(await getWallet()).toMatchObject({ balance: 200, lifetimeSpent: 300 });
  });

  it("redeems a virtual reward as fulfilled", async () => {
    await applyXpTransactions([
      {
        uniqueKey: "seed",
        amount: 500,
        type: "earn",
        reason: "checkin",
        habitId: null,
        checkInId: null,
        rewardId: null,
        redemptionId: null,
        dateKey: null
      }
    ]);
    const reward = await createReward({
      title: "粉色主题",
      description: "解锁新的主题色",
      type: "virtual",
      priceXp: 100,
      status: "active",
      virtualKind: "theme",
      inventoryLimit: null,
      imageData: null,
      imageMime: null
    });

    const redemption = await redeemReward(reward.id);

    expect(redemption.status).toBe("fulfilled");
  });

  it("blocks redemption when XP is insufficient", async () => {
    const reward = await createReward({
      title: "约会基金",
      description: null,
      type: "real_world",
      priceXp: 1000,
      status: "active",
      virtualKind: "none",
      inventoryLimit: null,
      imageData: null,
      imageMime: null
    });

    await expect(redeemReward(reward.id)).rejects.toThrow("积分不足，还差 1000 积分");
  });

  it("fulfills and cancels pending redemptions", async () => {
    await applyXpTransactions([
      {
        uniqueKey: "seed",
        amount: 500,
        type: "earn",
        reason: "checkin",
        habitId: null,
        checkInId: null,
        rewardId: null,
        redemptionId: null,
        dateKey: null
      }
    ]);
    const reward = await createReward({
      title: "电影夜",
      description: null,
      type: "real_world",
      priceXp: 200,
      status: "active",
      virtualKind: "none",
      inventoryLimit: null,
      imageData: null,
      imageMime: null
    });
    const first = await redeemReward(reward.id);
    const fulfilled = await fulfillRedemption(first.id);
    expect(fulfilled.status).toBe("fulfilled");
    await expect(cancelRedemption(first.id)).rejects.toThrow("已兑现的奖励不能取消");

    const second = await redeemReward(reward.id);
    const cancelled = await cancelRedemption(second.id);
    expect(cancelled.status).toBe("cancelled");
    expect(await getWallet()).toMatchObject({ balance: 300, lifetimeSpent: 200 });
  });

  it("lists active and archived rewards", async () => {
    const reward = await createReward({
      title: "称号",
      description: null,
      type: "virtual",
      priceXp: 100,
      status: "active",
      virtualKind: "title",
      inventoryLimit: null,
      imageData: null,
      imageMime: null
    });

    expect((await listRewards({ includeArchived: false })).map((item) => item.id)).toEqual([reward.id]);
    expect(await getRewardById(reward.id)).toMatchObject({ title: "称号" });
  });
});
