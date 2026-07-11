/* eslint-disable react/no-unknown-property -- r3f JSX 元素属性非 DOM 属性 */
import { Canvas, useFrame } from "@react-three/fiber/native";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject
} from "react";
import { PixelRatio } from "react-native";
import * as THREE from "three";
import {
  cameraPositionFor,
  clampCameraTarget,
  nextQualityTier,
  type QualityTier
} from "./cameraMath";
import { type CeremonyPhase } from "./ceremonyTimeline";
import type { MapCameraState } from "./useMapCamera";
import {
  createIslandRecipe,
  type VoxelBlock,
  type VoxelMaterialKey
} from "./voxelIslandRecipes";
import { paletteFor, type ThemePalette } from "./voxelMaterials";
import {
  getVisibleIslandIndexes,
  ISLAND_SPACING,
  type GatePlacement,
  type IslandPlacement,
  type NodePlacement,
  type Vec3,
  type VoxelWorldLayout
} from "./voxelWorldLayout";

export type MapCameraApi = {
  flyTo: (target: [number, number, number], ms: number) => void;
  getTarget: () => [number, number, number];
};
export type ActiveCeremony = { phases: CeremonyPhase[]; startedAt: number; onDone: () => void };
export type VoxelWorldCanvasProps = {
  layout: VoxelWorldLayout;
  people: { name: string; tone: "you" | "partner" }[];
  avatarColors: { you: string; partner: string };
  dark: boolean;
  reducedMotion: boolean;
  qualityTier: QualityTier;
  cameraApi: MutableRefObject<MapCameraApi | null>;
  cameraStateRef: MutableRefObject<MapCameraState>;
  onNodePress: (stationIndex: number) => void;
  ceremony: ActiveCeremony | null;
  frameloop?: "always" | "never";
  onQualityTierChange?: (tier: QualityTier) => void;
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const TMP_MATRIX = new THREE.Matrix4();
const TMP_POS = new THREE.Vector3();
const TMP_QUAT = new THREE.Quaternion();
const TMP_SCALE = new THREE.Vector3();
const CLOUD_COLOR_LIGHT = "#ffffff";
const CLOUD_COLOR_DARK = "#6f6a9c";

function writeBlockMatrices(mesh: THREE.InstancedMesh, blocks: VoxelBlock[], offset: Vec3) {
  blocks.forEach((block, i) => {
    TMP_POS.set(
      offset[0] + block.position[0],
      offset[1] + block.position[1],
      offset[2] + block.position[2]
    );
    const s = block.scale ?? [1, 1, 1];
    TMP_SCALE.set(s[0], s[1], s[2]);
    TMP_QUAT.identity();
    TMP_MATRIX.compose(TMP_POS, TMP_QUAT, TMP_SCALE);
    mesh.setMatrixAt(i, TMP_MATRIX);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function InstancedBlocks({ blocks, color, offset = [0, 0, 0], opacity = 1, castShadow = false }: {
  blocks: VoxelBlock[];
  color: string;
  offset?: Vec3;
  opacity?: number;
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (ref.current) writeBlockMatrices(ref.current, blocks, offset);
  }, [blocks, offset]);
  if (blocks.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[BOX, undefined, blocks.length]}
      castShadow={castShadow}
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        flatShading
      />
    </instancedMesh>
  );
}

function groupByMaterial(blocks: VoxelBlock[]): Map<VoxelMaterialKey, VoxelBlock[]> {
  const buckets = new Map<VoxelMaterialKey, VoxelBlock[]>();
  for (const block of blocks) {
    const list = buckets.get(block.material);
    if (list) list.push(block);
    else buckets.set(block.material, [block]);
  }
  return buckets;
}

function SwayingFoliage({ blocks, palette, offset, islandIndex, opacity, reducedMotion }: {
  blocks: VoxelBlock[];
  palette: ThemePalette;
  offset: Vec3;
  islandIndex: number;
  opacity: number;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const buckets = useMemo(() => [...groupByMaterial(blocks).entries()], [blocks]);
  useFrame(({ clock }) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 1.5 + islandIndex) * 0.04;
  });
  return (
    <group ref={groupRef}>
      {buckets.map(([material, list]) => (
        <InstancedBlocks
          key={material}
          blocks={list}
          color={palette[material]}
          offset={offset}
          opacity={opacity}
        />
      ))}
    </group>
  );
}

function RippleWater({ blocks, palette, offset, opacity, reducedMotion }: {
  blocks: VoxelBlock[];
  palette: ThemePalette;
  offset: Vec3;
  opacity: number;
  reducedMotion: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (ref.current) writeBlockMatrices(ref.current, blocks, offset);
  }, [blocks, offset]);
  useFrame(({ clock }) => {
    if (reducedMotion || !ref.current) return;
    const t = clock.elapsedTime;
    blocks.forEach((block, i) => {
      TMP_POS.set(
        offset[0] + block.position[0],
        offset[1] + block.position[1] + Math.sin(t * 2.4 + i * 0.8) * 0.08,
        offset[2] + block.position[2]
      );
      TMP_QUAT.identity();
      TMP_SCALE.set(1, 1, 1);
      TMP_MATRIX.compose(TMP_POS, TMP_QUAT, TMP_SCALE);
      ref.current!.setMatrixAt(i, TMP_MATRIX);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  if (blocks.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[BOX, undefined, blocks.length]}>
      <meshStandardMaterial
        color={palette.water}
        transparent
        opacity={Math.min(0.85, opacity)}
        flatShading
      />
    </instancedMesh>
  );
}

function makeCloudBlocks(seedOffset: number, count: number): VoxelBlock[] {
  // 固定形状的小云团（无随机依赖，形状由 index 派生，恒定）
  const blocks: VoxelBlock[] = [];
  for (let i = 0; i < count; i++) {
    const spread = ((i * 37 + seedOffset * 13) % 5) - 2;
    blocks.push({
      material: "wall",
      position: [i - count / 2, (i * 7 + seedOffset) % 2 === 0 ? 0 : 0, spread * 0.6] as [number, number, number],
      scale: [1.6, 0.8, 1.2]
    });
  }
  return blocks;
}

function IslandClouds({ center, dark, reducedMotion, dense }: {
  center: Vec3;
  dark: boolean;
  reducedMotion: boolean;
  dense: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const blocks = useMemo(() => makeCloudBlocks(Math.abs(Math.round(center[2])), dense ? 6 : 4), [center, dense]);
  useFrame(({ clock }) => {
    if (reducedMotion || !ref.current) return;
    ref.current.position.x = center[0] + Math.sin(clock.elapsedTime * 0.15 + center[2]) * 2;
  });
  return (
    <group ref={ref} position={[center[0], 6, center[2]]}>
      <InstancedBlocks
        blocks={blocks}
        color={dark ? CLOUD_COLOR_DARK : CLOUD_COLOR_LIGHT}
        opacity={dense ? 0.8 : 0.6}
      />
    </group>
  );
}

function IslandGroup({ island, palette, dark, reducedMotion, qualityTier, ceremony, detail }: {
  island: IslandPlacement;
  palette: ThemePalette;
  dark: boolean;
  reducedMotion: boolean;
  qualityTier: QualityTier;
  ceremony: ActiveCeremony | null;
  detail: IslandDetail;
}) {
  const recipe = useMemo(
    () => createIslandRecipe(island.index, island.themeIndex, island.isTeaser),
    [island.index, island.themeIndex, island.isTeaser]
  );
  const groundBuckets = useMemo(() => [...groupByMaterial(recipe.ground).entries()], [recipe]);
  // tier 2：按 index 取模隐藏 40% 树叶/花
  const foliageBlocks = useMemo(
    () => qualityTier >= 2 ? recipe.foliage.filter((_, i) => i % 5 < 3) : recipe.foliage,
    [recipe.foliage, qualityTier]
  );
  const baseOpacity = island.fogged ? 0.35 : 1;
  const groupRef = useRef<THREE.Group>(null);

  // islandRise：目标岛在解锁仪式中从 -18 升到 0
  const risesThisCeremony = ceremony?.phases.some(
    (p) => p.kind === "islandRise" && p.islandIndex === island.index
  ) ?? false;
  useFrame(() => {
    if (!groupRef.current) return;
    if (!risesThisCeremony) {
      groupRef.current.position.y = 0;
      return;
    }
    const { status, t } = ceremonyPhaseProgress(
      ceremony,
      (p) => p.kind === "islandRise" && p.islandIndex === island.index
    );
    if (status === "before") groupRef.current.position.y = -18;
    else if (status === "during") groupRef.current.position.y = -18 + easeInOut(t) * 18;
    else groupRef.current.position.y = 0;
  });

  return (
    <group ref={groupRef} visible={detail !== "hidden"}>
      {groundBuckets.map(([material, list]) => (
        <InstancedBlocks
          key={material}
          blocks={list}
          color={palette[material]}
          offset={island.center}
          opacity={baseOpacity}
          castShadow={qualityTier === 0 && !island.fogged}
        />
      ))}
      {detail === "full" ? (
        <>
          <SwayingFoliage
            blocks={foliageBlocks}
            palette={palette}
            offset={island.center}
            islandIndex={island.index}
            opacity={baseOpacity}
            reducedMotion={reducedMotion}
          />
          <RippleWater
            blocks={recipe.water}
            palette={palette}
            offset={island.center}
            opacity={baseOpacity}
            reducedMotion={reducedMotion}
          />
          {island.fogged ? (
            <IslandClouds
              center={island.center}
              dark={dark}
              reducedMotion={reducedMotion}
              dense={island.isTeaser}
            />
          ) : null}
        </>
      ) : null}
    </group>
  );
}

function RouteTube({ routePoints, palette }: { routePoints: Vec3[]; palette: ThemePalette }) {
  const geometry = useMemo(() => {
    if (routePoints.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(
      routePoints.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    );
    return new THREE.TubeGeometry(curve, routePoints.length * 6, 0.14, 6, false);
  }, [routePoints]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={palette.path} flatShading />
    </mesh>
  );
}

function StationNodeMesh({ node, palette, reducedMotion, onNodePress }: {
  node: NodePlacement;
  palette: ThemePalette;
  reducedMotion: boolean;
  onNodePress: (stationIndex: number) => void;
}) {
  const haloRef = useRef<THREE.Mesh>(null);
  const color = node.state === "done"
    ? palette.blossom
    : node.state === "current" ? "#f5c542" : palette.rock;
  useFrame(({ clock }) => {
    if (node.state !== "current" || !haloRef.current) return;
    if (reducedMotion) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.6) * 0.18;
    haloRef.current.scale.setScalar(pulse);
  });
  return (
    <group position={node.position}>
      <mesh onPointerDown={() => onNodePress(node.stationIndex)}>
        <cylinderGeometry args={[0.55, 0.65, 0.5, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={node.state === "done" ? palette.blossom : "#000000"}
          emissiveIntensity={node.state === "done" ? 0.35 : 0}
          flatShading
        />
      </mesh>
      {node.state === "current" ? (
        <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.35, 0]}>
          <torusGeometry args={[0.9, 0.08, 8, 24]} />
          <meshStandardMaterial color="#f5c542" emissive="#f5c542" emissiveIntensity={0.6} />
        </mesh>
      ) : null}
    </group>
  );
}

function ChapterGateMesh({ gate, palette, ceremony }: {
  gate: GatePlacement;
  palette: ThemePalette;
  ceremony: ActiveCeremony | null;
}) {
  const doorRef = useRef<THREE.Group>(null);
  const opensThisCeremony = ceremony?.phases.some(
    (p) => p.kind === "gateOpen" && p.chapterIndex === gate.chapterIndex
  ) ?? false;
  useFrame(() => {
    if (!doorRef.current || !opensThisCeremony) return;
    const { status, t } = ceremonyPhaseProgress(
      ceremony,
      (p) => p.kind === "gateOpen" && p.chapterIndex === gate.chapterIndex
    );
    // 门扇绕左柱旋转打开
    if (status === "before") doorRef.current.rotation.y = 0;
    else if (status === "during") doorRef.current.rotation.y = -easeInOut(t) * (Math.PI / 2);
    else doorRef.current.rotation.y = -Math.PI / 2;
  });
  // passed 且不在本次仪式中开门 → 门洞敞开无门扇
  const showDoor = !gate.passed || opensThisCeremony;
  return (
    <group position={gate.position}>
      {/* 两柱 */}
      <mesh position={[-1.4, 1.5, 0]}>
        <boxGeometry args={[0.8, 3, 0.8]} />
        <meshStandardMaterial color={palette.wall} flatShading />
      </mesh>
      <mesh position={[1.4, 1.5, 0]}>
        <boxGeometry args={[0.8, 3, 0.8]} />
        <meshStandardMaterial color={palette.wall} flatShading />
      </mesh>
      {/* 横梁 */}
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[4, 0.7, 1]} />
        <meshStandardMaterial color={palette.roof} flatShading />
      </mesh>
      {/* 门扇：铰链在左柱 */}
      {showDoor ? (
        <group ref={doorRef} position={[-1, 0, 0]}>
          <mesh position={[1, 1.4, 0]}>
            <boxGeometry args={[2, 2.8, 0.3]} />
            <meshStandardMaterial color={palette.wall} flatShading />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

const PARTICLE_COUNT = 30;
const PARTICLE_COLORS = ["#f5c542", "#f7bcd4", "#6ec6f5", "#8fdc9f", "#b478e8", "#f0907c"];

function CelebrationParticles({ ceremony }: { ceremony: ActiveCeremony | null }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const celebrate = ceremony?.phases.find(
    (p): p is Extract<CeremonyPhase, { kind: "celebrate" }> => p.kind === "celebrate"
  );
  // 每个粒子的固定初速（由 index 派生，恒定）
  const seeds = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
        const speed = 2.2 + (i % 5) * 0.5;
        return {
          vx: Math.cos(angle) * speed * 0.5,
          vy: 4.5 + (i % 7) * 0.4,
          vz: Math.sin(angle) * speed * 0.5,
          color: PARTICLE_COLORS[i % PARTICLE_COLORS.length]
        };
      }),
    []
  );
  useFrame(() => {
    if (!celebrate || !ceremony) {
      refs.current.forEach((mesh) => mesh && (mesh.visible = false));
      return;
    }
    const { status, t } = ceremonyPhaseProgress(ceremony, (p) => p.kind === "celebrate");
    if (status !== "during") {
      refs.current.forEach((mesh) => mesh && (mesh.visible = false));
      return;
    }
    const seconds = t * (celebrate.durationMs / 1000);
    const [nx, ny, nz] = celebrate.nodePosition;
    seeds.forEach((seed, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      mesh.visible = true;
      mesh.position.set(
        nx + seed.vx * seconds,
        ny + 0.8 + seed.vy * seconds - 4.9 * seconds * seconds,
        nz + seed.vz * seconds
      );
      mesh.rotation.set(seconds * 3 + i, seconds * 2, 0);
    });
  });
  if (!celebrate) return null;
  return (
    <group>
      {seeds.map((seed, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            refs.current[i] = mesh;
          }}
          visible={false}
        >
          <boxGeometry args={[0.22, 0.22, 0.22]} />
          <meshStandardMaterial color={seed.color} emissive={seed.color} emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function CloudBanks({ layout, dark, reducedMotion }: {
  layout: VoxelWorldLayout;
  dark: boolean;
  reducedMotion: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const banks = useMemo(() => {
    const minZ = layout.cameraBounds.minZ - 20;
    const maxZ = layout.cameraBounds.maxZ + 20;
    const result: { position: Vec3; blocks: VoxelBlock[] }[] = [];
    const count = 9;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = minZ + ((maxZ - minZ) * i) / (count - 1);
      result.push({
        position: [side * (26 + (i % 3) * 6), 8 + (i % 4), z],
        blocks: makeCloudBlocks(i, 5)
      });
    }
    return result;
  }, [layout.cameraBounds]);
  useFrame(({ clock }) => {
    if (reducedMotion || !ref.current) return;
    ref.current.position.x = Math.sin(clock.elapsedTime * 0.08) * 3;
  });
  return (
    <group ref={ref}>
      {banks.map((bank, i) => (
        <group key={i} position={bank.position}>
          <InstancedBlocks
            blocks={bank.blocks}
            color={dark ? CLOUD_COLOR_DARK : CLOUD_COLOR_LIGHT}
            opacity={0.55}
          />
        </group>
      ))}
    </group>
  );
}

function Traveler({ basePosition, color, phase, reducedMotion, ceremony }: {
  basePosition: Vec3;
  color: string;
  phase: number;
  reducedMotion: boolean;
  ceremony: ActiveCeremony | null;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    // walk 阶段：沿路径插值 + 起跳弧线
    const walk = ceremony?.phases.find(
      (p): p is Extract<CeremonyPhase, { kind: "walk" }> => p.kind === "walk"
    );
    if (ceremony && walk && walk.path.length > 0) {
      const { status, t } = ceremonyPhaseProgress(ceremony, (p) => p.kind === "walk");
      if (status === "during") {
        const segFloat = t * walk.path.length;
        const segIndex = Math.min(walk.path.length - 1, Math.floor(segFloat));
        const segT = segFloat - segIndex;
        const from = segIndex === 0 ? basePosition : walk.path[segIndex - 1];
        const to = walk.path[segIndex];
        const hop = Math.sin(segT * Math.PI) * 0.5;
        ref.current.position.set(
          from[0] + (to[0] - from[0]) * segT + (phase === 0 ? -0.35 : 0.35),
          from[1] + (to[1] - from[1]) * segT + 0.3 + hop,
          from[2] + (to[2] - from[2]) * segT + 0.6
        );
        return;
      }
      if (status === "after" || status === "before") {
        const rest = status === "after" ? walk.path[walk.path.length - 1] : basePosition;
        const bob = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2 + phase) * 0.12;
        ref.current.position.set(
          rest[0] + (phase === 0 ? -0.7 : 0.7),
          rest[1] + 0.3 + bob,
          rest[2] + 0.6
        );
        return;
      }
    }
    const bob = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2 + phase) * 0.12;
    ref.current.position.set(basePosition[0], basePosition[1] + bob, basePosition[2]);
  });
  return (
    <group ref={ref} position={basePosition}>
      {/* 身体 */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.5, 0.7, 0.35]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      {/* 头 */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color="#ffe0c2" flatShading />
      </mesh>
    </group>
  );
}

function Travelers({ layout, people, avatarColors, reducedMotion, ceremony }: {
  layout: VoxelWorldLayout;
  people: { name: string; tone: "you" | "partner" }[];
  avatarColors: { you: string; partner: string };
  reducedMotion: boolean;
  ceremony: ActiveCeremony | null;
}) {
  const anchor = layout.currentNodePosition;
  return (
    <group>
      {people.map((person, i) => (
        <Traveler
          key={person.tone + person.name}
          basePosition={[anchor[0] + (i === 0 ? -0.7 : 0.7), anchor[1] + 0.3, anchor[2] + 0.6]}
          color={avatarColors[person.tone]}
          phase={i}
          reducedMotion={reducedMotion}
          ceremony={ceremony}
        />
      ))}
    </group>
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// 定位仪式中某类阶段的进度：before（未到）/ during 0..1 / after（已过）
function ceremonyPhaseProgress(
  ceremony: ActiveCeremony | null,
  match: (phase: CeremonyPhase) => boolean
): { status: "none" | "before" | "during" | "after"; t: number; phase: CeremonyPhase | null } {
  if (!ceremony) return { status: "none", t: 0, phase: null };
  const index = ceremony.phases.findIndex(match);
  if (index < 0) return { status: "none", t: 0, phase: null };
  const elapsed = Date.now() - ceremony.startedAt;
  let cursor = 0;
  for (let i = 0; i < index; i++) cursor += ceremony.phases[i].durationMs;
  const phase = ceremony.phases[index];
  if (elapsed < cursor) return { status: "before", t: 0, phase };
  if (elapsed >= cursor + phase.durationMs) return { status: "after", t: 1, phase };
  return { status: "during", t: (elapsed - cursor) / phase.durationMs, phase };
}


function CameraRig({ stateRef, cameraApi }: {
  stateRef: MutableRefObject<MapCameraState>;
  cameraApi: MutableRefObject<MapCameraApi | null>;
}) {
  useFrame(({ camera }, delta) => {
    const s = stateRef.current;

    if (s.flyingTo) {
      const elapsed = Date.now() - s.flyingTo.startedAt;
      const t = Math.min(1, elapsed / s.flyingTo.durationMs);
      const eased = easeInOut(t);
      const startX = s.targetX;
      const startZ = s.targetZ;
      // 以当前位置到目标做线性收敛（每帧向目标推进 eased 比例的剩余量近似）
      s.targetX = startX + (s.flyingTo.x - startX) * eased * 0.25;
      s.targetZ = startZ + (s.flyingTo.z - startZ) * eased * 0.25;
      if (t >= 1) {
        s.targetX = s.flyingTo.x;
        s.targetZ = s.flyingTo.z;
        s.flyingTo = null;
      }
    } else if (s.velocityX !== 0 || s.velocityZ !== 0) {
      // 惯性：每帧按 dt 推进并衰减
      s.targetX += s.velocityX * delta;
      s.targetZ += s.velocityZ * delta;
      [s.targetX, s.targetZ] = clampCameraTarget(s.targetX, s.targetZ, s.bounds);
      const decay = Math.pow(0.92, delta * 60);
      s.velocityX *= decay;
      s.velocityZ *= decay;
      if (Math.abs(s.velocityX) < 0.01 && Math.abs(s.velocityZ) < 0.01) {
        s.velocityX = 0;
        s.velocityZ = 0;
      }
    }

    const pos = cameraPositionFor([s.targetX, 0, s.targetZ], s.distance);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(s.targetX, 0.75, s.targetZ);
  });

  // 首帧确保 api 已挂载（api 由 hook 提供，此处仅占位保证引用不被摇树）
  void cameraApi;
  return null;
}

type IslandDetail = "full" | "groundOnly" | "hidden";

function computeIslandDetails(layout: VoxelWorldLayout, targetZ: number): IslandDetail[] {
  const visible = new Set(getVisibleIslandIndexes(layout, targetZ));
  return layout.islands.map((island) => {
    if (!visible.has(island.index)) return "hidden";
    return Math.abs(island.center[2] - targetZ) > ISLAND_SPACING * 1.5 ? "groundOnly" : "full";
  });
}

// 每 15 帧算一次可见岛集合；每 60 帧算一次平均帧率并回调降级
function FrameGovernor({ layout, cameraStateRef, qualityTier, onDetails, onQualityTierChange }: {
  layout: VoxelWorldLayout;
  cameraStateRef: MutableRefObject<MapCameraState>;
  qualityTier: QualityTier;
  onDetails: (details: IslandDetail[]) => void;
  onQualityTierChange?: (tier: QualityTier) => void;
}) {
  const frameCount = useRef(0);
  const elapsedAccum = useRef(0);
  const lastKey = useRef("");
  useFrame((_, delta) => {
    frameCount.current += 1;
    elapsedAccum.current += delta;
    if (frameCount.current % 15 === 0) {
      const details = computeIslandDetails(layout, cameraStateRef.current.targetZ);
      const key = details.join(",");
      if (key !== lastKey.current) {
        lastKey.current = key;
        onDetails(details);
      }
    }
    if (frameCount.current >= 60) {
      const avgFps = frameCount.current / Math.max(elapsedAccum.current, 1e-6);
      const next = nextQualityTier(qualityTier, avgFps);
      if (next !== qualityTier) onQualityTierChange?.(next);
      frameCount.current = 0;
      elapsedAccum.current = 0;
    }
  });
  return null;
}

export function VoxelWorldCanvas(props: VoxelWorldCanvasProps) {
  const {
    layout, people, avatarColors, dark, reducedMotion, qualityTier,
    cameraApi, cameraStateRef, onNodePress, ceremony,
    frameloop = "always", onQualityTierChange
  } = props;
  const [islandDetails, setIslandDetails] = useState<IslandDetail[]>(() =>
    computeIslandDetails(layout, layout.currentNodePosition[2])
  );
  const currentIsland = layout.islands.find(
    (island) => !island.fogged && !island.isTeaser
  );
  const palette = paletteFor(currentIsland?.themeIndex ?? 0, dark);
  const initialCamera = useMemo(
    () => cameraPositionFor(layout.currentNodePosition, 24),
    [layout.currentNodePosition]
  );
  return (
    <Canvas
      shadows={qualityTier === 0}
      frameloop={frameloop}
      gl={{ antialias: true }}
      camera={{ fov: 45, near: 0.1, far: 300, position: initialCamera }}
      onCreated={({ gl, scene, camera }) => {
        gl.setPixelRatio(Math.min(PixelRatio.get(), 2));
        scene.fog = new THREE.Fog(new THREE.Color(palette.fogColor), 55, 130);
        scene.background = new THREE.Color(palette.sky);
        camera.lookAt(...layout.currentNodePosition);
      }}
    >
      <CameraRig stateRef={cameraStateRef} cameraApi={cameraApi} />
      <FrameGovernor
        layout={layout}
        cameraStateRef={cameraStateRef}
        qualityTier={qualityTier}
        onDetails={setIslandDetails}
        onQualityTierChange={onQualityTierChange}
      />
      <hemisphereLight args={[palette.hemiSky, palette.hemiGround, 0.9]} />
      <directionalLight
        position={[18, 30, 12]}
        color={palette.sunColor}
        intensity={dark ? 0.7 : 1.3}
        castShadow={qualityTier === 0}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      {layout.islands.map((island) => (
        <IslandGroup
          key={island.index}
          island={island}
          palette={palette}
          dark={dark}
          reducedMotion={reducedMotion}
          qualityTier={qualityTier}
          ceremony={ceremony}
          detail={islandDetails[island.index] ?? "full"}
        />
      ))}
      <RouteTube routePoints={layout.routePoints} palette={palette} />
      {layout.nodes.map((node) => (
        <StationNodeMesh
          key={node.stationId}
          node={node}
          palette={palette}
          reducedMotion={reducedMotion}
          onNodePress={onNodePress}
        />
      ))}
      {layout.gates.map((gate) => (
        <ChapterGateMesh key={gate.chapterIndex} gate={gate} palette={palette} ceremony={ceremony} />
      ))}
      <CloudBanks layout={layout} dark={dark} reducedMotion={reducedMotion} />
      <CelebrationParticles ceremony={ceremony} />
      <Travelers
        layout={layout}
        people={people}
        avatarColors={avatarColors}
        reducedMotion={reducedMotion}
        ceremony={ceremony}
      />
    </Canvas>
  );
}
