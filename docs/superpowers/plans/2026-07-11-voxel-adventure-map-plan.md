# 体素 3D 沙盘冒险地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把冒险页重做为全屏实时渲染的体素 3D 沙盘世界：群岛链随关卡生长，平移+缩放固定镜头，全场景 idle 动画与体素解锁仪式。

**Architecture:** 纯函数层（布局/岛屿配方/镜头钳制/仪式时序，vitest 覆盖）与渲染层（@react-three/fiber Canvas，InstancedMesh 按材质合并）严格分离。世界零模型文件、零纹理，全部程序化生成，同种子输出恒定。数据流不变：campaign stations 为唯一数据源，`floor(stationIndex/4)` 定岛、`floor(stationIndex/12)` 定章节门。

**Tech Stack:** Expo 57, React Native 0.86, React 19.2, TypeScript 6, @react-three/fiber v9 (native), three (锁定 0.185.1), expo-gl ~57.0.1, react-native-gesture-handler, vitest。

**设计文档：** `docs/superpowers/specs/2026-07-11-voxel-adventure-map-design.md`（实现前先通读）

## Global Constraints

- 不修改服务端、数据库、`src/adventure/adventureClient.ts`、`adventureRules.ts`
- 新增运行时依赖仅限：`three@0.185.1`（--save-exact）、`@react-three/fiber@^9.6.1`、`expo-gl`（`npx expo install` 对齐 SDK 版本）；dev 依赖 `@types/three`
- 禁止引入 GLTF/纹理/图片资源；世界全部程序化生成
- 所有随机必须来自种子化 RNG（`mulberry32`），禁止 `Math.random()`
- 性能预算：每岛方块 ≤ 900（测试断言）、DPR ≤ 2
- 平台：iOS + Android 渲染 3D；`Platform.OS === "web"` 显示文字版进度卡，不得在 web 上 import expo-gl
- 复用现有约定：`AppText`/`Card`/`IconButton` 控件、`useTheme()` 配色、`spacing`/`radius` 常量、`useReducedMotion`
- 测试命令：`npx vitest run`；lint：`npx expo lint`；类型检查：`npx tsc --noEmit`
- 提交信息格式沿用仓库惯例：`feat(adventure): 中文描述`

---

## File Structure

```
src/adventure/
  seededRandom.ts              # mulberry32 + hashString（新）
  seededRandom.test.ts
  voxelWorldLayout.ts          # 纯函数：stations+progress → 群岛/桥/门/节点/路线坐标（新）
  voxelWorldLayout.test.ts
  voxelIslandRecipes.ts        # 纯函数：岛序号+主题 → 方块清单（新）
  voxelIslandRecipes.test.ts
  cameraMath.ts                # 纯函数：镜头钳制/平移换算/质量降级（新）
  cameraMath.test.ts
  ceremonyTimeline.ts          # 纯函数：解锁仪式时序（新）
  ceremonyTimeline.test.ts
  voxelMaterials.ts            # 材质调色板（浅色/深色 × 章节主题）（新）
  VoxelWorldCanvas.tsx         # r3f 渲染层（新）
  useMapCamera.ts              # 手势 → 相机（新）
  useUnlockCeremony.ts         # 仪式执行 hook（新）
  AdventureWorldScreen.tsx     # 全屏地图 + 悬浮层容器（新）
  AdventureMap.tsx             # 删除（旧 2D 地图）
  adventureMapGeometry.ts      # 删除（旧 2D 几何）
  adventureMapGeometry.test.ts # 删除
app/(tabs)/adventure.tsx       # 重构为全屏地图形态
```

---

### Task 1: 清理拼接版工作区（甄别保留/丢弃）

工作区有大量未提交的"WebP 拼接地图"改动，用户已决定丢弃；但其中混有与地图无关的可保留工作。

**Files:**
- 恢复到 HEAD：`src/adventure/AdventureMap.tsx`、`app/(tabs)/adventure.tsx`、`package.json`、`package-lock.json`、`src/adventure/adventureMapGeometry.ts`、`src/adventure/adventureMapGeometry.test.ts`
- 删除（未跟踪的拼接版文件）：`src/adventure/AdventureChapterGate.tsx`、`AdventureFogLayer.tsx`、`AdventureLandmark.tsx`、`AdventureMapWorld.tsx`、`AdventureRouteSvg.tsx`、`AdventureStationNode.tsx`、`AdventureTravelers.tsx`、`StarIslandSceneSegment.tsx`、`adventureMapAssets.ts`、`adventureMapLayout.ts`、`adventureMapLayout.test.ts`、`adventureMapSceneManifest.ts`、`adventureMapSnapshot.ts`、`adventureMapSnapshot.test.ts`、`adventureRouteGeometry.ts`、`useAdventureMapPresentation.ts`、`assets/adventure-map/`（整个目录）
- 保留并提交（与拼接地图无关）：`src/adventure/adventureUnlockPresentation.ts`、`adventureUnlockPresentation.test.ts`、`src/sync/localSettings.ts`（改动）、`src/sync/localSettings.adventure.test.ts`、`src/ui/useReducedMotion.ts`、`src/adventure/AdventureBadgePicker.tsx`、`AdventureCollection.tsx`、`AdventureStationForm.tsx`、`src/ui/OwnerGate.tsx`（改动）、`tmp/` 两张图的删除、`docs/` 下新增文档

**Interfaces:**
- Produces: 干净的基线——`adventureUnlockPresentation.ts` 的 `createUnlockPresentation / mergeUnlockQueue / advanceUnlockQueue`（Task 10、11 复用）；`src/ui/useReducedMotion.ts` 的 `useReducedMotion(): boolean`（Task 7、10 复用）

- [ ] **Step 1: 恢复拼接版触碰过的共享文件**

```bash
git checkout HEAD -- src/adventure/AdventureMap.tsx "app/(tabs)/adventure.tsx" package.json package-lock.json src/adventure/adventureMapGeometry.ts src/adventure/adventureMapGeometry.test.ts
npm install
```

- [ ] **Step 2: 删除未跟踪的拼接版文件**

```bash
rm src/adventure/AdventureChapterGate.tsx src/adventure/AdventureFogLayer.tsx src/adventure/AdventureLandmark.tsx src/adventure/AdventureMapWorld.tsx src/adventure/AdventureRouteSvg.tsx src/adventure/AdventureStationNode.tsx src/adventure/AdventureTravelers.tsx src/adventure/StarIslandSceneSegment.tsx src/adventure/adventureMapAssets.ts src/adventure/adventureMapLayout.ts src/adventure/adventureMapLayout.test.ts src/adventure/adventureMapSceneManifest.ts src/adventure/adventureMapSnapshot.ts src/adventure/adventureMapSnapshot.test.ts src/adventure/adventureRouteGeometry.ts src/adventure/useAdventureMapPresentation.ts
rm -rf assets/adventure-map
```

- [ ] **Step 3: 确认保留文件不引用已删除模块**

```bash
grep -rn "adventureMapLayout\|adventureMapAssets\|SceneSegment\|adventureMapSceneManifest\|AdventureMapWorld\|adventureRouteGeometry\|useAdventureMapPresentation\|adventureMapSnapshot\|AdventureFogLayer\|AdventureChapterGate" src/ app/ || echo "clean"
```

Expected: 输出 `clean`（无引用残留）。

- [ ] **Step 4: 跑测试与类型检查**

```bash
npx vitest run && npx tsc --noEmit
```

Expected: 全部 PASS，无类型错误。若 `localSettings.adventure.test.ts` 或 `adventureUnlockPresentation.test.ts` 失败，修复其对已删文件的引用（它们不应有；有则说明甄别错误，停下重新检查）。

- [ ] **Step 5: 提交保留的工作 + 加 .gitignore**

`.superpowers/` 与 `docs/assets/generated/` 不入库。在 `.gitignore` 追加（若无）：

```
.superpowers/
docs/assets/generated/
```

```bash
git add -A
git commit -m "chore(adventure): 丢弃拼接版地图实验，保留解锁队列与站点管理改进"
```

---

### Task 2: 安装 3D 渲染依赖

**Files:**
- Modify: `package.json`、`package-lock.json`

**Interfaces:**
- Produces: 可 import 的 `three`、`@react-three/fiber/native`、`expo-gl`；后续所有渲染任务依赖本任务

- [ ] **Step 1: 安装依赖（three 锁定精确版本）**

```bash
npx expo install expo-gl
npm install --save-exact three@0.185.1
npm install @react-three/fiber@^9.6.1
npm install -D @types/three@0.185.0
```

- [ ] **Step 2: 验证安装与现有测试**

```bash
node -e "console.log(require('three/package.json').version, require('@react-three/fiber/package.json').version)"
npx vitest run && npx tsc --noEmit
```

Expected: 打印 `0.185.1 9.x.x`；测试与类型检查通过。

