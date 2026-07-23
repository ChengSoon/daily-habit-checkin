import { describe, expect, it } from "vitest";
import { buildCouple, shouldApplyCoupleReload } from "./useCouple";
import type { SpaceMember } from "../sync/authService";

const member = (
  id: string,
  displayName: string,
  role: "owner" | "member" = "member",
  avatarKey?: string
): SpaceMember => ({
  id,
  displayName,
  role,
  avatarKey: avatarKey ?? null
});

const me = (id: string, displayName: string, avatarKey?: string) => ({
  id,
  displayName,
  avatarKey: avatarKey ?? null
});

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

  it("成员接口为空时，用 me 携带的头像 key 兜底拼出「你」的头像 URL", () => {
    // /space-members 暂时不可用或还没返回时，只要 /me 带回了头像 key，自己的头像就应显示。
    const couple = buildCouple([], me("b", "小红", "avatars/b/pic.jpg"));
    expect(couple.you?.avatarUrl).toBe("http://r2.test.local/avatars/b/pic.jpg");
  });

  it("没有头像 key 时 avatarUrl 为 null，回退字母头像", () => {
    const couple = buildCouple([], me("b", "小红"));
    expect(couple.you?.avatarUrl).toBeNull();
  });

  it("成员列表的头像 key 优先于 me 携带的", () => {
    // 两处都有头像时以成员列表为准（同一份数据，成员列表更权威）。
    const couple = buildCouple(
      [member("b", "小红", "member", "avatars/b/from-members.jpg")],
      me("b", "小红", "avatars/b/from-me.jpg")
    );
    expect(couple.you?.avatarUrl).toBe("http://r2.test.local/avatars/b/from-members.jpg");
  });
});

describe("shouldApplyCoupleReload", () => {
  it("只允许最新请求在 token 未变化时写入状态", () => {
    expect(shouldApplyCoupleReload({ requestId: 2, latestRequestId: 2, tokenAtStart: "token-a", tokenAtEnd: "token-a" })).toBe(true);
    expect(shouldApplyCoupleReload({ requestId: 1, latestRequestId: 2, tokenAtStart: "token-a", tokenAtEnd: "token-a" })).toBe(false);
    expect(shouldApplyCoupleReload({ requestId: 2, latestRequestId: 2, tokenAtStart: "token-a", tokenAtEnd: "token-b" })).toBe(false);
  });
});
