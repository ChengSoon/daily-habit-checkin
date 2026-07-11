import { describe, expect, it } from "vitest";
import type { AdventureStation } from "./types";
import {
  createVoxelWorldLayout,
  getVisibleIslandIndexes,
  ISLAND_SPACING,
  type VoxelWorldLayout
} from "./voxelWorldLayout";

function station(index: number): AdventureStation {
  return {
    id: `st-${index}`,
    title: `第 ${index + 1} 站`,
    sortOrder: index,
    unlockAt: (index + 1) * 6,
    version: 1,
    everUnlocked: false,
    reward: {
      xpEnabled: true, xp: 10,
      badgeEnabled: false, badgeTitle: null, badgeImageKey: null, badgeIcon: null, badgeColor: null,
      storyEnabled: false, storyTitle: null, storyBody: null
    }
  };
}

function layoutFor(count: number, stationIndex = 0): VoxelWorldLayout {
  return createVoxelWorldLayout(
    Array.from({ length: count }, (_, i) => station(i)),
    { stationIndex }
  );
}

describe("createVoxelWorldLayout", () => {
  it.each([
    [0, 2], [1, 2], [4, 2], [5, 3], [11, 4], [12, 4], [13, 5], [24, 7], [48, 13], [120, 31]
  ])("%i 个关卡产生 %i 座岛（含 teaser）", (count, expected) => {
    expect(layoutFor(count).islands).toHaveLength(expected);
  });

  it.each([
    [0, 0], [11, 0], [12, 1], [13, 1], [24, 2], [25, 2], [48, 4], [120, 10]
  ])("%i 个关卡产生 %i 座章节门", (count, expected) => {
    expect(layoutFor(count).gates).toHaveLength(expected);
  });

  it("岛心 z 坐标严格递减（向北延伸）", () => {
    const { islands } = layoutFor(48);
    for (let i = 1; i < islands.length; i++) {
      expect(islands[i].center[2]).toBe(islands[i - 1].center[2] - ISLAND_SPACING);
    }
  });

  it("末岛是 teaser 且无关卡", () => {
    const { islands } = layoutFor(13);
    const last = islands[islands.length - 1];
    expect(last.isTeaser).toBe(true);
    expect(last.stationIndexes).toHaveLength(0);
    expect(last.fogged).toBe(true);
  });

  it("节点状态按进度划分", () => {
    const { nodes } = layoutFor(8, 3);
    expect(nodes.filter((n) => n.state === "done")).toHaveLength(3);
    expect(nodes.find((n) => n.stationIndex === 3)?.state).toBe("current");
    expect(nodes.filter((n) => n.state === "future")).toHaveLength(4);
  });

  it("进度未达的岛处于 fogged 状态", () => {
    const { islands } = layoutFor(12, 5);
    expect(islands[0].fogged).toBe(false);
    expect(islands[1].fogged).toBe(false);
    expect(islands[2].fogged).toBe(true);
  });

  it("章节门 passed 与进度一致", () => {
    const { gates } = layoutFor(24, 12);
    expect(gates[0].passed).toBe(true);
    expect(gates[1].passed).toBe(false);
  });

  it("桥连接相邻岛", () => {
    const { bridges, islands } = layoutFor(8);
    expect(bridges).toHaveLength(islands.length - 1);
    expect(bridges[0].fromIsland).toBe(0);
    expect(bridges[0].toIsland).toBe(1);
  });

  it("routePoints 数量 = 节点数 + 桥端点数", () => {
    const layout = layoutFor(8, 0);
    const crossedBridges = 1; // 8 关 2 座真实岛，节点跨 1 座桥
    expect(layout.routePoints.length).toBe(8 + crossedBridges * 2);
  });

  it("cameraBounds 包住已解锁岛与 teaser 岛", () => {
    const { cameraBounds, islands } = layoutFor(8, 7);
    const teaser = islands[islands.length - 1];
    expect(cameraBounds.minZ).toBeLessThanOrEqual(teaser.center[2]);
    expect(cameraBounds.maxZ).toBeGreaterThanOrEqual(islands[0].center[2]);
  });

  it("空关卡列表仍返回可用布局", () => {
    const layout = layoutFor(0);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.currentNodePosition[1]).toBe(0.75);
  });

  it("同输入输出深度相等（确定性）", () => {
    expect(layoutFor(24, 5)).toEqual(layoutFor(24, 5));
  });
});

describe("getVisibleIslandIndexes", () => {
  it("镜头在 0 号岛附近返回前几座岛", () => {
    const layout = layoutFor(48);
    expect(getVisibleIslandIndexes(layout, 0)).toEqual([0, 1, 2]);
  });

  it("镜头在 5 号岛返回前后各 2.5 个间距内的岛", () => {
    const layout = layoutFor(48);
    expect(getVisibleIslandIndexes(layout, -5 * ISLAND_SPACING)).toEqual([3, 4, 5, 6, 7]);
  });

  it("镜头越界时最近岛仍在列", () => {
    const layout = layoutFor(8);
    expect(getVisibleIslandIndexes(layout, 500)).toContain(0);
    expect(getVisibleIslandIndexes(layout, -9999)).toContain(layout.islands.length - 1);
  });
});
