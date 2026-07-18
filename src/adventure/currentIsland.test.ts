import { describe, expect, it } from "vitest";
import { selectCurrentIsland } from "./currentIsland";
import type { AdventureChapterView, AdventureState } from "./types";

function ch(sortOrder: number, mapThemeKey: string | null, title: string): AdventureChapterView {
  return { sortOrder, mapThemeKey, title } as AdventureChapterView;
}

function st(over: Partial<AdventureState>): AdventureState {
  return {
    chapters: [],
    highestUnlockedOrder: 0,
    lifetimeEarned: 0,
    claimableCount: 0,
    nextChapter: null,
    claims: [],
    pendingFulfillmentCount: 0,
    ...over
  } as AdventureState;
}

describe("selectCurrentIsland", () => {
  it("空状态回退默认（无岛 key → 柔光态）", () => {
    expect(selectCurrentIsland(null)).toEqual({ key: null, name: "我们的小岛", level: 0 });
    expect(selectCurrentIsland(st({ chapters: [] }))).toEqual({ key: null, name: "我们的小岛", level: 0 });
  });

  it("取世界地图里已到达的最高章节岛", () => {
    const chapters = [
      ch(1, "lighthouse", "灯塔湾"),
      ch(2, "forest", "松语林"),
      ch(3, "market", "集市渡口")
    ];
    const r = selectCurrentIsland(st({ chapters, highestUnlockedOrder: 2 }));
    expect(r.key).toBe("forest");
    expect(r.name).toBe("松语林");
    expect(r.level).toBe(2);
  });

  it("尚未解锁任何章节时取第一章岛", () => {
    const chapters = [ch(1, "lighthouse", "灯塔湾"), ch(2, "forest", "松语林")];
    const r = selectCurrentIsland(st({ chapters, highestUnlockedOrder: 0 }));
    expect(r.key).toBe("lighthouse");
    expect(r.name).toBe("灯塔湾");
    expect(r.level).toBe(1);
  });
});
