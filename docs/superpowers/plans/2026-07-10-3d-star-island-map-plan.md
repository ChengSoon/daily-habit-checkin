# 童话黏土 3D 浮岛地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 将现有平面 AdventureMap 升级为参考图风格的童话黏土 3D 浮岛地图，同时保持动态关卡、累计行动力、双人头像和奖励结算不变。

**Architecture:** 使用 3 套本地 WebP 浮岛场景和 4 套透明地标精灵提供高精度美术；react-native-svg 绘制动态路线和发光底座；React Native View/Image 绘制实时节点、标签、头像和动画。布局与解锁差集保持纯函数，地图使用独立纵向 ScrollView 支持任意关卡数量。

**Tech Stack:** Expo 57, React Native 0.86, TypeScript, expo-image, react-native-svg, React Native Animated, Expo SQLite local_settings, Vitest, imagegen.

---

## File Structure

### Generated and optimized assets

- Reference: docs/assets/prototypes/3d-fairytale-map-reference.png
- Create originals: docs/assets/generated/adventure-map/originals/*.png
- Create derived assets: assets/adventure-map/*.webp

Original PNG and app-ready WebP must remain separate. Generated art must contain no text, UI labels, user avatars, reward icons or baked station states.

### Layout and asset contracts

- Create: src/adventure/adventureMapSceneManifest.ts
  - Scene IDs, normalized safe anchors, path control points, seam overlap and landmark zones.
- Create: src/adventure/adventureMapAssets.ts
  - Static require mappings for scene and landmark WebP files.
- Create: src/adventure/adventureMapLayout.ts
  - Pure campaign-to-layout conversion, route sampling and traveler interpolation.
- Create: src/adventure/adventureMapLayout.test.ts

### Unlock presentation

- Create: src/adventure/adventureUnlockPresentation.ts
  - Claimed/seen difference, initial baseline and animation compression policy.
- Create: src/adventure/adventureUnlockPresentation.test.ts
- Modify: src/sync/localSettings.ts
  - Space/campaign-scoped read and write helpers for seen station IDs.
- Create: src/sync/localSettings.adventure.test.ts

### Rendering

- Rewrite: src/adventure/AdventureMap.tsx
  - Viewport, internal scrolling, auto-positioning and animation orchestration.
- Create: src/adventure/StarIslandSceneSegment.tsx
- Create: src/adventure/AdventureRouteSvg.tsx
- Create: src/adventure/AdventureStationNode.tsx
- Create: src/adventure/AdventureLandmark.tsx
- Create: src/adventure/AdventureTravelers.tsx
- Create: src/ui/useReducedMotion.ts

### Integration

- Modify: app/(tabs)/adventure.tsx
- Modify: package.json
- Modify: package-lock.json
- Modify: docs/superpowers/specs/2026-07-10-3d-star-island-map-design.md only if runtime evidence changes a contract.
- Modify: this plan to record verification evidence.

## Task 1: Generate the Original 3D Art Set

**Files:**
- Reference: docs/assets/prototypes/3d-fairytale-map-reference.png
- Create: docs/assets/generated/adventure-map/originals/scene-castle.png
- Create: docs/assets/generated/adventure-map/originals/scene-waterfall.png
- Create: docs/assets/generated/adventure-map/originals/scene-camp.png
- Create: docs/assets/generated/adventure-map/originals/landmark-lighthouse.png
- Create: docs/assets/generated/adventure-map/originals/landmark-bridge.png
- Create: docs/assets/generated/adventure-map/originals/landmark-observatory.png
- Create: docs/assets/generated/adventure-map/originals/landmark-garden.png

- [ ] **Step 1: Invoke the imagegen skill and inspect the persisted reference**

Use the imagegen skill before generating any raster asset. Inspect:

    docs/assets/prototypes/3d-fairytale-map-reference.png

The reference supplies only visual language. Do not copy its exact island silhouette, castle arrangement, route or UI.

- [ ] **Step 2: Generate the castle scene original**

Use this complete prompt:

    Create an original portrait 3D clay-diorama floating-island game-map background.
    Match the visual language of the provided reference: rounded toy-like forms,
    pastel cream, cherry pink, lavender, fresh green and pale aqua, soft morning
    haze, warm rim light, low-contrast global illumination, premium mobile game art.
    Use a three-quarter top-down isometric camera. Feature a fairy-tale castle on
    the upper-right highland, flower gardens, soft trees, small rocks and clouds.
    Include a broad winding dirt trail with exactly four visibly clear, empty
    circular safe areas suitable for dynamic UI overlays. Keep the safe areas near
    normalized coordinates (0.25,0.80), (0.48,0.61), (0.66,0.40), (0.76,0.20).
    Fade the top and bottom edges into lavender-white cloud banks so vertical map
    segments can overlap. No text, letters, numbers, symbols, buttons, glowing
    pedestals, route markers, people, avatars or interface chrome. No watermark.
    Portrait composition, consistent lighting from upper-left.

Save the untouched output as:

    docs/assets/generated/adventure-map/originals/scene-castle.png

- [ ] **Step 3: Generate waterfall and camp scene originals**

Use the same common style, camera, safe-area coordinates, edge clouds and negative constraints.

Waterfall variant prompt addition:

    Replace the castle with a layered cliff, bright aqua river, waterfall, small
    stone bridge, flower meadow and distant cloud islands. Preserve four empty
    safe areas and a winding traversable trail.

Camp variant prompt addition:

    Replace the castle with a cozy pink-roof cottage, small campsite, orchard,
    flower field, curved stream and rest platform. Preserve four empty safe areas
    and a winding traversable trail.

Save as scene-waterfall.png and scene-camp.png under the originals directory.

- [ ] **Step 4: Generate four transparent landmark originals**

Generate each as a separate transparent-background PNG with the same camera and upper-left lighting:

    Original miniature clay-diorama <LANDMARK>, three-quarter top-down isometric
    view, rounded premium mobile game style, pastel cream/pink/lavender/green,
    soft shadow directly beneath the object, isolated transparent background,
    centered with generous clear padding. No circular base, no text, no UI,
    no icon, no person, no watermark.

Replace LANDMARK with:

    small moonlit lighthouse
    elegant crystal footbridge
    tiny domed star observatory
    whimsical cloud garden pavilion

- [ ] **Step 5: Inspect every original at full detail**

Use view_image with original detail. Reject and regenerate any output containing:

- Baked text, numbers or icons.
- A person, avatar or button.
- A building inside one of the four safe areas.
- Cropped terrain or a hard top/bottom edge.
- Inconsistent camera direction or lighting.

- [ ] **Step 6: Optional checkpoint commit after user approval**

Do not commit automatically. If the user approves Git history changes:

    git add docs/assets/generated/adventure-map/originals docs/assets/prototypes/3d-fairytale-map-reference.png
    git commit -m "feat(adventure): 生成3D地图原始美术"

## Task 2: Optimize Assets and Install SVG Support

**Files:**
- Create: assets/adventure-map/*.webp
- Modify: package.json
- Modify: package-lock.json

- [ ] **Step 1: Create the app asset directory**

Run:

    mkdir -p assets/adventure-map

- [ ] **Step 2: Crop and encode the three scene assets**

For each scene:

    sips -c 1216 1024 docs/assets/generated/adventure-map/originals/scene-castle.png --out /tmp/scene-castle-crop.png
    cwebp -quiet -q 82 -m 6 -resize 1024 1216 /tmp/scene-castle-crop.png -o assets/adventure-map/scene-castle.webp

Repeat for scene-waterfall and scene-camp.

Expected:

- Dimensions: 1024 × 1216.
- Each file is below 700 KB.
- The scene remains readable at 390 px display width.

- [ ] **Step 3: Encode transparent landmark assets**

For each landmark:

    cwebp -quiet -q 86 -alpha_q 100 -m 6 -resize 384 384 docs/assets/generated/adventure-map/originals/landmark-lighthouse.png -o assets/adventure-map/landmark-lighthouse.webp

Repeat for bridge, observatory and garden.

Expected: each file is below 150 KB and retains transparent padding.

- [ ] **Step 4: Verify dimensions, MIME and budgets**

Run:

    file assets/adventure-map/*.webp
    du -h assets/adventure-map/*.webp

Expected: 7 valid WebP files; no scene exceeds 700 KB; no landmark exceeds 150 KB.

- [ ] **Step 5: Install the Expo-compatible SVG dependency**

Run:

    npx expo install react-native-svg

Expected: package.json and package-lock.json add the Expo-compatible react-native-svg version.

- [ ] **Step 6: Verify dependency resolution**

Run:

    npm ls react-native-svg
    npx tsc --noEmit

Expected: react-native-svg resolves once and TypeScript exits 0.

- [ ] **Step 7: Optional checkpoint commit after user approval**

    git add assets/adventure-map package.json package-lock.json
    git commit -m "feat(adventure): 添加3D地图美术资源"

## Task 3: Scene Manifest Contract

**Files:**
- Create: src/adventure/adventureMapSceneManifest.ts
- Create: src/adventure/adventureMapAssets.ts
- Test: src/adventure/adventureMapLayout.test.ts

- [ ] **Step 1: Write the failing manifest test**

Create src/adventure/adventureMapLayout.test.ts:

~~~ts
import { describe, expect, it } from "vitest";
import { SCENE_PRESETS } from "./adventureMapSceneManifest";

describe("adventure scene manifest", () => {
  it("defines three scenes with four safe anchors and overlap metadata", () => {
    expect(SCENE_PRESETS.map((preset) => preset.id)).toEqual([
      "castle",
      "waterfall",
      "camp"
    ]);
    for (const preset of SCENE_PRESETS) {
      expect(preset.stationAnchors).toHaveLength(4);
      expect(preset.overlapPx).toBe(40);
      expect(preset.stationAnchors.every((point) =>
        point.x > 0 && point.x < 1 && point.y > 0 && point.y < 1
      )).toBe(true);
    }
  });
});
~~~

- [ ] **Step 2: Run the manifest test and verify RED**

Run:

    npm test -- src/adventure/adventureMapLayout.test.ts

Expected: FAIL because adventureMapSceneManifest.ts does not exist.

- [ ] **Step 3: Implement the geometry-only manifest**

Create src/adventure/adventureMapSceneManifest.ts:

~~~ts
export type NormalizedPoint = { x: number; y: number };
export type SceneId = "castle" | "waterfall" | "camp";
export type LandmarkId = "lighthouse" | "bridge" | "observatory" | "garden";

export type AdventureScenePreset = {
  id: SceneId;
  stationAnchors: readonly [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint];
  entryAnchor: NormalizedPoint;
  exitAnchor: NormalizedPoint;
  landmarkOffset: NormalizedPoint;
  overlapPx: number;
};

export const SCENE_PRESETS: readonly AdventureScenePreset[] = [
  {
    id: "castle",
    entryAnchor: { x: 0.18, y: 0.94 },
    stationAnchors: [
      { x: 0.25, y: 0.80 },
      { x: 0.48, y: 0.61 },
      { x: 0.66, y: 0.40 },
      { x: 0.76, y: 0.20 }
    ],
    exitAnchor: { x: 0.70, y: 0.04 },
    landmarkOffset: { x: 0.09, y: -0.08 },
    overlapPx: 40
  },
  {
    id: "waterfall",
    entryAnchor: { x: 0.76, y: 0.94 },
    stationAnchors: [
      { x: 0.72, y: 0.80 },
      { x: 0.58, y: 0.61 },
      { x: 0.38, y: 0.40 },
      { x: 0.26, y: 0.20 }
    ],
    exitAnchor: { x: 0.30, y: 0.04 },
    landmarkOffset: { x: -0.10, y: -0.08 },
    overlapPx: 40
  },
  {
    id: "camp",
    entryAnchor: { x: 0.20, y: 0.94 },
    stationAnchors: [
      { x: 0.28, y: 0.80 },
      { x: 0.60, y: 0.62 },
      { x: 0.68, y: 0.41 },
      { x: 0.45, y: 0.20 }
    ],
    exitAnchor: { x: 0.42, y: 0.04 },
    landmarkOffset: { x: 0.10, y: -0.08 },
    overlapPx: 40
  }
];
~~~

- [ ] **Step 4: Add static require mappings separately from geometry**

Create src/adventure/adventureMapAssets.ts:

~~~ts
import type { LandmarkId, SceneId } from "./adventureMapSceneManifest";

export const SCENE_ASSETS: Record<SceneId, number> = {
  castle: require("../../assets/adventure-map/scene-castle.webp"),
  waterfall: require("../../assets/adventure-map/scene-waterfall.webp"),
  camp: require("../../assets/adventure-map/scene-camp.webp")
};

export const LANDMARK_ASSETS: Record<LandmarkId, number> = {
  lighthouse: require("../../assets/adventure-map/landmark-lighthouse.webp"),
  bridge: require("../../assets/adventure-map/landmark-bridge.webp"),
  observatory: require("../../assets/adventure-map/landmark-observatory.webp"),
  garden: require("../../assets/adventure-map/landmark-garden.webp")
};
~~~

- [ ] **Step 5: Run the test and type check**

Run:

    npm test -- src/adventure/adventureMapLayout.test.ts
    npx tsc --noEmit

Expected: test PASS and TypeScript exits 0.

- [ ] **Step 6: Optional checkpoint commit after user approval**

    git add src/adventure/adventureMapSceneManifest.ts src/adventure/adventureMapAssets.ts src/adventure/adventureMapLayout.test.ts
    git commit -m "feat(adventure): 定义3D场景布局契约"

## Task 4: Dynamic Layout Engine

**Files:**
- Create: src/adventure/adventureMapLayout.ts
- Modify: src/adventure/adventureMapLayout.test.ts
- Remove after migration: src/adventure/adventureMapGeometry.ts
- Remove after migration: src/adventure/adventureMapGeometry.test.ts

- [ ] **Step 1: Add failing layout tests**

Append:

~~~ts
import { createAdventureMapLayout } from "./adventureMapLayout";
import type { AdventureStation } from "./types";

function station(index: number): AdventureStation {
  return {
    id: "station-" + index,
    title: "关卡 " + index,
    sortOrder: index,
    unlockAt: (index + 1) * 6,
    version: 1,
    everUnlocked: index < 2,
    reward: {
      xpEnabled: false,
      xp: 0,
      badgeEnabled: true,
      badgeTitle: "徽章 " + index,
      badgeImageKey: null,
      badgeIcon: "star",
      badgeColor: "#E9507A",
      storyEnabled: false,
      storyTitle: null,
      storyBody: null
    }
  };
}

it("extends vertically and starts a second scene after four stations", () => {
  const layout = createAdventureMapLayout(
    Array.from({ length: 5 }, (_, index) => station(index)),
    { stationIndex: 2, segmentPoints: 3, segmentCost: 6 },
    360
  );

  expect(layout.segments).toHaveLength(2);
  expect(layout.stations[0].segmentIndex).toBe(0);
  expect(layout.stations[4].segmentIndex).toBe(1);
  expect(layout.contentHeight).toBeGreaterThan(520);
});

it("supports an empty route and a zero-cost traveler segment", () => {
  const layout = createAdventureMapLayout(
    [],
    { stationIndex: 0, segmentPoints: 0, segmentCost: 0 },
    360
  );

  expect(layout.stations).toEqual([]);
  expect(layout.traveler).toEqual(layout.start);
  expect(Number.isFinite(layout.traveler.x)).toBe(true);
});
~~~

- [ ] **Step 2: Run layout tests and verify RED**

Run:

    npm test -- src/adventure/adventureMapLayout.test.ts

Expected: FAIL because createAdventureMapLayout is missing.

- [ ] **Step 3: Implement layout types and scene placement**

Create src/adventure/adventureMapLayout.ts with these public types:

~~~ts
import { SCENE_PRESETS, type LandmarkId, type NormalizedPoint, type SceneId } from "./adventureMapSceneManifest";
import type { AdventureStation } from "./types";

export const MAP_VIEWPORT_HEIGHT = 520;
export const SCENE_HEIGHT = 430;
export const STATIONS_PER_SCENE = 4;

export type MapProgressInput = {
  stationIndex: number;
  segmentPoints: number;
  segmentCost: number;
};

export type ScenePlacement = {
  id: string;
  sceneId: SceneId;
  index: number;
  mirrored: boolean;
  top: number;
  height: number;
};

export type StationPlacement = {
  station: AdventureStation;
  routeIndex: number;
  segmentIndex: number;
  point: { x: number; y: number };
  labelSide: "left" | "right";
  landmarkId: LandmarkId;
};

export type AdventureMapLayout = {
  contentHeight: number;
  segments: ScenePlacement[];
  start: { x: number; y: number };
  stations: StationPlacement[];
  routePoints: { x: number; y: number }[];
  routeLength: number;
  traveler: { x: number; y: number };
  currentOffsetY: number;
};
~~~

Implementation rules:

- segmentCount is max(1, ceil(stations.length / 4)).
- Segment 0 is placed at the bottom; later segments extend upward.
- Effective segment stride is SCENE_HEIGHT - overlapPx.
- Multiply normalized x by viewportWidth and normalized y by SCENE_HEIGHT.
- Alternate mirrored for every second full preset cycle, not every station.
- Landmark IDs cycle lighthouse, bridge, observatory, garden.
- Build routePoints as start plus station placements in campaign order.
- Compute routeLength as the sum of Euclidean distances between route points.
- Interpolate traveler between routePoints[stationIndex] and routePoints[stationIndex + 1].
- When segmentCost is 0 or the next point is missing, return the current point.
- currentOffsetY clamps traveler.y - MAP_VIEWPORT_HEIGHT * 0.62 into the scrollable range.

- [ ] **Step 4: Run layout tests and add the 30-station case**

Add:

~~~ts
it("keeps thirty stations inside finite scene bounds", () => {
  const layout = createAdventureMapLayout(
    Array.from({ length: 30 }, (_, index) => station(index)),
    { stationIndex: 12, segmentPoints: 1, segmentCost: 8 },
    360
  );

  expect(layout.segments).toHaveLength(8);
  expect(layout.stations).toHaveLength(30);
  expect(layout.stations.every(({ point }) =>
    point.x >= 0 && point.x <= 360 && point.y >= 0 && point.y <= layout.contentHeight
  )).toBe(true);
});
~~~

Run:

    npm test -- src/adventure/adventureMapLayout.test.ts

Expected: all manifest/layout tests PASS.

- [ ] **Step 5: Remove the fixed single-screen geometry only after imports are gone**

Delete adventureMapGeometry.ts and its test after AdventureMap no longer imports them in Task 7.

- [ ] **Step 6: Optional checkpoint commit after user approval**

    git add src/adventure/adventureMapLayout.ts src/adventure/adventureMapLayout.test.ts
    git commit -m "feat(adventure): 支持动态3D地图布局"

## Task 5: Seen Unlock State and Animation Policy

**Files:**
- Create: src/adventure/adventureUnlockPresentation.ts
- Create: src/adventure/adventureUnlockPresentation.test.ts
- Modify: src/sync/localSettings.ts
- Create: src/sync/localSettings.adventure.test.ts

- [ ] **Step 1: Write failing pure presentation tests**

Create adventureUnlockPresentation.test.ts:

~~~ts
import { describe, expect, it } from "vitest";
import {
  createUnlockPresentation,
  getUnlockAnimationPlan
} from "./adventureUnlockPresentation";

describe("adventure unlock presentation", () => {
  it("establishes a first-load baseline without replaying history", () => {
    expect(createUnlockPresentation(["a", "b"], null, ["a", "b", "c"])).toEqual({
      pendingStationIds: [],
      nextSeenStationIds: ["a", "b"]
    });
  });

  it("orders unseen claims by campaign order", () => {
    expect(createUnlockPresentation(["c", "a", "b"], ["a"], ["a", "b", "c"])).toEqual({
      pendingStationIds: ["b", "c"],
      nextSeenStationIds: ["a", "b", "c"]
    });
  });

  it("compresses long unlock queues and respects reduced motion", () => {
    expect(getUnlockAnimationPlan(1, false)).toEqual({ mode: "full", durationMs: 1600 });
    expect(getUnlockAnimationPlan(3, false)).toEqual({ mode: "sequence", durationMs: 1500 });
    expect(getUnlockAnimationPlan(4, false)).toEqual({ mode: "sweep", durationMs: 1200 });
    expect(getUnlockAnimationPlan(1, true)).toEqual({ mode: "reduced", durationMs: 250 });
  });
});
~~~

- [ ] **Step 2: Run tests and verify RED**

    npm test -- src/adventure/adventureUnlockPresentation.test.ts

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure functions**

Create adventureUnlockPresentation.ts:

~~~ts
export type UnlockAnimationPlan = {
  mode: "full" | "sequence" | "sweep" | "reduced";
  durationMs: number;
};

export function createUnlockPresentation(
  claimedStationIds: string[],
  seenStationIds: string[] | null,
  campaignOrder: string[]
) {
  const claimed = new Set(claimedStationIds);
  const orderedClaimed = campaignOrder.filter((id) => claimed.has(id));
  if (seenStationIds === null) {
    return { pendingStationIds: [], nextSeenStationIds: orderedClaimed };
  }
  const seen = new Set(seenStationIds);
  return {
    pendingStationIds: orderedClaimed.filter((id) => !seen.has(id)),
    nextSeenStationIds: Array.from(new Set([...seenStationIds, ...orderedClaimed]))
  };
}

export function getUnlockAnimationPlan(count: number, reducedMotion: boolean): UnlockAnimationPlan {
  if (reducedMotion) return { mode: "reduced", durationMs: 250 };
  if (count <= 1) return { mode: "full", durationMs: 1600 };
  if (count <= 3) return { mode: "sequence", durationMs: count * 500 };
  return { mode: "sweep", durationMs: 1200 };
}
~~~

- [ ] **Step 4: Add local-settings storage tests**

Create localSettings.adventure.test.ts:

~~~ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFirstAsync: vi.fn(),
  runAsync: vi.fn()
}));

vi.mock("../db/database", () => ({
  getDatabase: () => ({
    getFirstAsync: mocks.getFirstAsync,
    runAsync: mocks.runAsync
  })
}));

import {
  getAdventureSeenStationIds,
  saveAdventureSeenStationIds
} from "./localSettings";

describe("adventure seen station settings", () => {
  beforeEach(() => {
    mocks.getFirstAsync.mockReset();
    mocks.runAsync.mockReset();
  });

  it("reads a valid space and campaign scoped array", async () => {
    mocks.getFirstAsync.mockResolvedValue({ value: "[\"a\",\"b\"]" });

    await expect(
      getAdventureSeenStationIds("space-1", "star-coast")
    ).resolves.toEqual(["a", "b"]);
    expect(mocks.getFirstAsync).toHaveBeenCalledWith(
      "SELECT value FROM local_settings WHERE key = ?",
      ["adventure_seen_stations:space-1:star-coast"]
    );
  });

  it("returns null for malformed local data", async () => {
    mocks.getFirstAsync.mockResolvedValue({ value: "{" });

    await expect(
      getAdventureSeenStationIds("space-1", "star-coast")
    ).resolves.toBeNull();
  });

  it("deduplicates station ids before saving", async () => {
    await saveAdventureSeenStationIds(
      "space-1",
      "star-coast",
      ["a", "a", "b"]
    );

    expect(mocks.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO local_settings"),
      [
        "adventure_seen_stations:space-1:star-coast",
        "[\"a\",\"b\"]"
      ]
    );
  });
});
~~~

- [ ] **Step 5: Implement scoped storage helpers**

Add to localSettings.ts:

~~~ts
function adventureSeenKey(spaceId: string, campaignId: string): string {
  return "adventure_seen_stations:" + spaceId + ":" + campaignId;
}

export async function getAdventureSeenStationIds(
  spaceId: string,
  campaignId: string
): Promise<string[] | null> {
  const raw = await getLocal(adventureSeenKey(spaceId, campaignId));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((value) => typeof value === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function saveAdventureSeenStationIds(
  spaceId: string,
  campaignId: string,
  stationIds: string[]
): Promise<void> {
  await setLocal(
    adventureSeenKey(spaceId, campaignId),
    JSON.stringify(Array.from(new Set(stationIds)))
  );
}
~~~

- [ ] **Step 6: Run presentation and storage tests**

    npm test -- src/adventure/adventureUnlockPresentation.test.ts src/sync/localSettings.adventure.test.ts

Expected: all tests PASS.

## Task 6: Static 3D Scene and Fallback

**Files:**
- Create: src/adventure/StarIslandSceneSegment.tsx
- Create: src/adventure/AdventureLandmark.tsx
- Create: src/adventure/AdventureStationNode.tsx

- [ ] **Step 1: Build StarIslandSceneSegment**

Public props:

~~~ts
type StarIslandSceneSegmentProps = {
  placement: ScenePlacement;
  width: number;
  dark: boolean;
};
~~~

Implementation requirements:

- Render Expo Image with SCENE_ASSETS[placement.sceneId].
- Use absolute top/width/height from placement.
- Apply scaleX -1 when placement.mirrored.
- On image error, replace only that segment with a lavender-to-pink fallback View containing two simplified rounded island layers.
- Add a translucent cool overlay in dark mode.
- Set pointerEvents to none and accessibilityElementsHidden.

- [ ] **Step 2: Build AdventureLandmark**

Public props:

~~~ts
type AdventureLandmarkProps = {
  id: LandmarkId;
  point: { x: number; y: number };
  side: "left" | "right";
  revealProgress?: Animated.Value;
};
~~~

Render the transparent WebP behind the node. Use width/height 74, offset 44 px horizontally from the node, opacity and translateY derived from revealProgress, and pointerEvents none.

- [ ] **Step 3: Build AdventureStationNode**

Public props:

~~~ts
type AdventureStationNodeProps = {
  placement: StationPlacement;
  state: "completed" | "current" | "future";
  index: number;
};
~~~

Requirements:

- completed: pink-purple pedestal and check/reward icon.
- current: gold pedestal, double glow, gentle pulse.
- future: lavender pedestal with reduced saturation.
- Use station.reward.badgeIcon when it exists in Ionicons.glyphMap; otherwise use star.
- Label includes title and either “当前关卡”, “已解锁”, or “累计 N 点”.
- Label side comes from placement.labelSide and never overlaps the landmark safe area.
- accessibilityLabel includes index, title, threshold and state.

- [ ] **Step 4: Run type check and lint**

    npx tsc --noEmit
    npm run lint

Expected: 0 TypeScript errors and no new lint findings.

## Task 7: Dynamic Route and Travelers

**Files:**
- Create: src/adventure/AdventureRouteSvg.tsx
- Create: src/adventure/AdventureTravelers.tsx
- Create: src/ui/useReducedMotion.ts

- [ ] **Step 1: Implement reduced-motion preference hook**

Use AccessibilityInfo.isReduceMotionEnabled on mount and subscribe to reduceMotionChanged. Return a boolean and remove the listener on unmount.

- [ ] **Step 2: Build AdventureRouteSvg**

Public props:

~~~ts
type AdventureRouteSvgProps = {
  width: number;
  height: number;
  routePoints: { x: number; y: number }[];
  routeLength: number;
  reachedRouteIndex: number;
  animationProgress?: Animated.Value;
};
~~~

Requirements:

- Generate a smooth polyline sample from routePoints.
- Render a soft translucent dirt-road underlay.
- Render white stepping stones with pink-purple glow.
- Completed stones are bright; future stones use 42% opacity.
- During unlock, animate the reached overlay with Animated.createAnimatedComponent(Polyline) and strokeDashoffset from routeLength to 0.
- SVG has pointerEvents none.

- [ ] **Step 3: Build AdventureTravelers**

Public props:

~~~ts
type AdventureTravelersProps = {
  people: CouplePerson[];
  point: { x: number; y: number };
  fromPoint?: { x: number; y: number };
  travelProgress?: Animated.Value;
};
~~~

Render CoupleAvatars at point. When fromPoint and travelProgress exist, position at fromPoint and interpolate translateX/translateY to point. Preserve the heart fallback when no avatars exist.

- [ ] **Step 4: Run type check and lint**

    npx tsc --noEmit
    npm run lint

Expected: no new errors or warnings.

## Task 8: AdventureMap Viewport, Scrolling and Static State

**Files:**
- Rewrite: src/adventure/AdventureMap.tsx
- Delete after success: src/adventure/adventureMapGeometry.ts
- Delete after success: src/adventure/adventureMapGeometry.test.ts

- [ ] **Step 1: Define the new public props**

~~~ts
type AdventureMapProps = {
  campaign: AdventureCampaign;
  people: CouplePerson[];
  progress: AdventureProgress;
  pendingUnlockStationIds: string[];
  onUnlockPresentationComplete: () => void;
};
~~~

- [ ] **Step 2: Implement the 520 px internal viewport**

Requirements:

- Outer View has height MAP_VIEWPORT_HEIGHT, rounded corners, border and overflow hidden.
- Inner ScrollView is vertical, nestedScrollEnabled, showsVerticalScrollIndicator false.
- Content View uses layout.contentHeight and absolute children.
- Render scene segments first, then route, landmarks, travelers, nodes and labels.
- Empty campaign still renders one scene, a start node and “等待添加关卡”.
- Keep a position key of campaign.id plus progress.stationIndex.
- On a new position key, scroll once to layout.currentOffsetY; do not fight later manual scrolling.

- [ ] **Step 3: Map station states from current progress**

For station index:

- index less than progress.stationIndex → completed.
- index equal to progress.stationIndex when a next station exists → current.
- larger indexes → future.
- Start node is completed when stationIndex > 0, otherwise current.

- [ ] **Step 4: Remove old geometry imports and files**

Run:

    rg -n "adventureMapGeometry|createRoutePoints|travelerPoint" app src

Expected: only the old files themselves remain. Delete them, then rerun the search and expect no output.

- [ ] **Step 5: Run map/layout tests and static checks**

    npm test -- src/adventure/adventureMapLayout.test.ts
    npx tsc --noEmit
    npm run lint

Expected: PASS with no new lint findings.

## Task 9: Island Awakening Animation

**Files:**
- Modify: src/adventure/AdventureMap.tsx
- Modify: src/adventure/AdventureRouteSvg.tsx
- Modify: src/adventure/AdventureLandmark.tsx
- Modify: src/adventure/AdventureStationNode.tsx
- Modify: src/adventure/AdventureTravelers.tsx

- [ ] **Step 1: Create animation values from the pure plan**

Inside AdventureMap:

~~~ts
const routeProgress = useRef(new Animated.Value(1)).current;
const travelProgress = useRef(new Animated.Value(1)).current;
const landmarkProgress = useRef(new Animated.Value(1)).current;
const reducedMotion = useReducedMotion();
const animationPlan = getUnlockAnimationPlan(pendingUnlockStationIds.length, reducedMotion);
~~~

- [ ] **Step 2: Implement full single-station animation**

When one pending station exists:

1. Scroll to target.
2. Reset all three values to 0.
3. Start route timing for 600 ms with useNativeDriver false.
4. Start traveler timing after 400 ms for 500 ms with useNativeDriver true.
5. Start landmark timing after 700 ms for 500 ms with useNativeDriver true.
6. Show reward summary after 1000 ms.
7. Call onUnlockPresentationComplete at 1600 ms.

Use Animated.sequence, Animated.parallel and Animated.delay. Every timer/animation must stop during effect cleanup.

- [ ] **Step 3: Implement compressed multi-station modes**

- sequence: route through pending stations in campaign order, 500 ms each; only final station reveals landmark/reward.
- sweep: one 1200 ms route/traveler animation directly to final pending station.
- reduced: 250 ms opacity transition, no traveler translation, no pulse or landmark rise.

- [ ] **Step 4: Add non-blocking skip behavior**

The map remains scrollable during animation. If the user begins dragging:

- Stop current animations.
- Set all values to 1.
- Hide the reward summary.
- Call onUnlockPresentationComplete.

- [ ] **Step 5: Run unlock tests and static checks**

    npm test -- src/adventure/adventureUnlockPresentation.test.ts
    npx tsc --noEmit
    npm run lint

Expected: PASS and no new findings.

## Task 10: Adventure Screen Integration

**Files:**
- Modify: app/(tabs)/adventure.tsx

- [ ] **Step 1: Extend adventure screen state**

Add:

~~~ts
const [spaceId, setSpaceId] = useState<string | null>(null);
const [seenStationIds, setSeenStationIds] = useState<string[] | null>(null);
const [pendingUnlockStationIds, setPendingUnlockStationIds] = useState<string[]>([]);
const [nextSeenStationIds, setNextSeenStationIds] = useState<string[]>([]);
~~~

- [ ] **Step 2: Load scoped seen state after campaign/account**

After the existing Promise.all:

~~~ts
const storedSeen = account
  ? await getAdventureSeenStationIds(account.spaceId, nextCampaign.id)
  : null;
const presentation = createUnlockPresentation(
  rewards.map((reward) => reward.stationId),
  storedSeen,
  nextCampaign.stations.map((station) => station.id)
);
~~~

Set spaceId, seenStationIds, pendingUnlockStationIds and nextSeenStationIds from the result. When storedSeen is null, save the initial baseline immediately and keep pending empty.

- [ ] **Step 3: Pass animation props to AdventureMap**

~~~tsx
<AdventureMap
  campaign={campaign}
  people={people}
  progress={progress}
  pendingUnlockStationIds={pendingUnlockStationIds}
  onUnlockPresentationComplete={() => void completeUnlockPresentation()}
/>
~~~

completeUnlockPresentation must:

- Save nextSeenStationIds using spaceId and campaign.id.
- Update seenStationIds locally.
- Clear pendingUnlockStationIds.
- Never change claimedStationIds or campaign state.

- [ ] **Step 4: Preserve behavior under remote refresh**

If a sync invalidation arrives while animation is active:

- Keep the current pending snapshot until it completes or is skipped.
- Apply fresh campaign/progress data to the final static layout.
- Queue any additional unseen station IDs after the current snapshot.

- [ ] **Step 5: Run all client tests**

    npm test
    npx tsc --noEmit
    npm run lint

Expected: all tests PASS; TypeScript exits 0; only the pre-existing account Divider warning may remain.

## Task 11: Runtime and Visual Verification

**Files:**
- Modify: docs/superpowers/plans/2026-07-10-3d-star-island-map-plan.md
- Modify design spec only if runtime contradicts it.

- [ ] **Step 1: Start or reuse Metro on port 8082**

Use the project-specific command:

    npm run start -C -- --port 8082

Expected: Expo development server responds on http://127.0.0.1:8082.

- [ ] **Step 2: Open the adventure route in iOS Simulator**

    xcrun simctl openurl booted 'exp://127.0.0.1:8082/--/adventure'
    sleep 7
    xcrun simctl io booted screenshot /tmp/adventure-3d-map.png

Inspect with view_image at original detail.

- [ ] **Step 3: Verify the reference-style requirements**

Confirm:

- Pastel clay terrain, castle/waterfall/cottage scenery and soft lighting are visible.
- The map, not the whole page, uses the new reference style.
- Current node is gold; completed nodes are pink-purple; future nodes are dim lavender.
- Landmarks remain behind nodes and do not cover labels.
- Double avatars sit on the actual route.
- The cumulative-action, next-reward and collection modules below the map are unchanged.

- [ ] **Step 4: Verify scrolling and edge cases**

Use layout tests as authoritative evidence for 0, 1, 5 and 30 stations. In simulator:

- Scroll the map without moving the outer page unexpectedly.
- Leave and re-enter the adventure tab; automatic positioning occurs once.
- Toggle dark theme; scene remains readable under the cool overlay.
- Enable iOS Reduce Motion and verify no large translation/pulse.

- [ ] **Step 5: Verify unlock presentation**

Using a temporary sandbox account:

- Set progress just below a station threshold.
- Complete a check-in to cross one station.
- Open adventure and observe one full island-awakening sequence.
- Leave and reopen; the sequence does not replay.
- Cross multiple adjacent stations and verify compressed sequence/sweep behavior.
- Delete the temporary account after verification.

- [ ] **Step 6: Run the final gate**

    npm test
    npx tsc --noEmit
    npm run lint
    cd server && npm test
    cd server && npm run build
    git diff --check

Expected:

- Client and server tests PASS.
- TypeScript and server build exit 0.
- Lint has 0 errors and no new warning.
- git diff --check has no whitespace errors.

- [ ] **Step 7: Record final evidence**

Append:

- Exact client/server test counts.
- Asset dimensions and byte sizes.
- Simulator screenshot paths.
- Single/multi unlock evidence.
- Reduced-motion behavior.
- Any residual platform limitation.

## Execution Notes

- The approved design authorizes adding react-native-svg and the seven local art assets.
- Use imagegen for raster generation and frontend-design for implementation polish.
- Do not alter server campaign, progress, reward or upload schemas.
- Do not create commits, push or merge unless the user separately authorizes Git history operations.
- Keep generated originals and optimized runtime assets separate.
- Do not use the supplied reference as a shipped app asset.
