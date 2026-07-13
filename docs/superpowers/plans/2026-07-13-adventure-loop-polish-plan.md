# 冒险岛闭环补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为闯关补齐徽章收藏墙、用户侧现实惊喜兑现状态、领奖庆祝与地图新解锁轻反馈，形成「解锁 → 领取 → 收藏 →（可选）兑现」闭环。

**Architecture:** 不新建表。扩展 `GET/POST /api/adventure` 的 state DTO：附带 `claims[]`、`pendingFulfillmentCount`，并在每章 `claim` 摘要上挂兑现状态。客户端用纯函数从 state 构建徽章墙；领奖庆祝用 Reanimated 组件；地图 lastSeen 解锁 order 存 `local_settings`。

**Tech Stack:** TypeScript、Express、PostgreSQL、Expo Router、React Native、Reanimated、Vitest、既有 `useSyncScreen` / adventure WebSocket 失效。

**Spec:** `docs/superpowers/specs/2026-07-13-adventure-loop-polish-design.md`

---

## Scope Check

本期只做闭环补齐三件套。不做：推送、Region、坐标 override、双人贡献条、共同回忆、用户侧 fulfill/cancel 写接口。

---

## File Structure

### Create

| Path | Responsibility |
| --- | --- |
| `src/adventure/badgeWall.ts` | 纯函数：徽章墙 items、pending claims 选择、unlock feedback 判定 |
| `src/adventure/badgeWall.test.ts` | 上述纯函数单测 |
| `src/adventure/unlockSeen.ts` | 读写 `local_settings`：`adventure:lastSeenUnlockedOrder:{spaceId}` |
| `src/adventure/unlockSeen.test.ts` | mock DB 或纯 key 拼接 + 解析测试 |
| `src/adventure/AdventureClaimCelebration.tsx` | 领奖成功半屏庆祝 |
| `app/adventure/badges.tsx` | 徽章收藏墙页面 |

### Modify

| Path | Change |
| --- | --- |
| `server/src/adventure/adventureRepository.ts` | `listClaims` SELECT 增加 `badge_emoji`、`badge_image_key` |
| `server/src/adventure/adventureService.ts` | DTO 扩展；`buildState`/`buildAdventureStateFromParts` 附带 claims |
| `server/src/adventure/adventureService.test.ts` | claims / pending 计数 / chapter.claim 断言 |
| `src/adventure/types.ts` | 客户端类型对齐 |
| `src/adventure/adventureService.test.ts` | sample state 补新字段 |
| `app/(tabs)/adventure.tsx` | 徽章墙入口 + 待兑现提示 |
| `app/adventure/[chapterId].tsx` | 兑现卡 + 领奖庆祝 |
| `app/adventure/map.tsx` | 新解锁轻反馈 + lastSeen 写入 |
| `app/_layout.tsx` | 注册 `adventure/badges` 标题 |

---

## Task 1: 服务端 state 扩展（TDD）

**Files:**
- Modify: `server/src/adventure/adventureService.ts`
- Modify: `server/src/adventure/adventureService.test.ts`
- Modify: `server/src/adventure/adventureRepository.ts`

- [ ] **Step 1: 扩展失败测试**

在 `server/src/adventure/adventureService.test.ts` 增加：

