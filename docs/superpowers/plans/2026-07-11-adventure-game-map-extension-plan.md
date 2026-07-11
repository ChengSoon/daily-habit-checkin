# 冒险游戏地图长期延伸 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有动态浮岛地图升级为可持续新增关卡的连续冒险世界，加入顶部预告岛、每 12 关章节门、章节氛围、迷雾、精简节点标签和长地图可见窗口渲染。

**Architecture:** 继续以 campaign station 顺序作为唯一数据源，客户端通过 `stationIndex / 4` 和 `stationIndex / 12` 确定场景段与章节，不修改服务端或数据库。布局纯函数输出场景、章节门、节点和滚动补偿信息；React Native 只挂载视口附近的高分辨率场景与节点，SVG 保留全局路线。

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6, expo-image, react-native-svg, Vitest, OpenAI-compatible Image API via `openai-image-api`.

---

## File Structure

- Modify: `docs/superpowers/specs/2026-07-10-3d-star-island-map-design.md`
  - 记录长期延伸、章节门、顶部预告岛、滚动稳定性和窗口化规则。
- Modify: `src/adventure/adventureMapSceneManifest.ts`
  - 增加章节氛围类型、章节名称和场景出口语义。
- Modify: `src/adventure/adventureMapLayout.ts`
  - 输出预告场景、章节门、章节主题和可见场景范围。
- Modify: `src/adventure/adventureMapLayout.test.ts`
  - 覆盖 0/1/4/5/11/12/13/24/25/30/60/120 关。
- Create: `src/adventure/AdventureChapterGate.tsx`
  - 渲染章节门、下一章编号和已通过状态。
- Create: `src/adventure/AdventureFogLayer.tsx`
  - 渲染顶部预告岛周围的局部静态云雾。
- Modify: `src/adventure/StarIslandSceneSegment.tsx`
  - 根据章节主题叠加晨光、夕阳或月色氛围。
- Modify: `src/adventure/AdventureStationNode.tsx`
  - 仅当前目标显示完整标签，未来节点使用紧凑编号/门槛胶囊。
- Modify: `src/adventure/AdventureMap.tsx`
  - 渲染章节门、迷雾和可见窗口，补偿地图增长造成的 scroll offset。
- Edit originals: `docs/assets/generated/adventure-map/originals/scene-*.png`
  - 移除巨型空圆台，增加自然落脚点和连续 S 形道路。
- Replace derived assets: `assets/adventure-map/scene-*.webp`
  - 保持精确 `1080 × 1920`。

## Task 1: Lock the Extension Contract with Tests

**Files:**
- Modify: `src/adventure/adventureMapLayout.test.ts`

- [ ] **Step 1: Add preview-scene boundary tests**

Add assertions equivalent to:

```ts
it.each([
  [0, 1],
  [1, 1],
  [4, 2],
  [5, 2],
  [11, 3],
  [12, 4],
  [13, 4]
])("creates preview scenes for %i stations", (count, expectedSegments) => {
  const layout = createAdventureMapLayout(
    Array.from({ length: count }, (_, index) => station(index)),
    { stationIndex: 0, segmentPoints: 0, segmentCost: 6 },
    360
  );
  expect(layout.segments).toHaveLength(expectedSegments);
});
```

- [ ] **Step 2: Add chapter-gate tests**

```ts
it.each([
  [11, 0],
  [12, 1],
  [13, 1],
  [24, 2],
  [25, 2],
  [30, 2]
])("creates chapter gates for %i stations", (count, expectedGates) => {
  const layout = createAdventureMapLayout(
    Array.from({ length: count }, (_, index) => station(index)),
    { stationIndex: 0, segmentPoints: 0, segmentCost: 6 },
    360
  );
  expect(layout.chapterGates).toHaveLength(expectedGates);
});
```

- [ ] **Step 3: Add stable-placement, theme and visible-window tests**

Verify:

```ts
expect(layout13.stations.slice(0, 12).map(({ segmentIndex }) => segmentIndex))
  .toEqual(layout12.stations.map(({ segmentIndex }) => segmentIndex));
expect(layout25.segments[3].chapterIndex).toBe(1);
expect(layout25.segments[6].chapterIndex).toBe(2);
expect(getVisibleSegmentIndexes(layout120.segments, layout120.currentOffsetY, 520))
  .toHaveLength(3);
```

