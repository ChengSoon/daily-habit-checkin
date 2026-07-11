/* eslint-disable react/no-unknown-property -- r3f JSX 元素属性非 DOM 属性 */
import { Canvas, useFrame } from "@react-three/fiber/native";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject
} from "react";
import { PixelRatio } from "react-native";
import * as THREE from "three";
import { cameraPositionFor, type QualityTier } from "./cameraMath";
import type { CeremonyPhase } from "./ceremonyTimeline";
import {
  createIslandRecipe,
  type VoxelBlock,
  type VoxelMaterialKey
} from "./voxelIslandRecipes";
import { paletteFor, type ThemePalette } from "./voxelMaterials";
import type {
  GatePlacement,
  IslandPlacement,
  NodePlacement,
  Vec3,
  VoxelWorldLayout
} from "./voxelWorldLayout";

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

function IslandGroup({ island, palette, dark, reducedMotion, qualityTier }: {
  island: IslandPlacement;
  palette: ThemePalette;
  dark: boolean;
  reducedMotion: boolean;
  qualityTier: QualityTier;
}) {
  const recipe = useMemo(
    () => createIslandRecipe(island.index, island.themeIndex, island.isTeaser),
    [island.index, island.themeIndex, island.isTeaser]
  );
  const groundBuckets = useMemo(() => [...groupByMaterial(recipe.ground).entries()], [recipe]);
  const opacity = island.fogged ? 0.35 : 1;
  return (
    <group>
      {groundBuckets.map(([material, list]) => (
        <InstancedBlocks
          key={material}
          blocks={list}
          color={palette[material]}
          offset={island.center}
          opacity={opacity}
          castShadow={qualityTier === 0 && !island.fogged}
        />
      ))}
      <SwayingFoliage
        blocks={recipe.foliage}
        palette={palette}
        offset={island.center}
        islandIndex={island.index}
        opacity={opacity}
        reducedMotion={reducedMotion}
      />
      <RippleWater
        blocks={recipe.water}
        palette={palette}
        offset={island.center}
        opacity={opacity}
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

function ChapterGateMesh({ gate, palette }: { gate: GatePlacement; palette: ThemePalette }) {
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
      {/* 未通过时门扇封住 */}
      {!gate.passed ? (
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[2, 2.8, 0.3]} />
          <meshStandardMaterial color={palette.wall} flatShading />
        </mesh>
      ) : null}
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

function Traveler({ basePosition, color, phase, reducedMotion }: {
  basePosition: Vec3;
  color: string;
  phase: number;
  reducedMotion: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
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

function Travelers({ layout, people, avatarColors, reducedMotion }: {
  layout: VoxelWorldLayout;
  people: { name: string; tone: "primary" | "partner" }[];
  avatarColors: { primary: string; partner: string };
  reducedMotion: boolean;
}) {
  const anchor = layout.currentNodePosition;
  return (
    <group>
      {people.map((person, i) => (
        <Traveler
          key={person.tone + person.name}
          basePosition={[anchor[0] + (i === 0 ? -0.7 : 0.7), anchor[1] + 0.3, anchor[2] + 0.6]}
          color={avatarColors[person.tone]}
          phase={i * 1.7}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}

export function VoxelWorldCanvas(props: VoxelWorldCanvasProps) {
  const {
    layout, people, avatarColors, dark, reducedMotion, qualityTier,
    cameraApi, onNodePress
  } = props;
  // ceremony prop 由 Task 10 消费；本任务保持签名稳定
  void props.ceremony;
  void cameraApi;
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
      gl={{ antialias: true }}
      camera={{ fov: 45, near: 0.1, far: 300, position: initialCamera }}
      onCreated={({ gl, scene, camera }) => {
        gl.setPixelRatio(Math.min(PixelRatio.get(), 2));
        scene.fog = new THREE.Fog(new THREE.Color(palette.fogColor), 55, 130);
        scene.background = new THREE.Color(palette.sky);
        camera.lookAt(...layout.currentNodePosition);
      }}
    >
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
        <ChapterGateMesh key={gate.chapterIndex} gate={gate} palette={palette} />
      ))}
      <CloudBanks layout={layout} dark={dark} reducedMotion={reducedMotion} />
      <Travelers
        layout={layout}
        people={people}
        avatarColors={avatarColors}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}