```ts
it("includes empty claims and zero pending by default", () => {
  const state = buildAdventureStateFromParts({
    lifetimeEarned: 50,
    highestUnlockedOrder: 1,
    chapters,
    claimedChapterIds: [],
    claims: []
  });
  expect(state.claims).toEqual([]);
  expect(state.pendingFulfillmentCount).toBe(0);
  expect(byId(state.chapters, "c1")?.claim).toBeNull();
});

it("attaches claim summary and pending count for real_pending", () => {
  const realChapter = chapter({
    id: "c1",
    sortOrder: 1,
    thresholdLifetimeXp: 50,
    rewardType: "real_pending",
    badgeEmoji: "🎁",
    badgeImageKey: "adventure_badges/s/x.png"
  });
  const state = buildAdventureStateFromParts({
    lifetimeEarned: 50,
    highestUnlockedOrder: 1,
    chapters: [realChapter, chapters[1], chapters[2]],
    claimedChapterIds: ["c1"],
    claims: [
      {
        id: "cl1",
        chapterId: "c1",
        chapterTitle: "c1",
        badgeName: "badge",
        badgeEmoji: "🎁",
        badgeImageKey: "adventure_badges/s/x.png",
        rewardType: "real_pending",
        claimedAt: "2026-07-13T00:00:00.000Z",
        claimedBy: "acc-1",
        fulfillmentStatus: "pending",
        fulfilledAt: null,
        cancelledAt: null,
        note: null
      }
    ]
  });
  expect(state.pendingFulfillmentCount).toBe(1);
  expect(state.claims).toHaveLength(1);
  expect(byId(state.chapters, "c1")?.viewStatus).toBe("claimed");
  expect(byId(state.chapters, "c1")?.claim).toMatchObject({
    fulfillmentStatus: "pending",
    claimedAt: "2026-07-13T00:00:00.000Z",
    note: null
  });
});

it("counts only pending fulfillments", () => {
  const state = buildAdventureStateFromParts({
    lifetimeEarned: 50,
    highestUnlockedOrder: 1,
    chapters,
    claimedChapterIds: ["c1"],
    claims: [
      {
        id: "a",
        chapterId: "c1",
        chapterTitle: "c1",
        badgeName: "badge",
        badgeEmoji: "🏅",
        badgeImageKey: null,
        rewardType: "badge_story",
        claimedAt: "2026-07-13T00:00:00.000Z",
        claimedBy: "acc-1",
        fulfillmentStatus: "none",
        fulfilledAt: null,
        cancelledAt: null,
        note: null
      },
      {
        id: "b",
        chapterId: "c2",
        chapterTitle: "c2",
        badgeName: "b2",
        badgeEmoji: null,
        badgeImageKey: null,
        rewardType: "real_pending",
        claimedAt: "2026-07-13T01:00:00.000Z",
        claimedBy: "acc-1",
        fulfillmentStatus: "fulfilled",
        fulfilledAt: "2026-07-13T02:00:00.000Z",
        cancelledAt: null,
        note: "已送花"
      }
    ]
  });
  expect(state.pendingFulfillmentCount).toBe(0);
});
```

同时把既有 `buildAdventureStateFromParts` 调用补上 `claims: []`（或实现里默认 `claims ?? []`）。

- [ ] **Step 2: 跑测确认 RED**

Run:

```bash
cd server && npm test -- src/adventure/adventureService.test.ts
```

Expected: FAIL（`claims` 参数/`pendingFulfillmentCount` 不存在或 undefined）。

- [ ] **Step 3: 扩展 repository listClaims 字段**

`AdventureClaimRow` 增加可选：

```ts
badgeEmoji?: string | null;
badgeImageKey?: string | null;
```

`listClaims` SQL JOIN 增加：

```sql
ch.badge_emoji AS badge_emoji,
ch.badge_image_key AS badge_image_key
```

映射到 row。

- [ ] **Step 4: 扩展 DTO 与 buildState**

在 `adventureService.ts`：

```ts
export type AdventureClaimSummaryDto = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  badgeName: string;
  badgeEmoji: string | null;
  badgeImageKey: string | null;
  rewardType: string;
  claimedAt: string;
  claimedBy: string | null;
  fulfillmentStatus: "none" | "pending" | "fulfilled" | "cancelled";
  fulfilledAt: string | null;
  cancelledAt: string | null;
  note: string | null;
};

export type ChapterClaimInfoDto = {
  fulfillmentStatus: AdventureClaimSummaryDto["fulfillmentStatus"];
  claimedAt: string;
  note: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
};

export type ChapterViewDto = {
  // ...existing fields
  claim: ChapterClaimInfoDto | null;
};

export type AdventureStateDto = {
  // ...existing
  claims: AdventureClaimSummaryDto[];
  pendingFulfillmentCount: number;
};
```

