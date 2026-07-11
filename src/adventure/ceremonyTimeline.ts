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