注意：`@types/three@0.185.0` 若不存在该精确版本，用 `npm view @types/three versions` 找最接近 0.185 的版本安装。

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "feat(adventure): 引入 three/@react-three/fiber/expo-gl 3D 渲染依赖"
```

---

### Task 3: 种子化随机 + 世界布局纯函数

**Files:**
- Create: `src/adventure/seededRandom.ts`、`src/adventure/seededRandom.test.ts`
- Create: `src/adventure/voxelWorldLayout.ts`、`src/adventure/voxelWorldLayout.test.ts`

**Interfaces:**
- Consumes: `AdventureStation`、`AdventureProgress`（`src/adventure/types.ts`）
- Produces（后续任务大量引用，签名必须一致）:

```ts
// seededRandom.ts
export function mulberry32(seed: number): () => number;   // 返回 [0,1) 均匀分布
export function hashString(input: string): number;         // 稳定 32 位哈希

// voxelWorldLayout.ts
export const STATIONS_PER_ISLAND = 4;
export const ISLANDS_PER_CHAPTER = 3;
export const ISLAND_SPACING = 24;
export const ISLAND_RADIUS = 7;
export const THEME_COUNT = 5;
export type Vec3 = [number, number, number];
export type IslandPlacement = {
  index: number; center: Vec3; themeIndex: number;
  isTeaser: boolean; fogged: boolean; stationIndexes: number[];
};
export type NodeState = "done" | "current" | "future";
export type NodePlacement = {
  stationIndex: number; stationId: string; islandIndex: number;
  position: Vec3; state: NodeState;
};
export type GatePlacement = { chapterIndex: number; position: Vec3; passed: boolean };
export type BridgePlacement = { fromIsland: number; toIsland: number; start: Vec3; end: Vec3 };
export type CameraBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type VoxelWorldLayout = {
  islands: IslandPlacement[]; nodes: NodePlacement[]; gates: GatePlacement[];
  bridges: BridgePlacement[]; routePoints: Vec3[];
  cameraBounds: CameraBounds; currentNodePosition: Vec3;
};
export function createVoxelWorldLayout(
  stations: AdventureStation[],
  progress: Pick<AdventureProgress, "stationIndex">
): VoxelWorldLayout;
```

布局规则（写进测试）：
- 真实岛数 = `max(1, ceil(stations.length / 4))`，末尾恒追加 1 座 teaser 岛（`isTeaser: true`，无 stations）
- 岛心：`z = -index * ISLAND_SPACING`；`x = (index % 2 === 0 ? -1 : 1) * 8`（左右交错）
- 岛内 4 个节点槽位，本地偏移常量 `LOCAL_NODE_OFFSETS: [number, number][] = [[-3.2, 3.6], [1.8, 1.6], [-1.8, -1.4], [3.0, -3.8]]`，世界坐标 = 岛心 + 偏移，y = 0.75
- 节点状态：`stationIndex < progress.stationIndex` → done；`===` → current；`>` → future；stations 为空时 `currentNodePosition` = 第 0 岛中心上方 `[centerX, 0.75, centerZ]`
- 章节门数量 = `floor(stations.length / 12)`；第 k 门（k 从 1 起）位于岛 `3k-1` 与岛 `3k` 之间桥的中点；`passed = progress.stationIndex >= 12k`
- 岛 `fogged` = 该岛全部 station 的 index > `progress.stationIndex`（teaser 岛恒 fogged）
- 桥：相邻岛之间，`start` = 前岛心沿连线方向推 `ISLAND_RADIUS - 1`，`end` = 后岛心反向推同距离，y = 0.5
- `routePoints` = 按 station 顺序的节点坐标，岛间插入该桥 `start`/`end` 两点
- `cameraBounds`：包含 0 号岛到最近一座 fogged 岛（含 teaser）的所有岛心，四周 padding 14

- [ ] **Step 1: 写 seededRandom 失败测试**

```ts
// src/adventure/seededRandom.test.ts
import { describe, expect, it } from "vitest";
import { hashString, mulberry32 } from "./seededRandom";