`toDto` 增加参数 `claim: ChapterClaimInfoDto | null`。

改 `buildState`：

```ts
function buildState(input: {
  lifetimeEarned: number;
  highestUnlockedOrder: number;
  chapters: AdventureChapterRow[];
  views: ChapterView[];
  claims: AdventureClaimSummaryDto[];
}): AdventureStateDto {
  const claimByChapter = new Map(input.claims.map((c) => [c.chapterId, c]));
  const chapterDtos: ChapterViewDto[] = input.views.map((view) => {
    const row = byId.get(view.id)!;
    const full = claimByChapter.get(view.id);
    const claimInfo =
      view.viewStatus === "claimed" && full
        ? {
            fulfillmentStatus: full.fulfillmentStatus,
            claimedAt: full.claimedAt,
            note: full.note,
            fulfilledAt: full.fulfilledAt,
            cancelledAt: full.cancelledAt
          }
        : null;
    return toDto(row, view.viewStatus, claimInfo);
  });
  const pendingFulfillmentCount = input.claims.filter((c) => c.fulfillmentStatus === "pending").length;
  return {
    lifetimeEarned: input.lifetimeEarned,
    highestUnlockedOrder: input.highestUnlockedOrder,
    claimableCount: countClaimable(input.views),
    chapters: chapterDtos,
    nextChapter: /* 现有逻辑 */,
    claims: input.claims,
    pendingFulfillmentCount
  };
}
```

`mapClaimRowToSummary(row): AdventureClaimSummaryDto` 从 repository row 映射。

`loadAndAdvance` 之后、`buildState` 之前：

```ts
const claimRows = await listClaims(client, spaceId);
const claims = claimRows.map(mapClaimRowToSummary);
return buildState({ ..., claims });
```

所有现有 `buildState({...})` 调用补 `claims`（claim 成功路径也要重新 `listClaims`）。

`buildAdventureStateFromParts`：

```ts
export function buildAdventureStateFromParts(input: {
  lifetimeEarned: number;
  highestUnlockedOrder: number;
  chapters: AdventureChapterRow[];
  claimedChapterIds: string[];
  claims?: AdventureClaimSummaryDto[];
}): AdventureStateDto {
  // ... existing advance/views
  return buildState({
    lifetimeEarned: input.lifetimeEarned,
    highestUnlockedOrder: advanced,
    chapters: input.chapters,
    views,
    claims: input.claims ?? []
  });
}
```

- [ ] **Step 5: 跑测 GREEN**

```bash
cd server && npm test -- src/adventure/adventureService.test.ts
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add server/src/adventure/adventureRepository.ts server/src/adventure/adventureService.ts server/src/adventure/adventureService.test.ts
git commit -m "feat(adventure): state 返回 claims 与兑现摘要"
```

---

## Task 2: 客户端类型与透传

**Files:**
- Modify: `src/adventure/types.ts`
- Modify: `src/adventure/adventureService.test.ts`

- [ ] **Step 1: 对齐 types**

```ts
export type AdventureClaimSummary = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  badgeName: string;
  badgeEmoji: string | null;
  badgeImageKey: string | null;
  rewardType: string;
  claimedAt: string;
  claimedBy: string | null;
  fulfillmentStatus: AdventureFulfillmentStatus;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  note: string | null;
};

export type ChapterClaimInfo = {
  fulfillmentStatus: AdventureFulfillmentStatus;
  claimedAt: string;
  note: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
};

export type AdventureChapterView = {
  // existing...
  claim: ChapterClaimInfo | null;
};

export type AdventureState = {
  // existing...
  claims: AdventureClaimSummary[];
  pendingFulfillmentCount: number;
};
```

- [ ] **Step 2: 更新 sample state**

`src/adventure/adventureService.test.ts` 的 `sample` 增加：

```ts
claims: [],
pendingFulfillmentCount: 0
```

章节 mock 若手写完整对象，补 `claim: null`。

- [ ] **Step 3: 跑客户端单测**

