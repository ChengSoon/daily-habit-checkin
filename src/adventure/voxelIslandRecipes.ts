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

  const keyOf = (p: [number, number, number]) => p.join(",");
  const put = (list: VoxelBlock[], block: VoxelBlock) => {
    const key = keyOf(block.position);
    if (occupied.has(key)) return;
    occupied.add(key);
    list.push(block);
  };
  const topBlockAt = (x: number, z: number): VoxelBlock | undefined =>
    ground.find((b) => b.position[0] === x && b.position[1] === 0 && b.position[2] === z);

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

  // 记录被占用的顶层格子（节点/小径/水塘/地标），供放树避让
  const reservedTop = new Set<string>();
  const reserve = (x: number, z: number) => reservedTop.add(`${x},${z}`);
  const isReserved = (x: number, z: number) => reservedTop.has(`${x},${z}`);

  const nodeCells = LOCAL_NODE_OFFSETS.map(([x, z]) => [Math.round(x), Math.round(z)] as [number, number]);
  nodeCells.forEach(([x, z]) => reserve(x, z));

  // 2. 小径：顶层格子沿节点槽位连线替换为 path
  const paintPath = (a: [number, number], b: [number, number]) => {
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(a[0] + (b[0] - a[0]) * t);
      const z = Math.round(a[1] + (b[1] - a[1]) * t);
      const top = topBlockAt(x, z);
      if (top) {
        top.material = "path";
        reserve(x, z);
      }
    }
  };
  for (let i = 0; i < nodeCells.length - 1; i++) {
    paintPath(nodeCells[i], nodeCells[i + 1]);
  }

  // 3. 水塘：rand()<0.6 时放 3×3 water（替换草地）
  if (rand() < 0.6) {
    const cx = Math.round((rand() * 2 - 1) * 3);
    const cz = Math.round((rand() * 2 - 1) * 3);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const x = cx + dx;
        const z = cz + dz;
        if (isReserved(x, z)) continue;
        const top = topBlockAt(x, z);
        if (!top) continue;
        top.material = "water";
        // 把顶层水块从 ground 移入 water 列表（保持数据分层）
        const idx = ground.indexOf(top);
        ground.splice(idx, 1);
        water.push(top);
        reserve(x, z);
      }
    }
  }

  // 4. 树 3-6 棵：位置在半径 5 内取整数格，避开小径/节点/水塘/地标区
  const isSpring = themeIndex === 0;
  const treeCount = 3 + Math.floor(rand() * 4);
  let treesPlaced = 0;
  let attempts = 0;
  while (treesPlaced < treeCount && attempts < 60) {
    attempts++;
    const x = Math.round((rand() * 2 - 1) * 5);
    const z = Math.round((rand() * 2 - 1) * 5);
    if (x * x + z * z > 25) continue;
    if (isReserved(x, z)) continue;
    reserve(x, z);
    const trunkHeight = 1 + Math.floor(rand() * 2); // 1..2
    for (let y = 1; y <= trunkHeight; y++) {
      put(ground, { material: "trunk", position: [x, y, z] });
    }
    const crownY = trunkHeight + 1;
    const crownMaterial: VoxelMaterialKey = isSpring && rand() < 0.5
      ? "blossom"
      : rand() < 0.5 ? "leaf" : "leafAlt";
    put(foliage, { material: crownMaterial, position: [x, crownY, z], scale: [1.3, 1.2, 1.3] });
    put(foliage, { material: crownMaterial, position: [x + 1, crownY, z] });
    put(foliage, { material: crownMaterial, position: [x - 1, crownY, z] });
    put(foliage, { material: crownMaterial, position: [x, crownY, z + 1] });
    put(foliage, { material: crownMaterial, position: [x, crownY, z - 1] });
    treesPlaced++;
  }

  // 5. 花 4-8 朵
  const flowerCount = 4 + Math.floor(rand() * 5);
  let flowersPlaced = 0;
  let flowerAttempts = 0;
  while (flowersPlaced < flowerCount && flowerAttempts < 40) {
    flowerAttempts++;
    const x = Math.round((rand() * 2 - 1) * 6);
    const z = Math.round((rand() * 2 - 1) * 6);
    if (x * x + z * z > ISLAND_RADIUS * ISLAND_RADIUS) continue;
    if (isReserved(x, z)) continue;
    const top = topBlockAt(x, z);
    if (!top || top.material === "water" || top.material === "path") continue;
    reserve(x, z);
    put(foliage, { material: "flower", position: [x, 1, z], scale: [0.4, 0.4, 0.4] });
    flowersPlaced++;
  }

  // 6. 地标：岛心附近偏移 [0, y>=1, -2] 区域摆 wall/roof/roofAlt
  buildLandmark(landmarkForIsland(islandIndex), put, ground, rand);

  return { ground, foliage, water };
}

type PutFn = (list: VoxelBlock[], block: VoxelBlock) => void;

function buildLandmark(
  kind: LandmarkKind,
  put: PutFn,
  ground: VoxelBlock[],
  rand: () => number
): void {
  const ox = 0;
  const oz = -2; // 岛心偏北
  const block = (material: VoxelMaterialKey, x: number, y: number, z: number) =>
    put(ground, { material, position: [ox + x, y, oz + z] });

  switch (kind) {
    case "castle": {
      // 主体 3×3×3 + 四角塔
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          for (let y = 1; y <= 3; y++) block("wall", x, y, z);
        }
      }
      const corners: [number, number][] = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
      corners.forEach(([x, z]) => {
        for (let y = 1; y <= 4; y++) block("wall", x, y, z);
        block("roof", x, 5, z);
      });
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) block("roof", x, 4, z);
      break;
    }
    case "lighthouse": {
      for (let y = 1; y <= 6; y++) block(y % 2 === 0 ? "wall" : "roofAlt", 0, y, 0);
      block("roof", 0, 7, 0);
      block("roofAlt", 1, 7, 0);
      block("roofAlt", -1, 7, 0);
      block("roofAlt", 0, 7, 1);
      block("roofAlt", 0, 7, -1);
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) block("rock", x, 0, z);
      break;
    }
    case "windmill": {
      for (let y = 1; y <= 4; y++) block("wall", 0, y, 0);
      block("roof", 0, 5, 0);
      // 十字翼
      for (let d = 1; d <= 2; d++) {
        block("roofAlt", d, 4, 0);
        block("roofAlt", -d, 4, 0);
        block("roofAlt", 0, 4, d);
        block("roofAlt", 0, 4, -d);
      }
      break;
    }
    case "greenhouse": {
      // wall 框 + leafAlt 内芯
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          const edge = Math.abs(x) === 2 || Math.abs(z) === 2;
          for (let y = 1; y <= 2; y++) {
            if (edge) block("wall", x, y, z);
            else block("leafAlt", x, y, z);
          }
        }
      }
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) block("roofAlt", x, 3, z);
      break;
    }
    case "observatory": {
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          for (let y = 1; y <= 3; y++) block("wall", x, y, z);
        }
      }
      // 半球顶
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) block("roof", x, 4, z);
      block("roofAlt", 0, 5, 0);
      break;
    }
  }
  // 用 rand 微调保证不同岛地标略有差异（不新增位置冲突）
  if (rand() < 0.5) block("flower", 2, 1, -2);
}
