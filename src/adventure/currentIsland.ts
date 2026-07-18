import type { AdventureState } from "./types";

export type CurrentIsland = {
  /** 岛屿主题 key（lighthouse/forest/…）；无章节时为 null → IslandHero 走柔光态。 */
  key: string | null;
  name: string;
  /** 岛屿等级 = 已解锁章节数（世界地图到达进度）。 */
  level: number;
};

/**
 * 世界地图里"已到达"的岛：最高已解锁章节对应的岛屿。
 * 用于今日 / 我的的共同岛屿卡，让头部岛屿跟随闯关进度，而非写死。
 */
export function selectCurrentIsland(state: AdventureState | null | undefined): CurrentIsland {
  if (!state || state.chapters.length === 0) {
    return { key: null, name: "我们的小岛", level: 0 };
  }
  const reached = [...state.chapters]
    .filter((chapter) => chapter.sortOrder <= state.highestUnlockedOrder)
    .sort((a, b) => b.sortOrder - a.sortOrder)[0];
  const current = reached ?? [...state.chapters].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return {
    key: current.mapThemeKey,
    name: current.title,
    level: Math.max(1, state.highestUnlockedOrder)
  };
}