```bash
npx vitest run src/adventure/adventureService.test.ts
```

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/adventure/types.ts src/adventure/adventureService.test.ts
git commit -m "feat(adventure): 客户端类型对齐 claims 状态"
```

---

## Task 3: 徽章墙纯函数（TDD）

**Files:**
- Create: `src/adventure/badgeWall.ts`
- Create: `src/adventure/badgeWall.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import {
  buildBadgeWallItems,
  selectPendingClaims,
  shouldPlayUnlockFeedback,
  type BadgeWallItem
} from "./badgeWall";
import type { AdventureState } from "./types";

function state(partial: Partial<AdventureState> & Pick<AdventureState, "chapters" | "claims">): AdventureState {
  return {
    lifetimeEarned: 100,
    highestUnlockedOrder: 1,
    claimableCount: 0,
    nextChapter: null,
    pendingFulfillmentCount: 0,
    ...partial
  };
}

describe("buildBadgeWallItems", () => {
  it("orders by sortOrder and marks claimed vs unclaimed", () => {
    const items = buildBadgeWallItems(
      state({
        chapters: [
          {
            id: "c2",
            sortOrder: 2,
            title: "二",
            subtitle: null,
            storyText: "",
            thresholdLifetimeXp: 150,
            badgeName: "B2",
            badgeDescription: null,
            badgeEmoji: "2️⃣",
            badgeImageKey: null,
            nodeImageKey: null,
            backgroundImageKey: null,
            mapThemeKey: null,
            rewardType: "badge_story",
            viewStatus: "locked",
            claim: null
          },
          {
            id: "c1",
            sortOrder: 1,
            title: "一",
            subtitle: null,
            storyText: "",
            thresholdLifetimeXp: 50,
            badgeName: "B1",
            badgeDescription: null,
            badgeEmoji: "1️⃣",
            badgeImageKey: null,
            nodeImageKey: null,
            backgroundImageKey: null,
            mapThemeKey: null,
            rewardType: "real_pending",
            viewStatus: "claimed",
            claim: {
              fulfillmentStatus: "pending",
              claimedAt: "2026-07-13T00:00:00.000Z",
              note: null,
              fulfilledAt: null,
              cancelledAt: null
            }
          }
        ],
        claims: []
      })
    );
    expect(items.map((i) => i.chapterId)).toEqual(["c1", "c2"]);
    expect(items[0]).toMatchObject({ kind: "claimed", fulfillmentStatus: "pending", badgeName: "B1" });
    expect(items[1].kind).toBe("unclaimed");
  });
});