- [ ] **Step 4: Run RED verification**

Run:

```bash
npm test -- src/adventure/adventureMapLayout.test.ts
```

Expected: fail because `chapterGates`, `chapterIndex` and `getVisibleSegmentIndexes` do not exist and the current segment-count rule does not create preview scenes.

## Task 2: Implement Deterministic Chapters and Preview Islands

**Files:**
- Modify: `src/adventure/adventureMapSceneManifest.ts`
- Modify: `src/adventure/adventureMapLayout.ts`
- Test: `src/adventure/adventureMapLayout.test.ts`

- [ ] **Step 1: Add chapter constants and theme types**

Define:

```ts
export const SCENES_PER_CHAPTER = 3;
export const STATIONS_PER_CHAPTER = 12;
export type ChapterTone = "dawn" | "sunset" | "moonlight";

export const CHAPTER_TONES: readonly ChapterTone[] = [
  "dawn",
  "sunset",
  "moonlight"
];
```

- [ ] **Step 2: Extend layout placement types**

Add:

```ts
export type ScenePlacement = {
  id: string;
  sceneId: SceneId;
  index: number;
  chapterIndex: number;
  tone: ChapterTone;
  mirrored: boolean;
  preview: boolean;
  top: number;
  height: number;
};

export type ChapterGatePlacement = {
  id: string;
  chapterIndex: number;
  afterStationIndex: number;
  segmentIndex: number;
  point: MapPoint;
};
```

- [ ] **Step 3: Change segment count and generate gates**

Use:

```ts
const segmentCount = Math.max(
  1,
  Math.ceil((stations.length + 1) / STATIONS_PER_SCENE)
);
```

For each completed 12-station boundary, place a gate at the third scene's mirrored `exitAnchor`. Mark a scene as preview when its first station index is greater than or equal to `stations.length`.

- [ ] **Step 4: Add pure visible-window calculation**

```ts
export function getVisibleSegmentIndexes(
  segments: ScenePlacement[],
  offsetY: number,
  viewportHeight: number,
  overscan = 1
): number[] {
  const visible = segments.filter((segment) =>
    segment.top + segment.height >= offsetY
    && segment.top <= offsetY + viewportHeight
  );
  const indexes = new Set<number>();
  for (const segment of visible) {
    for (let delta = -overscan; delta <= overscan; delta += 1) {
      const index = segment.index + delta;
      if (index >= 0 && index < segments.length) indexes.add(index);
    }
  }
  return [...indexes].sort((left, right) => left - right);
}
```

- [ ] **Step 5: Run GREEN verification**

```bash
npm test -- src/adventure/adventureMapLayout.test.ts
npx tsc --noEmit
```

Expected: layout tests pass and TypeScript exits 0.

## Task 3: Render Chapter Gates, Themes and Fog

**Files:**
- Create: `src/adventure/AdventureChapterGate.tsx`
- Create: `src/adventure/AdventureFogLayer.tsx`
- Modify: `src/adventure/StarIslandSceneSegment.tsx`
- Modify: `src/adventure/AdventureMap.tsx`

- [ ] **Step 1: Create the chapter gate component**

Render a compact clay-like arch using layered Views and `Ionicons`. Props:

```ts
type AdventureChapterGateProps = {
  placement: ChapterGatePlacement;
  passed: boolean;
};
```

The label is `第 ${placement.chapterIndex + 2} 章` because a gate after chapter index 0 leads to chapter 2. Completed gates display a checkmark and reduce opacity.

- [ ] **Step 2: Create the fog layer**

Accept `top` and `height`. Render staggered translucent cloud blobs around the preview island without intercepting touches. Do not create a full-width horizontal fog wall or add another large explanatory label.

- [ ] **Step 3: Add scene tone overlays**

Use deterministic overlays:

```ts
const toneOverlay = {
  dawn: "rgba(255, 224, 181, 0.08)",
  sunset: "rgba(255, 142, 151, 0.16)",
  moonlight: "rgba(77, 88, 171, 0.22)"
}[placement.tone];
```

Preview scenes receive an additional lavender-white haze.

- [ ] **Step 4: Integrate visible-window rendering**

Track `scrollY` from `onScroll`. Compute visible indexes with `getVisibleSegmentIndexes`; render scene images, landmarks, nodes and gates only when their `segmentIndex` is visible. Keep the route SVG and traveler layer global.

