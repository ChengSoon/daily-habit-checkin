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

export function getVisibleIslandIndexes(
  layout: VoxelWorldLayout,
  cameraTargetZ: number,
  margin: number = ISLAND_SPACING * 2.5
): number[] {
  const visible = layout.islands
    .filter((island) => Math.abs(island.center[2] - cameraTargetZ) <= margin)
    .map((island) => island.index);
  if (visible.length > 0) return visible;
  // 越界：返回 z 距离最近的岛
  let nearest = layout.islands[0];
  for (const island of layout.islands) {
    if (Math.abs(island.center[2] - cameraTargetZ) < Math.abs(nearest.center[2] - cameraTargetZ)) {
      nearest = island;
    }
  }
  return [nearest.index];
}
