import { describe, expect, it } from "vitest";
import { buildCouple } from "./useCouple";
import type { SpaceMember } from "../sync/authService";

const member = (
  id: string,
  displayName: string,
  role: "owner" | "member" = "member",
  avatar?: { data: string; mime: string }
): SpaceMember => ({
  id,
  displayName,
  role,
  avatarData: avatar?.data ?? null,
  avatarMime: avatar?.mime ?? null
});

const me = (id: string, displayName: string) => ({ id, displayName });

describe("buildCouple", () => {
  it("未登录且无成员时返回未加载状态", () => {
    const couple = buildCouple([], null);
    expect(couple.loaded).toBe(false);
    expect(couple.people).toHaveLength(0);
  });

  it("当前登录者标为 you（粉），排在最前", () => {
    const couple = buildCouple([member("a", "小明"), member("b", "小红")], me("b", "小红"));
    expect(couple.you?.name).toBe("小红");
    expect(couple.you?.tone).toBe("you");
    expect(couple.people[0].id).toBe("b");
  });

  it("另一半标为 partner（紫）", () => {
    const couple = buildCouple([member("a", "小明"), member("b", "小红")], me("b", "小红"));
    expect(couple.partner?.name).toBe("小明");
    expect(couple.partner?.tone).toBe("partner");
  });

  it("成员接口为空但已登录时，仍用当前账号渲染「你」", () => {
    // 老后端没有 /space-members 路由，listSpaceMembers 返回空数组；
    // 这时「你」必须仍能显示，不依赖成员接口。
    const couple = buildCouple([], me("b", "小红"));
    expect(couple.you?.name).toBe("小红");
    expect(couple.you?.tone).toBe("you");
    expect(couple.partner).toBeNull();
    expect(couple.people).toHaveLength(1);
    expect(couple.loaded).toBe(true);
  });

  it("只有自己时 partner 为 null，people 只有一人", () => {
    const couple = buildCouple([member("a", "小明")], me("a", "小明"));
    expect(couple.partner).toBeNull();
    expect(couple.people).toHaveLength(1);
  });

  it("byId 可按 accountId 查归属，用于打卡标注", () => {
    const couple = buildCouple([member("a", "小明"), member("b", "小红")], me("b", "小红"));
    expect(couple.byId["a"].name).toBe("小明");
    expect(couple.byId["b"].isMe).toBe(true);
  });
});