- [ ] **Step 5: Preserve scroll position when content grows**

Track the previous `contentHeight` and latest `scrollY`. If station count changes but `progress.stationIndex` does not, scroll to `scrollY + (newHeight - oldHeight)` without animation.

## Task 4: Replace Editor-Like Labels with Game-State Hierarchy

**Files:**
- Modify: `src/adventure/AdventureStationNode.tsx`
- Modify: `src/adventure/AdventureMap.tsx`

- [ ] **Step 1: Extend station states**

Use:

```ts
export type AdventureStationState =
  | "completed"
  | "current"
  | "next"
  | "future";
```

`current` means the immediate unlock target, `next` means the station after it, completed nodes have no text card, and later future nodes only show a lock/number.

- [ ] **Step 2: Apply compact labels**

- Current target: title + `累计 N 点` in a maximum 112 px card.
- Next station: one-line threshold capsule.
- Completed: 42–46 px check node only.
- Future: 38–42 px numbered lock node only.

- [ ] **Step 3: Reposition travelers**

Keep the paired avatars offset to the route side opposite the current target card; cap the total marker width so it never covers both the node and label.

## Task 5: Edit the Three Scene Assets with OpenAI Image API

**Files:**
- Edit: `docs/assets/generated/adventure-map/originals/scene-camp.png`
- Edit: `docs/assets/generated/adventure-map/originals/scene-waterfall.png`
- Edit: `docs/assets/generated/adventure-map/originals/scene-castle.png`
- Replace: `assets/adventure-map/scene-camp.webp`
- Replace: `assets/adventure-map/scene-waterfall.webp`
- Replace: `assets/adventure-map/scene-castle.webp`

- [ ] **Step 1: Back up the current originals separately**

Copy current files to:

```text
docs/assets/generated/adventure-map/originals-v1/
```

- [ ] **Step 2: Edit each original through `openai-image-api`**

Use each original as an edit target with this invariant prompt:

```text
Preserve the existing portrait 3D clay-diorama floating-island composition,
camera, buildings, terrain identity, lighting direction, pastel material and
top/bottom cloud seams. Replace every oversized empty cream circular platform
with a small natural landing patch only 1.3 to 1.5 times the size of a mobile
game level node. Connect the four landing patches with one obvious continuous
S-shaped dirt trail that climbs from bottom to top through the terrain. Add
small trail clues such as signposts, stone steps, flowers and lanterns, while
keeping all four dynamic UI anchor areas unobstructed. The result must feel like
an explorable adventure-game world, not a level editor template. No text,
numbers, fixed level markers, avatars, UI, logos or watermark.
```

Run with `--quality high --size 2160x3840 --size-policy warn` and preserve the returned high-resolution original.

- [ ] **Step 3: Derive exact 1080p runtime assets**

Resize each edited original to exact `1080 × 1920`, encode as WebP, and verify dimensions with Pillow or `sips`.

- [ ] **Step 4: Inspect full-resolution and runtime variants**

Reject outputs if the road is broken, a landing patch is still a giant empty disc, buildings block anchors, or top/bottom clouds cannot overlap.

## Task 6: Verification and Visual Acceptance

**Files:**
- Modify if needed: files listed above only.

- [ ] **Step 1: Run focused tests**

```bash
npm test -- src/adventure/adventureMapLayout.test.ts src/adventure/adventureUnlockPresentation.test.ts src/sync/localSettings.adventure.test.ts
```

- [ ] **Step 2: Run project quality gates**

```bash
npx tsc --noEmit
npm run lint -- --no-cache
npm test
```

- [ ] **Step 3: Start the simulator build**

```bash
npm run start -C -- --port 8082
```

- [ ] **Step 4: Capture runtime evidence**

Check at minimum:

- Current campaign state in light theme.
- 12 → 13 extension behavior through a chapter gate.
- 30+ station scroll and visible-window rendering.
- No oversized white labels covering buildings, path or travelers.
- Top of viewport reveals fog, a gate or the next island instead of empty sky.

- [ ] **Step 5: Do not commit without explicit user approval**

Keep all changes in the current working tree. If the user later authorizes a commit, use a message such as:

```text
feat(adventure): 扩展连续章节地图
```