describe("selectPendingClaims", () => {
  it("filters pending only", () => {
    const pending = selectPendingClaims(
      state({
        chapters: [],
        claims: [
          {
            id: "1",
            chapterId: "c1",
            chapterTitle: "一",
            badgeName: "B",
            badgeEmoji: null,
            badgeImageKey: null,
            rewardType: "real_pending",
            claimedAt: "t",
            claimedBy: null,
            fulfillmentStatus: "pending",
            fulfilledAt: null,
            cancelledAt: null,
            note: null
          },
          {
            id: "2",
            chapterId: "c2",
            chapterTitle: "二",
            badgeName: "B2",
            badgeEmoji: null,
            badgeImageKey: null,
            rewardType: "real_pending",
            claimedAt: "t",
            claimedBy: null,
            fulfillmentStatus: "fulfilled",
            fulfilledAt: "t2",
            cancelledAt: null,
            note: null
          }
        ]
      })
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe("1");
  });
});

describe("shouldPlayUnlockFeedback", () => {
  it("plays only when highest increases", () => {
    expect(shouldPlayUnlockFeedback(2, null)).toBe(true);
    expect(shouldPlayUnlockFeedback(2, 1)).toBe(true);
    expect(shouldPlayUnlockFeedback(2, 2)).toBe(false);
    expect(shouldPlayUnlockFeedback(1, 2)).toBe(false);
  });
});
```

- [ ] **Step 2: RED**

```bash
npx vitest run src/adventure/badgeWall.test.ts
```

- [ ] **Step 3: 实现 badgeWall.ts**

```ts
import type { AdventureClaimSummary, AdventureFulfillmentStatus, AdventureState, ChapterViewStatus } from "./types";

export type BadgeWallItem = {
  chapterId: string;
  sortOrder: number;
  chapterTitle: string;
  badgeName: string;
  badgeEmoji: string | null;
  badgeImageKey: string | null;
  kind: "claimed" | "unclaimed";
  viewStatus: ChapterViewStatus;
  fulfillmentStatus: AdventureFulfillmentStatus | null;
  rewardType: string;
};

export function buildBadgeWallItems(state: AdventureState): BadgeWallItem[] {
  return [...state.chapters]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((chapter) => ({
      chapterId: chapter.id,
      sortOrder: chapter.sortOrder,
      chapterTitle: chapter.title,
      badgeName: chapter.badgeName,
      badgeEmoji: chapter.badgeEmoji,
      badgeImageKey: chapter.badgeImageKey,
      kind: chapter.viewStatus === "claimed" ? "claimed" : "unclaimed",
      viewStatus: chapter.viewStatus,
      fulfillmentStatus: chapter.claim?.fulfillmentStatus ?? null,
      rewardType: chapter.rewardType
    }));
}

export function selectPendingClaims(state: AdventureState): AdventureClaimSummary[] {
  return state.claims.filter((claim) => claim.fulfillmentStatus === "pending");
}

export function shouldPlayUnlockFeedback(highestUnlockedOrder: number, lastSeen: number | null): boolean {
  if (lastSeen === null) return highestUnlockedOrder > 0;
  return highestUnlockedOrder > lastSeen;
}

export function fulfillmentLabel(status: AdventureFulfillmentStatus | null | undefined): string | null {
  if (status === "pending") return "待兑现";
  if (status === "fulfilled") return "已兑现";
  if (status === "cancelled") return "已取消";
  return null;
}
```

- [ ] **Step 4: GREEN + Commit**

```bash
npx vitest run src/adventure/badgeWall.test.ts
git add src/adventure/badgeWall.ts src/adventure/badgeWall.test.ts
git commit -m "feat(adventure): 徽章墙选择器纯函数"
```

---

## Task 4: unlockSeen 本地缓存

**Files:**
- Create: `src/adventure/unlockSeen.ts`
- Create: `src/adventure/unlockSeen.test.ts`

- [ ] **Step 1: 测试 key 与解析**

```ts
import { describe, expect, it } from "vitest";
import { unlockSeenKey, parseUnlockSeen } from "./unlockSeen";

describe("unlockSeen", () => {
  it("builds space-scoped key", () => {
    expect(unlockSeenKey("space-1")).toBe("adventure:lastSeenUnlockedOrder:space-1");
  });

  it("parses integer or null", () => {
    expect(parseUnlockSeen("3")).toBe(3);
    expect(parseUnlockSeen(null)).toBeNull();
    expect(parseUnlockSeen("x")).toBeNull();
  });
});
```

- [ ] **Step 2: 实现**

```ts
import { getDatabase } from "../db/database";

export function unlockSeenKey(spaceId: string): string {
  return `adventure:lastSeenUnlockedOrder:${spaceId}`;
}

export function parseUnlockSeen(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function getLastSeenUnlockedOrder(spaceId: string): Promise<number | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_settings WHERE key = ?",
    [unlockSeenKey(spaceId)]
  );
  return parseUnlockSeen(row?.value ?? null);
}

export async function setLastSeenUnlockedOrder(spaceId: string, order: number): Promise<void> {
  const db = getDatabase();
  const key = unlockSeenKey(spaceId);
  await db.runAsync(
    "INSERT INTO local_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, String(order)]
  );
}
```

`spaceId` 来源：地图页 `getStoredAccount<{ spaceId: string }>()`（与账号缓存字段对齐；若字段名不同以 `authService` / stored account 实际类型为准）。

- [ ] **Step 3: 测 + Commit**

```bash
npx vitest run src/adventure/unlockSeen.test.ts
git add src/adventure/unlockSeen.ts src/adventure/unlockSeen.test.ts
git commit -m "feat(adventure): 本地记录已见解锁进度"
```

---

## Task 5: 徽章墙页面 + 进度舱入口

**Files:**
- Create: `app/adventure/badges.tsx`
- Modify: `app/(tabs)/adventure.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: 注册路由**