describe("mulberry32", () => {
  it("同种子产生相同序列", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("不同种子产生不同序列", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it("输出落在 [0,1)", () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hashString", () => {
  it("相同输入哈希稳定", () => {
    expect(hashString("station-1")).toBe(hashString("station-1"));
  });
  it("不同输入哈希不同", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/adventure/seededRandom.test.ts
```

Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 seededRandom**

```ts
// src/adventure/seededRandom.ts
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
```

- [ ] **Step 4: 跑通 seededRandom 测试**

```bash
npx vitest run src/adventure/seededRandom.test.ts
```

Expected: PASS。

- [ ] **Step 5: 写 voxelWorldLayout 失败测试**

```ts
// src/adventure/voxelWorldLayout.test.ts
import { describe, expect, it } from "vitest";
import type { AdventureStation } from "./types";
import {
  createVoxelWorldLayout,
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
```

- [ ] **Step 6: 运行确认失败**

```bash
npx vitest run src/adventure/voxelWorldLayout.test.ts
```

Expected: FAIL（模块不存在）。

- [ ] **Step 7: 实现 voxelWorldLayout**

```ts
// src/adventure/voxelWorldLayout.ts
import type { AdventureProgress, AdventureStation } from "./types";

export const STATIONS_PER_ISLAND = 4;
export const ISLANDS_PER_CHAPTER = 3;
export const ISLAND_SPACING = 24;
export const ISLAND_RADIUS = 7;
export const THEME_COUNT = 5;
const LATERAL_OFFSET = 8;
const NODE_Y = 0.75;
const BRIDGE_Y = 0.5;
const BOUNDS_PADDING = 14;
const LOCAL_NODE_OFFSETS: [number, number][] = [
  [-3.2, 3.6], [1.8, 1.6], [-1.8, -1.4], [3.0, -3.8]
];

export type Vec3 = [number, number, number];
export type IslandPlacement = {
  index: number; center: Vec3; themeIndex: number;
  isTeaser: boolean; fogged: boolean; stationIndexes: number[];
};
export type NodeState = "done" | "current" | "future";
export type NodePlacement = {
  stationIndex: number; stationId: string; islandIndex: number;
  position: Vec3; state: NodeState;
};
export type GatePlacement = { chapterIndex: number; position: Vec3; passed: boolean };
export type BridgePlacement = { fromIsland: number; toIsland: number; start: Vec3; end: Vec3 };
export type CameraBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type VoxelWorldLayout = {
  islands: IslandPlacement[]; nodes: NodePlacement[]; gates: GatePlacement[];
  bridges: BridgePlacement[]; routePoints: Vec3[];
  cameraBounds: CameraBounds; currentNodePosition: Vec3;
};

function islandCenter(index: number): Vec3 {
  return [(index % 2 === 0 ? -1 : 1) * LATERAL_OFFSET, 0, -index * ISLAND_SPACING];
}

export function createVoxelWorldLayout(
  stations: AdventureStation[],
  progress: Pick<AdventureProgress, "stationIndex">
): VoxelWorldLayout {
  const realIslandCount = Math.max(1, Math.ceil(stations.length / STATIONS_PER_ISLAND));
  const islandCount = realIslandCount + 1;

  const islands: IslandPlacement[] = Array.from({ length: islandCount }, (_, index) => {
    const stationIndexes = stations
      .map((_, stationIndex) => stationIndex)
      .filter((stationIndex) => Math.floor(stationIndex / STATIONS_PER_ISLAND) === index);
    const isTeaser = index === islandCount - 1;
    const fogged = isTeaser ||
      (stationIndexes.length > 0 && stationIndexes.every((s) => s > progress.stationIndex));
    return {
      index,
      center: islandCenter(index),
      themeIndex: Math.floor(index / ISLANDS_PER_CHAPTER) % THEME_COUNT,
      isTeaser,
      fogged,
      stationIndexes
    };
  });

  const nodes: NodePlacement[] = stations.map((station, stationIndex) => {
    const islandIndex = Math.floor(stationIndex / STATIONS_PER_ISLAND);
    const slot = LOCAL_NODE_OFFSETS[stationIndex % STATIONS_PER_ISLAND];
    const center = islands[islandIndex].center;
    const state: NodeState = stationIndex < progress.stationIndex
      ? "done"
      : stationIndex === progress.stationIndex ? "current" : "future";
    return {
      stationIndex,
      stationId: station.id,
      islandIndex,
      position: [center[0] + slot[0], NODE_Y, center[2] + slot[1]],
      state
    };
  });

  const bridges: BridgePlacement[] = [];
  for (let i = 0; i < islandCount - 1; i++) {
    const from = islands[i].center;
    const to = islands[i + 1].center;
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const inset = ISLAND_RADIUS - 1;
    bridges.push({
      fromIsland: i,
      toIsland: i + 1,
      start: [from[0] + ux * inset, BRIDGE_Y, from[2] + uz * inset],
      end: [to[0] - ux * inset, BRIDGE_Y, to[2] - uz * inset]
    });
  }

  const gateCount = Math.floor(stations.length / (STATIONS_PER_ISLAND * ISLANDS_PER_CHAPTER));
  const gates: GatePlacement[] = Array.from({ length: gateCount }, (_, k) => {
    const bridge = bridges[(k + 1) * ISLANDS_PER_CHAPTER - 1];
    const position: Vec3 = [
      (bridge.start[0] + bridge.end[0]) / 2,
      0,
      (bridge.start[2] + bridge.end[2]) / 2
    ];
    return {
      chapterIndex: k,
      position,
      passed: progress.stationIndex >= (k + 1) * STATIONS_PER_ISLAND * ISLANDS_PER_CHAPTER
    };
  });

  const routePoints: Vec3[] = [];
  nodes.forEach((node, i) => {
    if (i > 0 && nodes[i - 1].islandIndex !== node.islandIndex) {
      const bridge = bridges[nodes[i - 1].islandIndex];
      routePoints.push(bridge.start, bridge.end);
    }
    routePoints.push(node.position);
  });

  const firstFogged = islands.find((island) => island.fogged) ?? islands[islandCount - 1];
  const visibleIslands = islands.filter((island) => island.index <= firstFogged.index);
  const xs = visibleIslands.map((island) => island.center[0]);
  const zs = visibleIslands.map((island) => island.center[2]);
  const cameraBounds: CameraBounds = {
    minX: Math.min(...xs) - BOUNDS_PADDING,
    maxX: Math.max(...xs) + BOUNDS_PADDING,
    minZ: Math.min(...zs) - BOUNDS_PADDING,
    maxZ: Math.max(...zs) + BOUNDS_PADDING
  };

  const currentNode = nodes.find((node) => node.state === "current");
  const fallback: Vec3 = [islands[0].center[0], NODE_Y, islands[0].center[2]];
  return {
    islands,
    nodes,
    gates,
    bridges,
    routePoints,
    cameraBounds,
    currentNodePosition: currentNode?.position ?? fallback
  };
}
```

- [ ] **Step 8: 跑通全部测试**

```bash
npx vitest run src/adventure/voxelWorldLayout.test.ts && npx vitest run
```

Expected: PASS。若 `routePoints` 数量断言失败，核对"跨岛时插入桥两端点"的顺序逻辑。

- [ ] **Step 9: 提交**

```bash
git add src/adventure/seededRandom.ts src/adventure/seededRandom.test.ts src/adventure/voxelWorldLayout.ts src/adventure/voxelWorldLayout.test.ts
git commit -m "feat(adventure): 体素世界布局纯函数（群岛/桥/章节门/节点/镜头边界）"
```

---

### Task 4: 岛屿体素配方纯函数

**Files:**
- Create: `src/adventure/voxelIslandRecipes.ts`、`src/adventure/voxelIslandRecipes.test.ts`

**Interfaces:**
- Consumes: `mulberry32`（Task 3）、`ISLAND_RADIUS`（Task 3）
- Produces（Task 7 渲染层的唯一数据来源）:

```ts
export const MAX_BLOCKS_PER_ISLAND = 900;
export type VoxelMaterialKey =
  | "grass" | "grassAlt" | "dirt" | "rock" | "trunk" | "leaf" | "leafAlt"
  | "blossom" | "water" | "path" | "wall" | "roof" | "roofAlt" | "snow" | "flower";
export type VoxelBlock = {
  material: VoxelMaterialKey;
  position: [number, number, number];  // 岛内本地坐标，整数格 + 0.5 对齐
  scale?: [number, number, number];    // 默认 [1,1,1]
};
export type IslandRecipe = {
  ground: VoxelBlock[];    // 平台+小径+地标：静态，全局按材质合并
  foliage: VoxelBlock[];   // 树叶/花：随风摇（每岛独立 InstancedMesh）
  water: VoxelBlock[];     // 水面方块：起伏（每岛独立动态 InstancedMesh）
};
export type LandmarkKind = "castle" | "lighthouse" | "windmill" | "greenhouse" | "observatory";
export function createIslandRecipe(islandIndex: number, themeIndex: number, isTeaser: boolean): IslandRecipe;
export function landmarkForIsland(islandIndex: number): LandmarkKind; // islandIndex % 5 映射
```

配方规则（写进测试）：
- 平台：半径 `ISLAND_RADIUS` 的圆盘。顶层 y=0 为 `grass`/`grassAlt`（随机混合；snow 主题 themeIndex=3 时顶层为 `snow`）；y=-1 为 `dirt`；再往下 2 层 `rock`，半径逐层 -1.5（倒锥形）
- 小径：连接 4 个节点槽位（`LOCAL_NODE_OFFSETS` 复制为本地常量）的直线格子替换为 `path` 材质
- 地标：`landmarkForIsland` 决定种类，摆放在岛心附近固定偏移 `[0, >=1, -2]` 区域，方块数 20-80
- 树：3-6 棵（种子决定），`trunk` 1-2 格 + `leaf`/`leafAlt`/`blossom`（spring 主题 themeIndex=0 用 blossom 概率 0.5）
- 水塘：0-1 个（种子决定），3×3 `water` 方块，y=0，替换该处草地
- teaser 岛：只有平台 + 1 棵树，无地标/小径/水塘（朦胧轮廓）
- 硬性断言：`ground.length + foliage.length + water.length <= MAX_BLOCKS_PER_ISLAND`；所有 position 无重复（同一数组内 `x,y,z` 串键去重后长度不变）

- [ ] **Step 1: 写失败测试**

```ts
// src/adventure/voxelIslandRecipes.test.ts
import { describe, expect, it } from "vitest";
import {
  createIslandRecipe,
  landmarkForIsland,
  MAX_BLOCKS_PER_ISLAND,
  type IslandRecipe
} from "./voxelIslandRecipes";

function allBlocks(recipe: IslandRecipe) {
  return [...recipe.ground, ...recipe.foliage, ...recipe.water];
}

describe("createIslandRecipe", () => {
  it("同参数输出深度相等（确定性）", () => {
    expect(createIslandRecipe(3, 1, false)).toEqual(createIslandRecipe(3, 1, false));
  });

  it("不同岛序号输出不同", () => {
    expect(JSON.stringify(createIslandRecipe(0, 0, false)))
      .not.toBe(JSON.stringify(createIslandRecipe(1, 0, false)));
  });

  it.each([0, 1, 2, 3, 4, 7, 15])("岛 %i 方块总数不超过预算", (islandIndex) => {
    const recipe = createIslandRecipe(islandIndex, islandIndex % 5, false);
    expect(allBlocks(recipe).length).toBeLessThanOrEqual(MAX_BLOCKS_PER_ISLAND);
    expect(allBlocks(recipe).length).toBeGreaterThan(100);
  });

  it("方块位置无重复", () => {
    const recipe = createIslandRecipe(2, 1, false);
    const keys = allBlocks(recipe).map((b) => b.position.join(","));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("包含平台草地与泥土层", () => {
    const recipe = createIslandRecipe(0, 0, false);
    const materials = new Set(recipe.ground.map((b) => b.material));
    expect(materials.has("grass")).toBe(true);
    expect(materials.has("dirt")).toBe(true);
    expect(materials.has("rock")).toBe(true);
    expect(materials.has("path")).toBe(true);
  });

  it("雪主题顶层是雪", () => {
    const recipe = createIslandRecipe(9, 3, false);
    const topLayer = recipe.ground.filter((b) => b.position[1] === 0);
    expect(topLayer.some((b) => b.material === "snow")).toBe(true);
    expect(topLayer.some((b) => b.material === "grass")).toBe(false);
  });

  it("有树（trunk + 树冠）", () => {
    const recipe = createIslandRecipe(1, 1, false);
    expect(recipe.ground.some((b) => b.material === "trunk")).toBe(true);
    expect(recipe.foliage.length).toBeGreaterThan(0);
  });

  it("teaser 岛只有平台和一棵树", () => {
    const recipe = createIslandRecipe(5, 1, true);
    expect(recipe.ground.some((b) => b.material === "path")).toBe(false);
    expect(recipe.water).toHaveLength(0);
    expect(recipe.ground.filter((b) => b.material === "trunk").length).toBeLessThanOrEqual(2);
  });
});

describe("landmarkForIsland", () => {
  it("按岛序号循环五种地标", () => {
    expect(landmarkForIsland(0)).toBe("castle");
    expect(landmarkForIsland(1)).toBe("lighthouse");
    expect(landmarkForIsland(2)).toBe("windmill");
    expect(landmarkForIsland(3)).toBe("greenhouse");
    expect(landmarkForIsland(4)).toBe("observatory");
    expect(landmarkForIsland(5)).toBe("castle");
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/adventure/voxelIslandRecipes.test.ts
```

Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现配方**

实现要点（完整实现由执行者按下述骨架补齐每个 helper，全部为本文件内私有函数，不得引入新依赖）：

```ts
// src/adventure/voxelIslandRecipes.ts
import { mulberry32 } from "./seededRandom";
import { ISLAND_RADIUS } from "./voxelWorldLayout";

export const MAX_BLOCKS_PER_ISLAND = 900;
export type VoxelMaterialKey =
  | "grass" | "grassAlt" | "dirt" | "rock" | "trunk" | "leaf" | "leafAlt"
  | "blossom" | "water" | "path" | "wall" | "roof" | "roofAlt" | "snow" | "flower";
export type VoxelBlock = {
  material: VoxelMaterialKey;
  position: [number, number, number];
  scale?: [number, number, number];
};
export type IslandRecipe = { ground: VoxelBlock[]; foliage: VoxelBlock[]; water: VoxelBlock[] };
export type LandmarkKind = "castle" | "lighthouse" | "windmill" | "greenhouse" | "observatory";

const LANDMARKS: LandmarkKind[] = ["castle", "lighthouse", "windmill", "greenhouse", "observatory"];
const LOCAL_NODE_OFFSETS: [number, number][] = [
  [-3.2, 3.6], [1.8, 1.6], [-1.8, -1.4], [3.0, -3.8]
];

export function landmarkForIsland(islandIndex: number): LandmarkKind {
  return LANDMARKS[islandIndex % LANDMARKS.length];
}

export function createIslandRecipe(
  islandIndex: number,
  themeIndex: number,
  isTeaser: boolean
): IslandRecipe {
  const rand = mulberry32(islandIndex * 7919 + themeIndex * 104729 + 1);
  const occupied = new Set<string>();
  const ground: VoxelBlock[] = [];
  const foliage: VoxelBlock[] = [];
  const water: VoxelBlock[] = [];

  const put = (list: VoxelBlock[], block: VoxelBlock) => {
    const key = block.position.join(",");
    if (occupied.has(key)) return;
    occupied.add(key);
    list.push(block);
  };

  // 1. 平台：顶层 y=0 圆盘 grass/snow，y=-1 dirt，y=-2/-3 rock（半径递减）
  const topMaterialOf = (): VoxelMaterialKey =>
    themeIndex === 3 ? "snow" : rand() < 0.25 ? "grassAlt" : "grass";
  for (let x = -ISLAND_RADIUS; x <= ISLAND_RADIUS; x++) {
    for (let z = -ISLAND_RADIUS; z <= ISLAND_RADIUS; z++) {
      if (x * x + z * z > ISLAND_RADIUS * ISLAND_RADIUS) continue;
      put(ground, { material: topMaterialOf(), position: [x, 0, z] });
      put(ground, { material: "dirt", position: [x, -1, z] });
    }
  }
  for (let layer = 2; layer <= 3; layer++) {
    const r = ISLAND_RADIUS - (layer - 1) * 1.5;
    for (let x = -ISLAND_RADIUS; x <= ISLAND_RADIUS; x++) {
      for (let z = -ISLAND_RADIUS; z <= ISLAND_RADIUS; z++) {
        if (x * x + z * z > r * r) continue;
        put(ground, { material: "rock", position: [x, -layer, z] });
      }
    }
  }

  if (isTeaser) {
    // teaser：仅平台 + 一棵树
    put(ground, { material: "trunk", position: [0, 1, 0] });
    put(foliage, { material: "leaf", position: [0, 2, 0], scale: [1.4, 1.2, 1.4] });
    return { ground, foliage, water };
  }

  // 2. 小径：顶层格子沿节点槽位连线替换为 path（重放 y=0 位置：先删后加——
  //    实现上用 replaceTop helper：从 ground 找到该 (x,0,z) 草块改 material 为 path）
  // 3. 水塘：rand()<0.6 时在与节点/小径不冲突的固定候选区放 3×3 water（替换草地）
  // 4. 树 3-6 棵：位置由 rand 在半径 5 内取整数格，避开小径/节点/水塘/地标区；
  //    trunk y=1..(1|2)，树冠 foliage 5 块十字形，spring(themeIndex 0) 50% 概率 blossom
  // 5. 花 4-8 朵：foliage，scale [0.4,0.4,0.4]
  // 6. 地标 landmarkForIsland(islandIndex)：岛心偏移 [0..2, y>=1, -3..-1] 内摆 wall/roof/roofAlt
  //    五种地标各写一个小函数（castle: 4 塔+主体；lighthouse: 高柱+顶灯；windmill: 塔+十字翼；
  //    greenhouse: wall 框+leafAlt 内芯；observatory: 塔+半球顶），每个 20-80 块

  return { ground, foliage, water };
}
```

上述注释 2-6 必须全部实现为真实代码（本任务测试会逼出 path/trunk/树冠/预算/去重行为；地标五个小函数每个 10-25 行，用 `put(ground, ...)` 摆方块）。

- [ ] **Step 4: 跑通测试**

```bash
npx vitest run src/adventure/voxelIslandRecipes.test.ts && npx vitest run
```

Expected: PASS。重点检查：雪主题断言、teaser 断言、预算上限。

- [ ] **Step 5: 提交**

```bash
git add src/adventure/voxelIslandRecipes.ts src/adventure/voxelIslandRecipes.test.ts
git commit -m "feat(adventure): 岛屿体素配方纯函数（平台/小径/树/水塘/五种地标）"
```

---

### Task 5: 镜头数学纯函数

**Files:**
- Create: `src/adventure/cameraMath.ts`、`src/adventure/cameraMath.test.ts`

**Interfaces:**
- Consumes: `CameraBounds`（Task 3）
- Produces（Task 8、12 使用）:

```ts
export const CAMERA_PITCH_RAD = 0.733;      // 约 42°
export const MIN_CAMERA_DISTANCE = 10;
export const MAX_CAMERA_DISTANCE = 44;
export function clampCameraTarget(x: number, z: number, bounds: CameraBounds): [number, number];
export function clampCameraDistance(distance: number): number;
export function panToWorldDelta(
  dxPx: number, dyPx: number, distance: number, viewportHeightPx: number
): [number, number];                         // 屏幕像素位移 → 世界 XZ 位移
export function cameraPositionFor(target: [number, number, number], distance: number): [number, number, number];
export type QualityTier = 0 | 1 | 2;         // 0 全效果；1 关阴影；2 减装饰
export function nextQualityTier(current: QualityTier, avgFps: number): QualityTier;
```

规则：
- `panToWorldDelta`：拖动一整屏高度 ≈ 平移 `distance * 1.2` 世界单位；屏幕向上拖（dy 为负）→ 世界 -z 方向前进；x 同比例
- `cameraPositionFor`：相机在 target 后方 `+z` 侧，`y = distance * sin(pitch)`，`z = target.z + distance * cos(pitch)`，x 与 target 对齐
- `nextQualityTier`：`avgFps < 38` 升一档（最多 2）；`avgFps > 55` 降一档（最少 0）；其间维持

- [ ] **Step 1: 写失败测试**

```ts
// src/adventure/cameraMath.test.ts
import { describe, expect, it } from "vitest";
import {
  CAMERA_PITCH_RAD,
  cameraPositionFor,
  clampCameraDistance,
  clampCameraTarget,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  nextQualityTier,
  panToWorldDelta
} from "./cameraMath";

const bounds = { minX: -20, maxX: 20, minZ: -100, maxZ: 10 };

describe("clampCameraTarget", () => {
  it("界内不变", () => {
    expect(clampCameraTarget(0, -50, bounds)).toEqual([0, -50]);
  });
  it("越界钳制", () => {
    expect(clampCameraTarget(99, 99, bounds)).toEqual([20, 10]);
    expect(clampCameraTarget(-99, -999, bounds)).toEqual([-20, -100]);
  });
});

describe("clampCameraDistance", () => {
  it("限制在最小最大之间", () => {
    expect(clampCameraDistance(1)).toBe(MIN_CAMERA_DISTANCE);
    expect(clampCameraDistance(999)).toBe(MAX_CAMERA_DISTANCE);
    expect(clampCameraDistance(20)).toBe(20);
  });
});

describe("panToWorldDelta", () => {
  it("整屏高度拖动约等于 1.2 倍距离", () => {
    const [, dz] = panToWorldDelta(0, -800, 20, 800);
    expect(dz).toBeCloseTo(-24, 5);
  });
  it("距离越远平移越快", () => {
    const near = panToWorldDelta(100, 0, MIN_CAMERA_DISTANCE, 800)[0];
    const far = panToWorldDelta(100, 0, MAX_CAMERA_DISTANCE, 800)[0];
    expect(Math.abs(far)).toBeGreaterThan(Math.abs(near));
  });
});

describe("cameraPositionFor", () => {
  it("俯视角度固定", () => {
    const [x, y, z] = cameraPositionFor([0, 0, -10], 20);
    expect(x).toBe(0);
    expect(y).toBeCloseTo(20 * Math.sin(CAMERA_PITCH_RAD), 5);
    expect(z).toBeCloseTo(-10 + 20 * Math.cos(CAMERA_PITCH_RAD), 5);
  });
});

describe("nextQualityTier", () => {
  it("低帧升档", () => {
    expect(nextQualityTier(0, 30)).toBe(1);
    expect(nextQualityTier(1, 30)).toBe(2);
    expect(nextQualityTier(2, 30)).toBe(2);
  });
  it("高帧降档", () => {
    expect(nextQualityTier(2, 60)).toBe(1);
    expect(nextQualityTier(0, 60)).toBe(0);
  });
  it("中间帧率维持", () => {
    expect(nextQualityTier(1, 45)).toBe(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/adventure/cameraMath.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现**

```ts
// src/adventure/cameraMath.ts
import type { CameraBounds } from "./voxelWorldLayout";

export const CAMERA_PITCH_RAD = 0.733;
export const MIN_CAMERA_DISTANCE = 10;
export const MAX_CAMERA_DISTANCE = 44;
const PAN_FACTOR = 1.2;

export function clampCameraTarget(x: number, z: number, bounds: CameraBounds): [number, number] {
  return [
    Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    Math.min(bounds.maxZ, Math.max(bounds.minZ, z))
  ];
}

export function clampCameraDistance(distance: number): number {
  return Math.min(MAX_CAMERA_DISTANCE, Math.max(MIN_CAMERA_DISTANCE, distance));
}

export function panToWorldDelta(
  dxPx: number,
  dyPx: number,
  distance: number,
  viewportHeightPx: number
): [number, number] {
  const scale = (distance * PAN_FACTOR) / viewportHeightPx;
  return [dxPx * scale, dyPx * scale];
}

export function cameraPositionFor(
  target: [number, number, number],
  distance: number
): [number, number, number] {
  return [
    target[0],
    target[1] + distance * Math.sin(CAMERA_PITCH_RAD),
    target[2] + distance * Math.cos(CAMERA_PITCH_RAD)
  ];
}

export type QualityTier = 0 | 1 | 2;

export function nextQualityTier(current: QualityTier, avgFps: number): QualityTier {
  if (avgFps < 38) return Math.min(2, current + 1) as QualityTier;
  if (avgFps > 55) return Math.max(0, current - 1) as QualityTier;
  return current;
}
```

- [ ] **Step 4: 跑通并提交**

```bash
npx vitest run src/adventure/cameraMath.test.ts
git add src/adventure/cameraMath.ts src/adventure/cameraMath.test.ts
git commit -m "feat(adventure): 镜头钳制/平移换算/质量降级纯函数"
```

---

### Task 6: 解锁仪式时序纯函数

**Files:**
- Create: `src/adventure/ceremonyTimeline.ts`、`src/adventure/ceremonyTimeline.test.ts`

**Interfaces:**
- Consumes: `Vec3`、`NodePlacement`、`VoxelWorldLayout`（Task 3）
- Produces（Task 10 执行 hook 的唯一时序来源）:

```ts
export type CeremonyPhase =
  | { kind: "flyTo"; durationMs: number; target: Vec3 }
  | { kind: "islandRise"; durationMs: number; islandIndex: number }
  | { kind: "gateOpen"; durationMs: number; chapterIndex: number }
  | { kind: "walk"; durationMs: number; path: Vec3[] }
  | { kind: "celebrate"; durationMs: number; nodePosition: Vec3 };
export type CeremonyInput = {
  layout: VoxelWorldLayout;
  fromStationIndex: number;   // 仪式前所在关卡
  toStationIndex: number;     // 解锁的目标关卡
  reducedMotion: boolean;
};
export function buildCeremonyTimeline(input: CeremonyInput): CeremonyPhase[];
export function totalCeremonyDuration(phases: CeremonyPhase[]): number;
export function phaseAt(phases: CeremonyPhase[], elapsedMs: number):
  { index: number; phase: CeremonyPhase; phaseElapsedMs: number } | null; // 超时返回 null
```

时序规则（写进测试）：
- `reducedMotion` → 仅 `[{ kind: "celebrate", durationMs: 600, nodePosition }]`
- 常规顺序：`flyTo(900ms)` → 跨岛时 `islandRise(1200ms)`（目标岛 fogged 才有）→ 跨章节门时 `gateOpen(800ms)` → `walk(每个路径点 450ms，路径 = routePoints 中 from 节点到 to 节点之间的所有点)` → `celebrate(1400ms)`
- 不跨岛：无 `islandRise`、无 `gateOpen`
- `phaseAt`: 按累计时长定位当前阶段；elapsed ≥ 总时长 → null

- [ ] **Step 1: 写失败测试**

```ts
// src/adventure/ceremonyTimeline.test.ts
import { describe, expect, it } from "vitest";
import type { AdventureStation } from "./types";
import { buildCeremonyTimeline, phaseAt, totalCeremonyDuration } from "./ceremonyTimeline";
import { createVoxelWorldLayout } from "./voxelWorldLayout";

function station(index: number): AdventureStation {
  return {
    id: `st-${index}`, title: `第 ${index + 1} 站`, sortOrder: index,
    unlockAt: (index + 1) * 6, version: 1, everUnlocked: false,
    reward: {
      xpEnabled: true, xp: 10,
      badgeEnabled: false, badgeTitle: null, badgeImageKey: null, badgeIcon: null, badgeColor: null,
      storyEnabled: false, storyTitle: null, storyBody: null
    }
  };
}

const stations = Array.from({ length: 24 }, (_, i) => station(i));

describe("buildCeremonyTimeline", () => {
  it("reducedMotion 只有 celebrate", () => {
    const layout = createVoxelWorldLayout(stations, { stationIndex: 1 });
    const phases = buildCeremonyTimeline({
      layout, fromStationIndex: 0, toStationIndex: 1, reducedMotion: true
    });
    expect(phases).toHaveLength(1);
    expect(phases[0].kind).toBe("celebrate");
  });

  it("同岛解锁：flyTo → walk → celebrate", () => {
    const layout = createVoxelWorldLayout(stations, { stationIndex: 1 });
    const phases = buildCeremonyTimeline({
      layout, fromStationIndex: 0, toStationIndex: 1, reducedMotion: false
    });
    expect(phases.map((p) => p.kind)).toEqual(["flyTo", "walk", "celebrate"]);
  });

  it("跨岛解锁包含 islandRise", () => {
    const layout = createVoxelWorldLayout(stations, { stationIndex: 4 });
    const phases = buildCeremonyTimeline({
      layout, fromStationIndex: 3, toStationIndex: 4, reducedMotion: false
    });
    expect(phases.map((p) => p.kind)).toEqual(["flyTo", "islandRise", "walk", "celebrate"]);
  });

  it("跨章节门包含 gateOpen", () => {
    const layout = createVoxelWorldLayout(stations, { stationIndex: 12 });
    const phases = buildCeremonyTimeline({
      layout, fromStationIndex: 11, toStationIndex: 12, reducedMotion: false
    });
    expect(phases.map((p) => p.kind)).toEqual(["flyTo", "islandRise", "gateOpen", "walk", "celebrate"]);
  });

  it("walk 路径覆盖 from→to 之间的 routePoints（跨岛含桥点）", () => {
    const layout = createVoxelWorldLayout(stations, { stationIndex: 4 });
    const phases = buildCeremonyTimeline({
      layout, fromStationIndex: 3, toStationIndex: 4, reducedMotion: false
    });
    const walk = phases.find((p) => p.kind === "walk");
    expect(walk && walk.kind === "walk" ? walk.path.length : 0).toBe(3); // 桥start+桥end+目标节点
  });
});

describe("phaseAt / totalCeremonyDuration", () => {
  it("按累计时间定位阶段，结束返回 null", () => {
    const layout = createVoxelWorldLayout(stations, { stationIndex: 1 });
    const phases = buildCeremonyTimeline({
      layout, fromStationIndex: 0, toStationIndex: 1, reducedMotion: false
    });
    expect(phaseAt(phases, 0)?.phase.kind).toBe("flyTo");
    expect(phaseAt(phases, 899)?.phase.kind).toBe("flyTo");
    expect(phaseAt(phases, 900)?.phase.kind).toBe("walk");
    expect(phaseAt(phases, totalCeremonyDuration(phases))).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/adventure/ceremonyTimeline.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现**

```ts
// src/adventure/ceremonyTimeline.ts
import type { Vec3, VoxelWorldLayout } from "./voxelWorldLayout";

const FLY_MS = 900;
const RISE_MS = 1200;
const GATE_MS = 800;
const WALK_MS_PER_POINT = 450;
const CELEBRATE_MS = 1400;
const REDUCED_MS = 600;

export type CeremonyPhase =
  | { kind: "flyTo"; durationMs: number; target: Vec3 }
  | { kind: "islandRise"; durationMs: number; islandIndex: number }
  | { kind: "gateOpen"; durationMs: number; chapterIndex: number }
  | { kind: "walk"; durationMs: number; path: Vec3[] }
  | { kind: "celebrate"; durationMs: number; nodePosition: Vec3 };

export type CeremonyInput = {
  layout: VoxelWorldLayout;
  fromStationIndex: number;
  toStationIndex: number;
  reducedMotion: boolean;
};

function routeIndexOfStation(layout: VoxelWorldLayout, stationIndex: number): number {
  const node = layout.nodes[stationIndex];
  return layout.routePoints.findIndex(
    (p) => p[0] === node.position[0] && p[2] === node.position[2]
  );
}

export function buildCeremonyTimeline(input: CeremonyInput): CeremonyPhase[] {
  const { layout, fromStationIndex, toStationIndex, reducedMotion } = input;
  const toNode = layout.nodes[toStationIndex];
  if (reducedMotion) {
    return [{ kind: "celebrate", durationMs: REDUCED_MS, nodePosition: toNode.position }];
  }
  const fromNode = layout.nodes[fromStationIndex];
  const phases: CeremonyPhase[] = [
    { kind: "flyTo", durationMs: FLY_MS, target: toNode.position }
  ];
  const crossesIsland = fromNode.islandIndex !== toNode.islandIndex;
  if (crossesIsland) {
    phases.push({ kind: "islandRise", durationMs: RISE_MS, islandIndex: toNode.islandIndex });
    const gate = layout.gates.find(
      (g) => (g.chapterIndex + 1) * 3 === toNode.islandIndex
    );
    if (gate) {
      phases.push({ kind: "gateOpen", durationMs: GATE_MS, chapterIndex: gate.chapterIndex });
    }
  }
  const fromRoute = routeIndexOfStation(layout, fromStationIndex);
  const toRoute = routeIndexOfStation(layout, toStationIndex);
  const path = layout.routePoints.slice(fromRoute + 1, toRoute + 1);
  phases.push({ kind: "walk", durationMs: path.length * WALK_MS_PER_POINT, path });
  phases.push({ kind: "celebrate", durationMs: CELEBRATE_MS, nodePosition: toNode.position });
  return phases;
}

export function totalCeremonyDuration(phases: CeremonyPhase[]): number {
  return phases.reduce((sum, phase) => sum + phase.durationMs, 0);
}

export function phaseAt(
  phases: CeremonyPhase[],
  elapsedMs: number
): { index: number; phase: CeremonyPhase; phaseElapsedMs: number } | null {
  let cursor = 0;
  for (let index = 0; index < phases.length; index++) {
    const phase = phases[index];
    if (elapsedMs < cursor + phase.durationMs) {
      return { index, phase, phaseElapsedMs: elapsedMs - cursor };
    }
    cursor += phase.durationMs;
  }
  return null;
}
```

- [ ] **Step 4: 跑通并提交**

```bash
npx vitest run src/adventure/ceremonyTimeline.test.ts && npx vitest run
git add src/adventure/ceremonyTimeline.ts src/adventure/ceremonyTimeline.test.ts
git commit -m "feat(adventure): 解锁仪式时序纯函数（飞行/岛屿浮现/开门/行走/庆祝）"
```

---

### Task 7: 材质调色板 + 静态世界渲染

**Files:**
- Create: `src/adventure/voxelMaterials.ts`
- Create: `src/adventure/VoxelWorldCanvas.tsx`

**Interfaces:**
- Consumes: Task 3/4 的 layout 与 recipe；`useReducedMotion`
- Produces:

```ts
// voxelMaterials.ts
export type ThemePalette = Record<VoxelMaterialKey, string> & {
  sky: string; fogColor: string; sunColor: string; hemiSky: string; hemiGround: string;
};
export function paletteFor(themeIndex: number, dark: boolean): ThemePalette;

// VoxelWorldCanvas.tsx
export type VoxelWorldCanvasProps = {
  layout: VoxelWorldLayout;
  people: { name: string; tone: "primary" | "partner" }[];  // 与 CouplePerson.tone 对齐
  dark: boolean;
  reducedMotion: boolean;
  qualityTier: QualityTier;
  cameraApi: MutableRefObject<MapCameraApi | null>;   // Task 8 定义，本任务先声明类型
  onNodePress: (stationIndex: number) => void;
  ceremony: ActiveCeremony | null;                    // Task 10 定义，本任务先 null
};
export type MapCameraApi = {
  flyTo: (target: [number, number, number], ms: number) => void;
  getTarget: () => [number, number, number];
};
export type ActiveCeremony = { phases: CeremonyPhase[]; startedAt: number; onDone: () => void };
export function VoxelWorldCanvas(props: VoxelWorldCanvasProps): JSX.Element;
```

渲染结构（本任务完成静态部分 + idle 动画；手势/仪式后续任务接入）：
- `<Canvas>`（`@react-three/fiber/native`），`gl={{ antialias: true }}`，onCreated 里 `gl.setPixelRatio(Math.min(PixelRatio.get(), 2))`、设置 `scene.fog`
- 灯光：HemisphereLight + DirectionalLight（`castShadow` 当 `qualityTier === 0`，shadow map 1024）
- 每岛一个 `<IslandGroup>`：
  - `ground` 块 → 按材质分组的 `InstancedMesh`（共享一个 `BoxGeometry(1,1,1)`；用 `useMemo` 按 material 分桶，`setMatrixAt` 一次性写入，`instanceMatrix.needsUpdate = true`）
  - `foliage` 块 → 每岛一个按材质合并的 InstancedMesh 集合，挂在单独 group 上；`useFrame` 里 `group.rotation.z = sin(t*1.5 + islandIndex) * 0.04`（整组微摆 = 风）
  - `water` 块 → 每岛一个 InstancedMesh，`useFrame` 里对每个实例重写矩阵：`y = 基准 + sin(t*2.4 + i*0.8) * 0.08`（数量 ≤ 9，逐帧重写可接受）
  - fogged 岛：整组 `visible` 但材质透明度 0.35 + 顶部一层云方块（cloud 材质 InstancedMesh，drift 动画）；teaser 岛同理更浓
- 路线：`TubeGeometry`（`CatmullRomCurve3(routePoints.map(p => new Vector3(...p)))`，radius 0.14）+ path 材质
- 节点：每个 node 一个 `<mesh>`（`CylinderGeometry`，done=blossom 色 emissive、current=gold+光环 Torus 脉冲、future=rock 色），`onPointerDown={() => onNodePress(node.stationIndex)}`
- 章节门：两柱一梁的方块组 + `passed` 时门洞敞开（无门扇），未通过时门扇 wall 块封住
- 云海：世界外围 8-10 组云（cloud 材质 InstancedMesh），`useFrame` 缓慢漂移
- 化身：两个方块小人（身体+头），色取 `useTheme().colors.primary / partner`（经 props 传入色值，Canvas 内不可用 hooks 访问 ThemeContext——**r3f Canvas 是独立 React 渲染器，Context 不跨越**，所有主题色/回调必须 props 传入）
- `reducedMotion` → 所有 `useFrame` 动画幅度乘 0，静态呈现

- [ ] **Step 1: 实现 voxelMaterials.ts**

```ts
// src/adventure/voxelMaterials.ts
import type { VoxelMaterialKey } from "./voxelIslandRecipes";

export type ThemePalette = Record<VoxelMaterialKey, string> & {
  sky: string; fogColor: string; sunColor: string; hemiSky: string; hemiGround: string;
};

const BASE_LIGHT: Record<VoxelMaterialKey, string> = {
  grass: "#8fdc9f", grassAlt: "#a5e6b1", dirt: "#c9a189", rock: "#b7a8cc",
  trunk: "#9a6b4f", leaf: "#4fb07a", leafAlt: "#6ecb96", blossom: "#f7bcd4",
  water: "#6ec6f5", path: "#eadfc8", wall: "#f4eee2", roof: "#f0907c",
  roofAlt: "#b478e8", snow: "#f2f4fa", flower: "#ffd166"
};

const THEME_TINTS: { sky: string; fogColor: string; sunColor: string; hemiSky: string; hemiGround: string }[] = [
  { sky: "#dceefb", fogColor: "#dceefb", sunColor: "#ffe9c9", hemiSky: "#cde4ff", hemiGround: "#b8e6c2" }, // 春樱·晨光
  { sky: "#cfeef7", fogColor: "#cfeef7", sunColor: "#fff3d1", hemiSky: "#c2ecff", hemiGround: "#a9dcf0" }, // 夏湖·正午
  { sky: "#fbe3cf", fogColor: "#fbe3cf", sunColor: "#ffc9a1", hemiSky: "#ffd9b8", hemiGround: "#e8c9a0" }, // 秋林·日暮
  { sky: "#e4ecf7", fogColor: "#e4ecf7", sunColor: "#eef4ff", hemiSky: "#d8e6f7", hemiGround: "#cfd8ea" }, // 雪山·清冽
  { sky: "#2a2440", fogColor: "#2a2440", sunColor: "#b9c8ff", hemiSky: "#5d5a8f", hemiGround: "#3d3763" }  // 星空·月夜
];

export function paletteFor(themeIndex: number, dark: boolean): ThemePalette {
  const tint = THEME_TINTS[themeIndex % THEME_TINTS.length];
  const nightTint = THEME_TINTS[4];
  const env = dark ? nightTint : tint;
  return { ...BASE_LIGHT, ...env };
}
```

（深色模式复用星空环境光，方块本色不变——体素本色在夜色光照下自然变暗。）

- [ ] **Step 2: 实现 VoxelWorldCanvas.tsx**

按上方"渲染结构"完整实现。骨架（执行者补齐每个子组件的实现，禁止留 TODO）：

```tsx
// src/adventure/VoxelWorldCanvas.tsx
import { Canvas, useFrame } from "@react-three/fiber/native";
import { useMemo, useRef, type MutableRefObject } from "react";
import { PixelRatio } from "react-native";
import * as THREE from "three";
import type { CeremonyPhase } from "./ceremonyTimeline";
import type { QualityTier } from "./cameraMath";
import { createIslandRecipe, type VoxelBlock, type VoxelMaterialKey } from "./voxelIslandRecipes";
import { paletteFor } from "./voxelMaterials";
import type { VoxelWorldLayout } from "./voxelWorldLayout";

export type MapCameraApi = {
  flyTo: (target: [number, number, number], ms: number) => void;
  getTarget: () => [number, number, number];
};
export type ActiveCeremony = { phases: CeremonyPhase[]; startedAt: number; onDone: () => void };
export type VoxelWorldCanvasProps = {
  layout: VoxelWorldLayout;
  people: { name: string; tone: "primary" | "partner" }[];
  avatarColors: { primary: string; partner: string };
  dark: boolean;
  reducedMotion: boolean;
  qualityTier: QualityTier;
  cameraApi: MutableRefObject<MapCameraApi | null>;
  onNodePress: (stationIndex: number) => void;
  ceremony: ActiveCeremony | null;
};

const BOX = new THREE.BoxGeometry(1, 1, 1);

// InstancedBlocks：把 VoxelBlock[] 按材质渲染为一个 InstancedMesh
function InstancedBlocks({ blocks, color, opacity = 1 }: {
  blocks: VoxelBlock[]; color: string; opacity?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useMemo(() => { /* 在 ref 回调/useLayoutEffect 中 setMatrixAt 全部实例 */ }, [blocks]);
  return (
    <instancedMesh ref={ref} args={[BOX, undefined, blocks.length]} castShadow receiveShadow>
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} flatShading />
    </instancedMesh>
  );
}

// IslandGroup / RouteTube / StationNodes / ChapterGates / CloudBanks / Travelers
// —— 均按"渲染结构"一节的规格实现为本文件内组件。
// idle 动画统一在各组件 useFrame 内实现，reducedMotion 时提前 return。

export function VoxelWorldCanvas(props: VoxelWorldCanvasProps) {
  const palette = paletteFor(0, props.dark);
  return (
    <Canvas
      shadows={props.qualityTier === 0}
      gl={{ antialias: true }}
      camera={{ fov: 45, near: 0.1, far: 300 }}
      onCreated={({ gl, scene }) => {
        gl.setPixelRatio(Math.min(PixelRatio.get(), 2));
        scene.fog = new THREE.Fog(new THREE.Color(palette.fogColor), 55, 130);
        scene.background = new THREE.Color(palette.sky);
      }}
    >
      {/* 灯光、岛屿、路线、节点、门、云、化身 */}
    </Canvas>
  );
}
```

实现注意：
- 相机初始化：`position = cameraPositionFor(layout.currentNodePosition, 24)`（Task 5 函数），`lookAt(currentNodePosition)`；本任务相机静止，Task 8 接管
- recipe 结果 `useMemo` 按 `layout.islands` 缓存；ground 桶按材质合并"全部非 fogged 岛"到全局 InstancedMesh（位置 = 本地坐标 + 岛心），fogged 岛单独成组做透明度
- 节点/门/化身数量少，用普通 mesh
- `ceremony` prop 本任务收下但不消费（Task 10 接入），类型先行保证签名稳定

- [ ] **Step 3: 类型与 lint 检查**

```bash
npx tsc --noEmit && npx expo lint
```

Expected: 通过。r3f 的 JSX 元素类型报错时，在 `tsconfig.json` 的 `compilerOptions.types` 加 `"@react-three/fiber"`（v9 自带全局 JSX 声明，通常不需要）。

- [ ] **Step 4: 冒烟验证（模拟器）**

临时把 `app/(tabs)/adventure.tsx` 里 `<AdventureMap …/>` 替换为固定高度的 `<View style={{height: 400}}><VoxelWorldCanvas …/></View>` 跑 `npx expo run:ios`（或 android），确认：世界渲染出来、树摇/云飘/水波动、节点可点（console.log）。**验证后撤销这个临时改动**（Task 11 才正式接线）。

- [ ] **Step 5: 提交**

```bash
git add src/adventure/voxelMaterials.ts src/adventure/VoxelWorldCanvas.tsx
git commit -m "feat(adventure): 体素世界 r3f 渲染层（群岛/路线/节点/门/云/化身 + idle 动画）"
```

---

### Task 8: 相机手势 hook

**Files:**
- Create: `src/adventure/useMapCamera.ts`
- Modify: `src/adventure/VoxelWorldCanvas.tsx`（接入相机控制）

**Interfaces:**
- Consumes: Task 5 全部函数；`react-native-gesture-handler` 的 `Gesture.Pan()/Pinch()/Race/Simultaneous`
- Produces:

```ts
export type MapCameraState = {
  targetX: number; targetZ: number; distance: number;
  flyingTo: { x: number; z: number; startedAt: number; durationMs: number } | null;
};
export function useMapCamera(input: {
  bounds: CameraBounds;
  initialTarget: [number, number, number];
  viewportHeightPx: number;
}): {
  gesture: GestureType;                       // 包在 GestureDetector 外层用
  stateRef: MutableRefObject<MapCameraState>; // Canvas useFrame 每帧读取
  api: MapCameraApi;                          // flyTo / getTarget
};
```

实现规则：
- Pan：`onChange` 里把 `panToWorldDelta(-e.changeX, -e.changeY, distance, viewportHeight)` 累加进 `stateRef`，经 `clampCameraTarget` 钳制；`onEnd` 用 velocity 做惯性（每帧衰减 0.92，也在 useFrame 内消费）
- Pinch：`onChange` 里 `distance = clampCameraDistance(distance / e.scaleChange)`
- 手势对象用 `Gesture.Simultaneous(pan, pinch)`
- `flyTo`：写入 `flyingTo`，Canvas 的 useFrame 里用 easeInOut 插值移动 target，到时清空
- Canvas 侧新增 `<CameraRig stateRef={...}/>` 组件：`useFrame` 读 `stateRef`，`camera.position.set(...cameraPositionFor([x,0,z], distance))` + `camera.lookAt(x, 0.75, z)`
- 全程不 setState——手势数据只走 ref，避免 React 重渲染（设计文档明确要求）

- [ ] **Step 1: 实现 useMapCamera.ts**（按上述规则完整实现，~90 行）

- [ ] **Step 2: VoxelWorldCanvas 接入 CameraRig**

`VoxelWorldCanvasProps` 增加 `cameraStateRef: MutableRefObject<MapCameraState>`；Canvas 内挂 `<CameraRig/>`；`cameraApi.current` 在 mount 时赋值。

- [ ] **Step 3: 类型检查 + 真机手势验证**

```bash
npx tsc --noEmit
```

模拟器验证（沿用 Task 7 的临时挂载方式，外层包 `<GestureDetector gesture={gesture}>`）：拖动平移顺滑、边界拖不出去、双指缩放范围正确、松手有惯性。验证后撤销临时改动。

- [ ] **Step 4: 提交**

```bash
git add src/adventure/useMapCamera.ts src/adventure/VoxelWorldCanvas.tsx
git commit -m "feat(adventure): 沙盘相机手势（平移/缩放/惯性/飞行），ref 直驱不触发重渲染"
```

---### Task 9: 节点信息卡（RN 悬浮层）

**Files:**
- Create: `src/adventure/StationInfoCard.tsx`

**Interfaces:**
- Consumes: `AdventureStation`、`NodeState`（Task 3）、现有 `AppText`/`Card`/`useTheme`/`publicUrl`
- Produces: `export function StationInfoCard({ station, state, unlockAt, onClose }: { station: AdventureStation; state: NodeState; unlockAt: number; onClose: () => void }): JSX.Element` —— Task 11 在屏幕层挂载

- [ ] **Step 1: 实现组件**

绝对定位在屏幕下方的 `Card`：站名、状态徽标（done ✓ / current ★ / future 🔒 + "累计 {unlockAt} 点解锁"）、奖励 chips（badge/XP/story，复用 `adventure.tsx` 现有 `RewardChip` 的展示逻辑——把 `RewardChip` 从 `app/(tabs)/adventure.tsx` 提取到本文件并导出，供两处复用）、右上角关闭按钮。点击遮罩关闭。

- [ ] **Step 2: 类型检查并提交**

```bash
npx tsc --noEmit && npx expo lint
git add src/adventure/StationInfoCard.tsx
git commit -m "feat(adventure): 关卡节点信息卡"
```

---

### Task 10: 解锁仪式执行 hook

**Files:**
- Create: `src/adventure/useUnlockCeremony.ts`
- Modify: `src/adventure/VoxelWorldCanvas.tsx`（消费 ceremony：镜头飞行/岛屿升起/开门/化身行走/庆祝粒子）

**Interfaces:**
- Consumes: Task 6 时序函数、`MapCameraApi`（Task 8）、`useReducedMotion`
- Produces:

```ts
export function useUnlockCeremony(input: {
  layout: VoxelWorldLayout;
  pendingUnlockStationIds: string[];   // 与现有 adventureUnlockPresentation 队列对接
  cameraApi: MutableRefObject<MapCameraApi | null>;
  reducedMotion: boolean;
  onComplete: () => void;              // 全部 pending 播完后调用（对接 completeUnlockPresentation）
}): {
  ceremony: ActiveCeremony | null;     // 传给 VoxelWorldCanvas
  showRewardFor: AdventureStation | null; // celebrate 阶段显示奖励卡
  skip: () => void;                    // 任意手势调用：跳到终态
};
```

行为：
- `pendingUnlockStationIds` 变化时：对每个 id 找到 stationIndex，依序构建 timeline（`from = 上一个 index`）；一次播一个，`phaseAt` 返回 null 后进入下一个；全部播完调用 `onComplete`
- `skip()`：清空当前 timeline，直接调用 onComplete（层展示落到终态——layout 由外层以最新 progress 重算，天然是终态）
- Canvas 内消费：`useFrame` 里按 `phaseAt(phases, now - startedAt)` 驱动——`flyTo` 调 cameraApi、`islandRise` 对目标岛 group 的 `position.y` 从 -18 ease 到 0 且透明度 0.35→1、`gateOpen` 门扇 group 绕柱旋转、`walk` 化身沿 path 插值 + 起跳弧线、`celebrate` 节点上方喷 30 个彩色小方块粒子（InstancedMesh，重力下落 1.4s）

- [ ] **Step 1: 实现 useUnlockCeremony.ts**（时序推进用 `requestAnimationFrame` 时间戳对比，不用 setInterval）

- [ ] **Step 2: VoxelWorldCanvas 接入 ceremony 各阶段的视觉执行**（岛升起/门开/行走/粒子）

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 通过（时序逻辑已被 Task 6 单测覆盖，本任务是执行接线）。

- [ ] **Step 4: 提交**

```bash
git add src/adventure/useUnlockCeremony.ts src/adventure/VoxelWorldCanvas.tsx
git commit -m "feat(adventure): 解锁仪式执行（镜头飞行/岛屿浮现/开门/行走/彩带）"
```

---

### Task 11: 全屏地图页组装

**Files:**
- Create: `src/adventure/AdventureWorldScreen.tsx`
- Modify: `app/(tabs)/adventure.tsx`（重构为全屏形态）
- Delete: `src/adventure/AdventureMap.tsx`、`src/adventure/adventureMapGeometry.ts`、`src/adventure/adventureMapGeometry.test.ts`

**Interfaces:**
- Consumes: 前面所有任务；现有 `adventureUnlockPresentation`、`localSettings`、`useSyncScreen`、`AdventureCollection`、`CoupleAvatars`、`OwnerGate` 路由
- Produces: `export function AdventureWorldScreen(props)` —— tab 页唯一子组件

结构：

```
AdventureWorldScreen
├─ Platform.OS === "web" || glFailed → <StaticProgressFallback>（文字版进度卡）
├─ <GestureDetector gesture={mapCamera.gesture}>
│   └─ <GLErrorBoundary onError={() => setGlFailed(true)}>
│       └─ <VoxelWorldCanvas …全部 props />
├─ 顶部悬浮条（absolute）：章节名 + CoupleAvatars + 行动力胶囊 + 管理/设置 IconButton
├─ "回到当前"悬浮按钮：cameraApi.flyTo(currentNodePosition, 600)
├─ <StationInfoCard>（选中节点时）
├─ 解锁奖励摘要卡（celebrate 阶段）
└─ 底部抽屉（可上滑，Reanimated）：下一站奖励 / 章节进度 / AdventureCollection
```

- [ ] **Step 1: 实现 StaticProgressFallback**（本文件内组件：章节标题 + `stations.map` 简单列表：✓/★/🔒 + unlockAt，滚动可达；web 与 GL 失败共用）

- [ ] **Step 2: 实现 GLErrorBoundary**（类组件 `componentDidCatch` → 调 `props.onError`，渲染 null）

- [ ] **Step 3: 组装 AdventureWorldScreen**

- `VoxelWorldCanvas` 用 `useMemo` 的 `createVoxelWorldLayout(campaign.stations, progress)`；`avatarColors` 取 `useTheme().colors.primary/partner`
- 条件 require 避免 web 打包 GL：`const { VoxelWorldCanvas } = Platform.OS === "web" ? { VoxelWorldCanvas: null } : require("./VoxelWorldCanvas");`
- 空习惯（`habitState.active === 0`）时保留现有 `EmptyState` 分支

- [ ] **Step 4: 重构 app/(tabs)/adventure.tsx**

保留全部数据加载/解锁队列逻辑（`load`、`completeUnlockPresentation` 等原样），JSX 部分换成 `<AdventureWorldScreen …/>` 全屏（外层不再用 `Screen` 的滚动容器，改 `<View style={{flex: 1}}>`）；把 `RewardChip` 迁往 `StationInfoCard.tsx` 后此处 import。

- [ ] **Step 5: 删除旧地图并全量验证**

```bash
rm src/adventure/AdventureMap.tsx src/adventure/adventureMapGeometry.ts src/adventure/adventureMapGeometry.test.ts
grep -rn "AdventureMap\b\|adventureMapGeometry" src/ app/ || echo clean
npx vitest run && npx tsc --noEmit && npx expo lint
```

Expected: `clean`、全部通过。

- [ ] **Step 6: 真机验证**（`npx expo run:ios`）：全屏世界、悬浮层、手势、点节点出卡片、"回到当前"、打卡解锁触发完整仪式、深色模式夜景。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat(adventure): 冒险页重构为全屏体素 3D 沙盘世界"
```

---

### Task 12: 性能窗口化 + 自适应降级 + 失焦暂停

**Files:**
- Modify: `src/adventure/voxelWorldLayout.ts`（+`getVisibleIslandIndexes`）、`voxelWorldLayout.test.ts`
- Modify: `src/adventure/VoxelWorldCanvas.tsx`、`src/adventure/AdventureWorldScreen.tsx`

**Interfaces:**
- Produces: `export function getVisibleIslandIndexes(layout: VoxelWorldLayout, cameraTargetZ: number, margin?: number): number[]`（默认 margin = ISLAND_SPACING * 2.5，返回 z 距离在 margin 内的岛 index）

- [ ] **Step 1: TDD getVisibleIslandIndexes**（测试：镜头在 0 号岛 → 返回 [0,1,2]；镜头在 5 号岛 → [3,4,5,6,7]；镜头越界 → 最近岛仍在列）先红后绿。

- [ ] **Step 2: Canvas 窗口化**：`useFrame` 每 15 帧读一次 cameraStateRef.targetZ 算可见集，变化才 setState；不可见岛整组 `visible=false`（不卸载，保矩阵缓存）；远岛（可见但距离 > ISLAND_SPACING*1.5）只显示 ground，不显示 foliage/water/云

- [ ] **Step 3: 帧率监控与降级**：`useFrame` 累计 60 帧算 avgFps → `nextQualityTier`（Task 5）变化时回调 `onQualityTierChange` 到屏幕层 setState；tier≥1 关 `Canvas shadows`；tier=2 foliage 隐藏 40%（按 index 取模）

- [ ] **Step 4: 失焦暂停**：`AdventureWorldScreen` 用 `useIsFocused()`（`@react-navigation/native`，expo-router 内置）+ `AppState`，非活跃时给 Canvas 传 `frameloop="never"`，恢复时 `"always"`

- [ ] **Step 5: 验证与提交**

```bash
npx vitest run && npx tsc --noEmit && npx expo lint
git add -A
git commit -m "perf(adventure): 岛屿窗口化渲染 + 帧率自适应降级 + 失焦暂停"
```

---

### Task 13: 最终验证与收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-07-11-voxel-adventure-map-design.md`（如实现中有偏离，回写更正）

- [ ] **Step 1: 全量回归**

```bash
npx vitest run && npx tsc --noEmit && npx expo lint
```

Expected: 全绿。

- [ ] **Step 2: 真机验收清单**（逐项确认）

- [ ] 冒险页进入即全屏体素世界，镜头落在当前节点
- [ ] 平移/缩放顺滑，拖不出边界，惯性自然
- [ ] 树摇、云飘、水波、化身浮动、当前节点光环脉冲全部在动
- [ ] 点击节点出信息卡；"回到当前"飞回
- [ ] 打卡解锁：完整仪式（飞行→岛屿浮现→行走→彩带→奖励卡）；连续多关排队播放；手势可跳过
- [ ] 跨章节解锁时章节门打开
- [ ] 深色模式切换为月夜光照
- [ ] 系统"减弱动态效果"开启时无大幅动画
- [ ] iOS 与 Android 各跑一遍；Android 中端机不卡顿（观察降级是否触发）
- [ ] Web（`npx expo start --web`）显示文字版进度卡不崩溃

- [ ] **Step 3: 若有设计偏离，更新 spec 并提交**

```bash
git add -A && git commit -m "docs(adventure): 依实现回写体素地图设计文档"
```

---

## Self-Review 记录

- **Spec 覆盖**：全屏形态(T11)、沙盘手势(T8)、体素群岛/配方(T3/4)、章节门/预告岛/迷雾(T3/7)、idle 动画(T7)、解锁仪式(T6/10)、节点信息卡(T9)、性能窗口化+降级+失焦(T12)、ErrorBoundary/web 占位(T11)、拼接版甄别丢弃(T1)、依赖锁定(T2)、真机验收(T13) —— 无缺口
- **占位符扫描**：Task 4 Step 3 与 Task 7 Step 2 为"骨架+规格"形式，规格均为可执行的具体行为（材质/数量/坐标规则），且被同任务测试逼出，不属于 TBD
- **类型一致性**：`Vec3`/`NodePlacement`/`CameraBounds`/`QualityTier`/`CeremonyPhase`/`MapCameraApi`/`ActiveCeremony` 在各任务 Interfaces 块中签名一致；`LOCAL_NODE_OFFSETS` 在 layout 与 recipes 中重复定义（有意为之，两文件解耦，值必须相同——已在两处写明同一常量值）
