import { describe, it, expect } from "vitest";
import { requiresOwner } from "./ownerWrite.js";

/**
 * owner 权限判定的纯函数单测。覆盖三种策略 × 新建/更新/删除的组合，
 * 把「谁能写」的规则钉死，避免后续重构再次悄悄丢掉服务端权限门。
 */
describe("requiresOwner", () => {
  it("无策略（共享资源：习惯/打卡/计划）任何写都不要 owner", () => {
    expect(requiresOwner(undefined, "create", false)).toBe(false);
    expect(requiresOwner(undefined, "update", true)).toBe(false);
    expect(requiresOwner(undefined, "delete", true)).toBe(false);
  });

  it("always（奖励目录）新建/更新/删除都要 owner", () => {
    expect(requiresOwner("always", "create", false)).toBe(true);
    expect(requiresOwner("always", "update", true)).toBe(true);
    expect(requiresOwner("always", "delete", true)).toBe(true);
  });

  it("onUpdate（兑换记录）新建放行，更新/删除要 owner", () => {
    // member 花积分新建兑换：放行
    expect(requiresOwner("onUpdate", "create", false)).toBe(false);
    // 兑现/取消（改已有记录）：要 owner
    expect(requiresOwner("onUpdate", "update", true)).toBe(true);
    // 删除已有兑换：要 owner
    expect(requiresOwner("onUpdate", "delete", true)).toBe(true);
  });

  it("onUpdate 时 recordExists 决定 upsert 是否要 owner", () => {
    // upsert 命中已存在记录 = 实质更新，要 owner
    expect(requiresOwner("onUpdate", "update", true)).toBe(true);
    // upsert 未命中 = 实质新建，放行
    expect(requiresOwner("onUpdate", "create", false)).toBe(false);
  });
});