`app/_layout.tsx` Stack 增加：

```tsx
<Stack.Screen name="adventure/badges" options={{ title: "徽章收藏" }} />
```

- [ ] **Step 2: 实现 badges 页**

结构：

```tsx
// app/adventure/badges.tsx
// loadAdventureState via useSyncScreen
// buildBadgeWallItems / selectPendingClaims
// 顶部统计 claimedCount = items.filter(kind==="claimed").length
// 待兑现分区：selectPendingClaims → 点击 router.push(`/adventure/${id}`)
// FlatList/View 2 列网格：
//   claimed: emoji/图 + 名 + fulfillmentLabel 角标
//   unclaimed: 灰态 + 锁/序号；claimable 可强调
// EmptyState 若 claimedCount===0
// 使用 publicUrl(badgeImageKey) + RewardImage/Thumb 若有图
```

布局要点：

- 网格：`flexDirection: "row", flexWrap: "wrap"`，子项 `width: "48%"`。
- 角标 tone：pending → primary；fulfilled → success；cancelled → danger。
- 点击一律 `router.push(`/adventure/${chapterId}`)`。

- [ ] **Step 3: 进度舱**

在 `app/(tabs)/adventure.tsx`：

```tsx
{state.pendingFulfillmentCount > 0 ? (
  <Card /* 可点击 */ onPress={() => router.push("/adventure/badges")}>
    <AppText variant="bodyStrong">有 {state.pendingFulfillmentCount} 个现实惊喜待兑现</AppText>
    <AppText variant="caption" tone="muted">打开徽章墙查看进度</AppText>
  </Card>
) : null}

// 按钮区
<AppButton title="徽章收藏" variant="secondary" onPress={() => router.push("/adventure/badges")} />
```

若 `Card` 无 onPress，外包 `Pressable`。

- [ ] **Step 4: 手测清单（不写自动化）**

1. 有已领徽章时墙内可见。
2. 无可领 claim 时空态 CTA 进地图。
3. pending 提示出现且跳转墙。

- [ ] **Step 5: Commit**

```bash
git add app/adventure/badges.tsx app/\(tabs\)/adventure.tsx app/_layout.tsx
git commit -m "feat(adventure): 徽章收藏墙与进度舱入口"
```

---

## Task 6: 章节页兑现卡 + 领奖庆祝

**Files:**
- Create: `src/adventure/AdventureClaimCelebration.tsx`
- Modify: `app/adventure/[chapterId].tsx`

- [ ] **Step 1: 庆祝组件（最小可用）**

```tsx
// AdventureClaimCelebration.tsx
// props: visible, emoji, title, subtitle, onDone
// useReducedMotion: 若 true，visible 时立刻 onDone 或只显示 400ms 静态文案
// 否则 Reanimated：scale spring + 短粒子/光环 ~1.2s 后 onDone
// 不永久拦截：可用绝对定位 pointerEvents="box-none"，中心卡可点关闭
```

参考 `src/ui/CheckInCelebration.tsx` 的 `MiniCheckInBurst` 时序，但文案用徽章名。

- [ ] **Step 2: 章节页接入**

