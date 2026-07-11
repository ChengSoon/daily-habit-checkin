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