```tsx
const [celebrate, setCelebrate] = useState<{ emoji: string; title: string; subtitle: string } | null>(null);

async function onClaim() {
  // ...
  const next = await claimChapter(chapter.id);
  setState(next);
  setCelebrate({
    emoji: chapter.badgeEmoji ?? "🏅",
    title: chapter.badgeName,
    subtitle: chapter.rewardType === "real_pending" ? "现实惊喜已登记，等待兑现" : "徽章已收入收藏"
  });
}

// claimed + real_pending 兑现卡：
{chapter.viewStatus === "claimed" && chapter.rewardType === "real_pending" && chapter.claim ? (
  <Card>
    <Badge label={fulfillmentLabel(chapter.claim.fulfillmentStatus) ?? "状态"} /* tone 映射 */ />
    {/* pending / fulfilled(+date+note) / cancelled(+note) 文案按 design */}
  </Card>
) : null}

// 底部挂庆祝
<AdventureClaimCelebration
  visible={celebrate !== null}
  emoji={celebrate?.emoji ?? "🏅"}
  title={celebrate?.title ?? ""}
  subtitle={celebrate?.subtitle ?? ""}
  onDone={() => setCelebrate(null)}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/adventure/AdventureClaimCelebration.tsx app/adventure/\[chapterId\].tsx
git commit -m "feat(adventure): 章节兑现状态与领奖庆祝"
```

---

## Task 7: 地图新解锁轻反馈

**Files:**
- Modify: `app/adventure/map.tsx`
- Modify: `src/adventure/IslandMarker.tsx`（若需 `playPop` prop；尽量少改）

- [ ] **Step 1: map 加载后比较 lastSeen**

```tsx
// 在 state ready 后：
const account = await getStoredAccount<{ spaceId?: string }>();
const spaceId = account?.spaceId;
if (spaceId) {
  const last = await getLastSeenUnlockedOrder(spaceId);
  if (shouldPlayUnlockFeedback(state.highestUnlockedOrder, last)) {
    setUnlockPulseOrder(state.highestUnlockedOrder); // 高亮 sortOrder === this 的岛一次
  }
  await setLastSeenUnlockedOrder(spaceId, state.highestUnlockedOrder);
}
```

- [ ] **Step 2: 传给 WorldMapCanvas / IslandMarker**

优先：给 `IslandMarker` 增加 optional `emphasizeOnce?: boolean`，mount 时 scale 1→1.08→1 一次（减动效跳过）。

若改动面过大：仅在地图顶栏 HelperText 闪一次「新解锁至第 N 章」2 秒（保底，仍满足「有一次轻反馈」）。

- [ ] **Step 3: Commit**

```bash
git add app/adventure/map.tsx src/adventure/IslandMarker.tsx src/adventure/WorldMapCanvas.tsx
git commit -m "feat(adventure): 地图新解锁一次反馈"
```

---

## Task 8: 全量验证

- [ ] **Step 1: 测试**

```bash
cd server && npm test -- src/adventure
cd .. && npx vitest run src/adventure
npx tsc --noEmit
```

Expected: 相关测试 PASS；`tsc` 无新增错误。

- [ ] **Step 2: 手工验收对照 design §验收**

1. 进度舱 → 徽章墙；已领/剪影  
2. real_pending 领取后待兑现；admin 兑现后已兑现  
3. 取消后已取消且徽章仍在  
4. 领奖庆祝；减动效可完成  
5. 地图新解锁一次反馈，再进不重复  
6. 解锁/幂等/不回锁/admin 无回归  

- [ ] **Step 3: 最终 commit（若有修复）**

```bash
git add -A
git commit -m "test(adventure): 闭环补齐验收修复"
```

---

## Spec Coverage Checklist

| Spec 要求 | Task |
| --- | --- |
| state.claims / pendingFulfillmentCount | Task 1 |
| chapter.claim 摘要 | Task 1 |
| listClaims 徽章展示字段 | Task 1 Step 3 |
| 客户端类型 | Task 2 |
| 徽章墙网格 / 待兑现区 / 空态 | Task 3 + 5 |
| 进度舱入口与待兑现卡 | Task 5 |
| 章节兑现卡 | Task 6 |
| 领奖庆祝 + reduced motion | Task 6 |
| 地图 lastSeen 反馈 | Task 4 + 7 |
| 不新表 / 不改解锁算法 | 全程 |
| 零回归验证 | Task 8 |

---

## 非目标（实现时禁止顺手做）

- 推送通知、Tab badge 推送通道  
- Region / map_x override  
- 双人贡献、回忆图文  
- 用户侧 fulfill API  
- 新建 badge_collection 表  
