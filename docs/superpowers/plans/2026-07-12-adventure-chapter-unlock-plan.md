# Adventure Chapter Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 为每个 space 增加线性世界地图章节：累计获得 XP（`lifetimeEarned`）达标自动解锁，手动领取徽章/叙事奖励；第 5 Tab 展示进度舱与地图。

**Architecture:** 服务端权威。PostgreSQL 存 `adventure_chapters` / `adventure_progress` / `adventure_claims`；纯函数计算线性解锁；专用 `/api/adventure` 路由负责读状态、幂等推进、领奖。客户端只读钱包 `lifetimeEarned` + 调 adventure API，不另建积分。XP 入账成功后触发 `advance`。阶段 1 用种子章节，不做管理端 CRUD。

**Tech Stack:** Expo Router、React Native、TypeScript、Vitest、Express、PostgreSQL、现有 JWT 鉴权与 WebSocket 同步失效。

**Design source:** `docs/superpowers/specs/2026-07-12-adventure-chapter-unlock-design.md`

---

## Scope Check

本计划只覆盖阶段 1 可玩闭环。不做：管理端 CRUD、现实惊喜兑现、章内多关卡、扣 XP、回锁已解锁章节。

---

## File Structure

### Create

| Path | Responsibility |
| --- | --- |
| `server/src/adventure/adventureRules.ts` | 纯函数：线性解锁推进、章节视图状态 |
| `server/src/adventure/adventureRules.test.ts` | 规则单测 |
| `server/src/adventure/adventureSeed.ts` | 默认 6 章种子数据（可替换文案） |
| `server/src/adventure/adventureRepository.ts` | SQL 读写 chapters/progress/claims |
| `server/src/adventure/adventureService.ts` | ensureSeed、advance、claim、getState |
| `server/src/adventure/adventureService.test.ts` | 服务逻辑单测（可用内存 fake 或 pg mock 风格与现有 server 测试一致） |
| `server/src/adventure/adventureRoutes.ts` | `GET /state` `POST /claim` |
| `src/adventure/types.ts` | 客户端 DTO / 视图类型 |
| `src/adventure/adventureClient.ts` | 调 `/api/adventure/*` |
| `src/adventure/adventureService.ts` | 加载状态、领取、未领数量 |
| `src/adventure/adventureService.test.ts` | 客户端编排测试（mock client） |
| `app/(tabs)/adventure.tsx` | Tab 主页进度舱 |
| `app/adventure/map.tsx` | 世界地图详情 |
| `app/adventure/[chapterId].tsx` | 章节页（叙事 + 领取） |

### Modify

| Path | Change |
| --- | --- |
| `server/src/db/schema.ts` | 三表 DDL |
| `server/src/index.ts` | 挂载 adventure 路由 |
| `server/src/auth/accountRepository.ts` | 创建 space 时 seed + ensure progress |
| `server/src/data/dataRoutes.ts` | 钱包交易成功且 earned 增加后 `advance` + 通知 `adventure` |
| `src/sync/dataClient.ts` | 若需：ResourceName 不必加 chapters（阶段 1 走专用 API）；同步失效 resource 名 `adventure` |
| `app/(tabs)/_layout.tsx` | 第 5 Tab「闯关」 |
| `app/_layout.tsx` | 注册 `adventure/map`、`adventure/[chapterId]` |
| `src/xp/xpService.ts` 或今日页 | 打卡发 XP 成功后刷新闯关/依赖 WS；客户端在 XP 成功后可 `GET /api/adventure/state`（服务端已 advance） |
| `src/sync/syncInvalidation` 使用方（今日/商城模式） | 闯关页订阅 `resource === "adventure" \|\| resource === "wallet"` 刷新 |

---

## Task 1: 线性解锁纯函数（TDD）

**Files:**
- Create: `server/src/adventure/adventureRules.ts`
- Create: `server/src/adventure/adventureRules.test.ts`

- [x] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import {
  advanceHighestUnlockedOrder,
  buildChapterViews,
  type AdventureChapterConfig
} from "./adventureRules.js";

const chapters: AdventureChapterConfig[] = [
  { id: "c1", sortOrder: 1, thresholdLifetimeXp: 50, status: "published" },
  { id: "c2", sortOrder: 2, thresholdLifetimeXp: 150, status: "published" },
  { id: "c3", sortOrder: 3, thresholdLifetimeXp: 300, status: "published" },
  { id: "draft", sortOrder: 4, thresholdLifetimeXp: 10, status: "draft" }
];

describe("advanceHighestUnlockedOrder", () => {
  it("starts at 0 and unlocks chapter 1 when lifetime enough", () => {
    expect(advanceHighestUnlockedOrder(chapters, 0, 49)).toBe(0);
    expect(advanceHighestUnlockedOrder(chapters, 0, 50)).toBe(1);
  });

  it("requires previous unlock before later chapters even if XP is high", () => {
    // highest=0 时即使 999 XP 也只能推到线性允许的最大连续前缀
    expect(advanceHighestUnlockedOrder(chapters, 0, 999)).toBe(3);
  });

  it("never decreases highest", () => {
    expect(advanceHighestUnlockedOrder(chapters, 2, 0)).toBe(2);
  });

  it("ignores draft/archived chapters in the linear chain", () => {
    expect(advanceHighestUnlockedOrder(chapters, 0, 999)).toBe(3);
  });
});

describe("buildChapterViews", () => {
  it("marks locked / claimable / claimed / locked-future", () => {
    const views = buildChapterViews({
      chapters,
      highestUnlockedOrder: 2,
      claimedChapterIds: new Set(["c1"]),
      lifetimeEarned: 200
    });
    expect(views.find((v) => v.id === "c1")?.viewStatus).toBe("claimed");
    expect(views.find((v) => v.id === "c2")?.viewStatus).toBe("claimable");
    expect(views.find((v) => v.id === "c3")?.viewStatus).toBe("locked");
    expect(views.find((v) => v.id === "draft")).toBeUndefined();
  });
});
```

- [x] **Step 2: 跑测确认 RED**

Run: `cd server && npm test -- src/adventure/adventureRules.test.ts`

Expected: FAIL（模块不存在）

- [x] **Step 3: 实现规则**

```ts
export type AdventureChapterStatus = "published" | "draft" | "archived";

export type AdventureChapterConfig = {
  id: string;
  sortOrder: number;
  thresholdLifetimeXp: number;
  status: AdventureChapterStatus;
};

export type ChapterViewStatus = "locked" | "claimable" | "claimed";

export type ChapterView = AdventureChapterConfig & {
  viewStatus: ChapterViewStatus;
};

export function publishedChapters(chapters: AdventureChapterConfig[]): AdventureChapterConfig[] {
  return chapters
    .filter((chapter) => chapter.status === "published")
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * 只增不减。从 sort_order=1 起连续解锁：
 * 当 highest 已覆盖 order-1（或 order===1）且 lifetimeEarned >= threshold 时解锁 order。
 */
export function advanceHighestUnlockedOrder(
  chapters: AdventureChapterConfig[],
  currentHighest: number,
  lifetimeEarned: number
): number {
  const list = publishedChapters(chapters);
  let highest = Math.max(0, currentHighest);

  for (const chapter of list) {
    if (chapter.sortOrder <= highest) {
      continue;
    }
    const previousOk = chapter.sortOrder === 1 || highest >= chapter.sortOrder - 1;
    if (!previousOk || lifetimeEarned < chapter.thresholdLifetimeXp) {
      break;
    }
    highest = chapter.sortOrder;
  }

  return highest;
}

export function buildChapterViews(input: {
  chapters: AdventureChapterConfig[];
  highestUnlockedOrder: number;
  claimedChapterIds: Set<string>;
  lifetimeEarned: number;
}): ChapterView[] {
  return publishedChapters(input.chapters).map((chapter) => {
    const unlocked = chapter.sortOrder <= input.highestUnlockedOrder;
    if (!unlocked) {
      return { ...chapter, viewStatus: "locked" };
    }
    if (input.claimedChapterIds.has(chapter.id)) {
      return { ...chapter, viewStatus: "claimed" };
    }
    return { ...chapter, viewStatus: "claimable" };
  });
}

export function countClaimable(views: ChapterView[]): number {
  return views.filter((view) => view.viewStatus === "claimable").length;
}
```

- [x] **Step 4: 跑测确认 GREEN**

Run: `cd server && npm test -- src/adventure/adventureRules.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add server/src/adventure/adventureRules.ts server/src/adventure/adventureRules.test.ts
git commit -m "feat(adventure): 添加线性解锁纯函数与单测"
```

---

## Task 2: Schema 与种子数据

**Files:**
- Modify: `server/src/db/schema.ts`
- Create: `server/src/adventure/adventureSeed.ts`

- [x] **Step 1: 在 SCHEMA_SQL 末尾（admin_settings 后）追加三表**

```sql
CREATE TABLE IF NOT EXISTS adventure_chapters (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  story_text TEXT NOT NULL,
  threshold_lifetime_xp INTEGER NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_emoji TEXT,
  reward_type TEXT NOT NULL DEFAULT 'badge_story',
  map_theme_key TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(space_id, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_adventure_chapters_space ON adventure_chapters(space_id);

CREATE TABLE IF NOT EXISTS adventure_progress (
  space_id TEXT PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
  highest_unlocked_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adventure_claims (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES adventure_chapters(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_by TEXT,
  UNIQUE(space_id, chapter_id)
);
CREATE INDEX IF NOT EXISTS idx_adventure_claims_space ON adventure_claims(space_id);
```

- [x] **Step 2: 实现种子**

`adventureSeed.ts` 导出：

```ts
export type SeedChapter = {
  sortOrder: number;
  title: string;
  subtitle: string;
  storyText: string;
  thresholdLifetimeXp: number;
  badgeName: string;
  badgeDescription: string;
  badgeEmoji: string;
  mapThemeKey: string;
};

/** 占位世界观：双人小旅程。上线前可整表替换文案。 */
export const DEFAULT_ADVENTURE_SEED: SeedChapter[] = [
  {
    sortOrder: 1,
    title: "启程灯塔",
    subtitle: "第一次把约定写进日历",
    storyText: "你们在灯塔下约好：每天只前进一点点。海风不急，光会一直亮着。",
    thresholdLifetimeXp: 50,
    badgeName: "启程徽章",
    badgeDescription: "迈出第一段共享旅程",
    badgeEmoji: "🏮",
    mapThemeKey: "lighthouse"
  },
  {
    sortOrder: 2,
    title: "林间小径",
    subtitle: "连续的脚步声",
    storyText: "小路不宽，却刚好容得下两个人并肩。落叶记得你们走过的日子。",
    thresholdLifetimeXp: 150,
    badgeName: "林径徽章",
    badgeDescription: "习惯开始有了回声",
    badgeEmoji: "🌲",
    mapThemeKey: "forest"
  },
  {
    sortOrder: 3,
    title: "河边集市",
    subtitle: "把坚持换成微笑",
    storyText: "集市上没有人催促。你们用一点一点攒下的光，换一袋甜的回忆。",
    thresholdLifetimeXp: 300,
    badgeName: "集市徽章",
    badgeDescription: "奖励自己温柔一点",
    badgeEmoji: "🧺",
    mapThemeKey: "market"
  },
  {
    sortOrder: 4,
    title: "星空营地",
    subtitle: "停下来也算前进",
    storyText: "帐篷外是很长的夜。你们数星星，也数一起完成的小目标。",
    thresholdLifetimeXp: 500,
    badgeName: "营地徽章",
    badgeDescription: "休息是旅程的一部分",
    badgeEmoji: "⛺",
    mapThemeKey: "camp"
  },
  {
    sortOrder: 5,
    title: "云上桥梁",
    subtitle: "跨过容易放弃的那天",
    storyText: "桥在云里若隐若现。握住栏杆的手是热的——另一只手也是。",
    thresholdLifetimeXp: 800,
    badgeName: "云桥徽章",
    badgeDescription: "一起跨过动摇",
    badgeEmoji: "🌉",
    mapThemeKey: "bridge"
  },
  {
    sortOrder: 6,
    title: "山顶邮局",
    subtitle: "给未来的两个人",
    storyText: "山顶有一封未寄出的信：谢谢你们没有只靠热情，还靠了日程表。",
    thresholdLifetimeXp: 1200,
    badgeName: "山顶徽章",
    badgeDescription: "阶段旅程的纪念戳",
    badgeEmoji: "⛰️",
    mapThemeKey: "summit"
  }
];
```

- [x] **Step 3: Commit**

```bash
git add server/src/db/schema.ts server/src/adventure/adventureSeed.ts
git commit -m "feat(adventure): 添加章节表结构与默认种子"
```

---

## Task 3: Repository + Service（ensure / advance / claim / getState）

**Files:**
- Create: `server/src/adventure/adventureRepository.ts`
- Create: `server/src/adventure/adventureService.ts`
- Create: `server/src/adventure/adventureService.test.ts`

- [x] **Step 1: Repository 最小接口**

```ts
// adventureRepository.ts 关键能力：
// listChapters(client, spaceId)
// ensureProgress(client, spaceId)
// getProgress(client, spaceId) -> { highestUnlockedOrder, updatedAt }
// setHighestUnlockedOrder(client, spaceId, order)
// listClaimedChapterIds(client, spaceId) -> string[]
// insertClaim(client, { id, spaceId, chapterId, claimedBy }) -> 'inserted' | 'exists'
// countChapters(client, spaceId) -> number
// insertSeedChapters(client, spaceId, rows)
```

插入种子时用 `randomUUID()` 生成 chapter id；`reward_type` 固定 `badge_story`；`status` 固定 `published`。

- [x] **Step 2: Service API**

```ts
export async function ensureAdventureForSpace(spaceId: string): Promise<void>
// 无章节则插入 DEFAULT_ADVENTURE_SEED；ensure progress 行

export async function getAdventureState(spaceId: string): Promise<AdventureStateDto>
// ensure seed + ensureWallet 读 lifetimeEarned
// advance 写 progress（只增）
// 返回：lifetimeEarned, highestUnlockedOrder, chapters: ChapterViewDto[], claimableCount, nextChapter?

export async function claimAdventureChapter(
  spaceId: string,
  chapterId: string,
  accountId: string
): Promise<{ ok: true; state: AdventureStateDto } | { ok: false; error: string; status: number }>
// 先 get/advance；章节必须 published 且 sortOrder <= highest；insertClaim；再返回 state
```

`ChapterViewDto` 含：id, sortOrder, title, subtitle, storyText, thresholdLifetimeXp, badgeName, badgeDescription, badgeEmoji, mapThemeKey, viewStatus, rewardType。

错误映射：

- 章节不存在 → 404
- 未解锁 → 400 `"章节尚未解锁"`
- 已领取（冲突）→ 200 幂等返回最新 state，或 409；**推荐 200 + 已 claimed 状态**（客户端更好处理）

- [x] **Step 3: 服务测试要点（不连真库时测纯编排；若项目惯用真逻辑则测 rules+分支）**

至少覆盖（可把 DB 侧抽成 interface mock）：

1. lifetime 50 → highest 变为 1，c1 claimable  
2. claim 后 c1 claimed，claimableCount 减 1  
3. lifetime 999 且从 0 推进 → highest 到 6（种子 6 章）  
4. highest 已是 3、lifetime 降到 0 → highest 仍为 3  

若 server 测试目前偏纯函数，可先测 `adventureRules` + service 内对 mock repo 的调用；有集成环境再补 SQL 测试。

- [x] **Step 4: Commit**

```bash
git add server/src/adventure/
git commit -m "feat(adventure): 实现章节种子、推进与领奖服务"
```

---

## Task 4: HTTP 路由 + 挂载 + Space 创建时 seed

**Files:**
- Create: `server/src/adventure/adventureRoutes.ts`
- Modify: `server/src/index.ts`
- Modify: `server/src/auth/accountRepository.ts`

- [x] **Step 1: 路由**

```ts
// GET  /api/adventure/state   -> getAdventureState(spaceId)
// POST /api/adventure/claim   body: { chapterId: string } -> claimAdventureChapter(...)
```

鉴权：与 data 路由相同，使用 `requireAuth`（从 `request.spaceId` / `request.accountId` 取，字段名与现有 middleware 一致——实现时对照 `authMiddleware` 实际挂载属性）。

- [x] **Step 2: index 挂载**

```ts
import { createAdventureRouter } from "./adventure/adventureRoutes.js";

app.use("/api/adventure", requireAuth, createAdventureRouter({ onChange: notifySyncChange }));
```

claim / advance 写库后 `onChange?.(spaceId, "adventure")`。

- [x] **Step 3: 注册 space 时 seed**

在 `registerAccount` 与「创建新 space」路径（`INSERT INTO spaces` 成功后）调用：

```ts
await ensureAdventureForSpace(spaceId);
```

注意：`join space` **不要**重复 seed 另一套章节。  
「迁出新建 space」路径同样在新 spaceId 上 ensure。

- [x] **Step 4: 历史 space 懒迁移**

`getAdventureState` 内 `ensureAdventureForSpace` 已覆盖：老 space 第一次打开闯关时补种并 advance。无需单独 migration job。

- [x] **Step 5: Commit**

```bash
git add server/src/adventure/adventureRoutes.ts server/src/index.ts server/src/auth/accountRepository.ts
git commit -m "feat(adventure): 暴露闯关 API 并在建 space 时播种"
```

---

## Task 5: XP 入账后推进解锁

**Files:**
- Modify: `server/src/data/dataRoutes.ts`（`createWalletRouter`）

- [x] **Step 1: 在 POST `/transactions` 成功且 `earnedDelta > 0` 时 advance**

在返回 JSON 前（事务已提交后）：

```ts
if (earnedDelta > 0) {
  try {
    await advanceAdventureAfterEarn(spaceId); // 内部 getAdventureState 或 service.advanceOnly
    options.onChange?.(spaceId, "adventure");
  } catch (error) {
    console.warn("adventure advance failed", error);
    // 不阻断 XP 入账响应
  }
}
```

实现时避免循环依赖：优先在 `adventureService` 导出 `advanceAdventureProgress(spaceId)`，由 wallet 路由动态 import 或从 adventure 模块静态 import（`dataRoutes` → `adventureService` 可以；**禁止** adventure 再 import dataRoutes）。

- [x] **Step 2: 手动验证思路**

1. 钱包 lifetime 提到 ≥50  
2. `GET /api/adventure/state` → highestUnlockedOrder >= 1  
3. 商城 spend 不降 highest  

- [x] **Step 3: Commit**

```bash
git add server/src/data/dataRoutes.ts server/src/adventure/adventureService.ts
git commit -m "feat(adventure): XP 入账后幂等推进章节解锁"
```

---

## Task 6: 客户端 types + client + service

**Files:**
- Create: `src/adventure/types.ts`
- Create: `src/adventure/adventureClient.ts`
- Create: `src/adventure/adventureService.ts`
- Create: `src/adventure/adventureService.test.ts`

- [x] **Step 1: 类型对齐服务端 DTO**

```ts
export type ChapterViewStatus = "locked" | "claimable" | "claimed";

export type AdventureChapterView = {
  id: string;
  sortOrder: number;
  title: string;
  subtitle: string | null;
  storyText: string;
  thresholdLifetimeXp: number;
  badgeName: string;
  badgeDescription: string | null;
  badgeEmoji: string | null;
  mapThemeKey: string | null;
  rewardType: string;
  viewStatus: ChapterViewStatus;
};

export type AdventureState = {
  lifetimeEarned: number;
  highestUnlockedOrder: number;
  claimableCount: number;
  chapters: AdventureChapterView[];
  nextChapter: AdventureChapterView | null;
};
```

- [x] **Step 2: Client**

```ts
import { apiRequest } from "../sync/apiClient";
import type { AdventureState } from "./types";

export function fetchAdventureState(): Promise<AdventureState> {
  return apiRequest<AdventureState>("/api/adventure/state");
}

export function claimAdventureChapter(chapterId: string): Promise<AdventureState> {
  return apiRequest<AdventureState>("/api/adventure/claim", {
    method: "POST",
    body: { chapterId }
  });
}
```

（若 `apiRequest` 对错误抛错，claim 已领幂等应由服务端 200 返回 state。）

- [x] **Step 3: Service 薄封装**

```ts
export async function loadAdventureState(): Promise<AdventureState> {
  return fetchAdventureState();
}

export async function claimChapter(chapterId: string): Promise<AdventureState> {
  return claimAdventureChapter(chapterId);
}
```

测试：mock `adventureClient`，断言透传。

- [x] **Step 4: Commit**

```bash
git add src/adventure
git commit -m "feat(adventure): 添加客户端闯关 API 封装"
```

---

## Task 7: 第 5 Tab 进度舱 UI

**Files:**
- Create: `app/(tabs)/adventure.tsx`
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/_layout.tsx`（若 stack 需要；Tab 内页可先自包含）

- [x] **Step 1: Tab 配置**

在 `TAB_ITEMS` 增加一项（插在「商城」前或后，推荐商城前强调成长）：

```ts
{ active: "map", inactive: "map-outline", motion: "gift", name: "adventure", title: "闯关" }
```

`motion` 若类型不允许新值，复用现有 `"gift"` 或扩展 `TabMotion`（扩展时同步动画分支，给 map 一个轻缩放即可）。

- [x] **Step 2: 进度舱页面结构**

`adventure.tsx`：

- `useFocusEffect` / mount 时 `loadAdventureState`
- 订阅 sync invalidation：`resource === "adventure" || resource === "wallet"` 时刷新（对照 `shop.tsx` / `index.tsx` 现有订阅写法）
- UI 区块：
  1. 顶部氛围区（主题渐变，用 `useTheme()`）
  2. 大进度：`highestUnlockedOrder / chapters.length` 或环形百分比
  3. 文案：`累计 {lifetimeEarned} XP`
  4. 下一章：`nextChapter` 标题 + 还差 `max(0, threshold - lifetimeEarned)` XP
  5. 未领：`claimableCount > 0` 时主按钮「领取奖励」→ 跳转地图或第一章 claimable
  6. 次按钮「打开地图」→ `router.push("/adventure/map")`
- 加载中 / 错误态 / 未登录态：与商城页一致处理（无 token 提示去账号页）

- [x] **Step 3: 视觉要求（阶段 1）**

- 禁止整页纯 `FlatList` 白卡片堆叠作为主表达
- 至少：渐变头图区 + 进度环/条 + 当前章强调卡片 + 地图 CTA
- 节点精致插画可后补；颜色与圆角跟随 `ThemeContext`

- [x] **Step 4: 手动 smoke**

Run: `npm run web` 或 Expo；登录后看到 5 个 Tab，「闯关」可加载（后端需已部署 schema）。

- [x] **Step 5: Commit**

```bash
git add app/(tabs)/adventure.tsx app/(tabs)/_layout.tsx
git commit -m "feat(adventure): 新增闯关 Tab 与进度舱"
```

---

## Task 8: 地图详情 + 章节页 + 领取

**Files:**
- Create: `app/adventure/map.tsx`
- Create: `app/adventure/[chapterId].tsx`
- Modify: `app/_layout.tsx`

- [x] **Step 1: Stack 注册**

```ts
<Stack.Screen name="adventure/map" options={{ title: "世界地图" }} />
<Stack.Screen name="adventure/[chapterId]" options={{ title: "章节" }} />
```

- [x] **Step 2: 地图页**

- 竖向 `ScrollView` 路径：每个 published 章一个节点
- 节点视觉：
  - `claimed`：实心 + 勾 + badgeEmoji
  - `claimable`：高亮描边 + 「可领取」
  - `locked`：虚线/降透明度 + 锁 + 门槛 XP
- 节点之间连线（View 竖线）
- 点击 → `router.push(`/adventure/${id}`)`
- 顶部简要：累计 XP、claimableCount

- [x] **Step 3: 章节页**

- 展示 title、subtitle、storyText、门槛、徽章预览
- `claimable`：主按钮「领取徽章」→ `claimChapter` → 更新本地 state → 轻提示
- `claimed`：展示「已获得」与领取时间不必强求（state 无时间可省略）
- `locked`：禁用按钮，说明还差 XP 或需先完成上一章

- [x] **Step 4: Commit**

```bash
git add app/adventure app/_layout.tsx
git commit -m "feat(adventure): 世界地图与章节领取页"
```

---

## Task 9: 与打卡/同步闭环 + 验收

**Files:**
- Modify: 今日页或 XP 成功回调处（`app/(tabs)/index.tsx` 中发 XP 成功后的逻辑）——若 WS 已推 `wallet`/`adventure`，闯关页 focus 刷新即可；可选在 XP toast 增加「旅程有新进展」当 claimable 增加（YAGNI 则可跳过 toast）
- 确认双端：`server` 与 `app` 测试

- [x] **Step 1: 服务端测试**

Run:

```bash
cd server && npm test
```

Expected: 全绿（含 adventureRules）

- [x] **Step 2: 客户端测试**

Run:

```bash
npm test -- src/adventure
npx tsc --noEmit
```

Expected: 相关测试通过；无类型错误

- [x] **Step 3: 手工验收清单（对照 spec）**

1. 新注册 space：6 章种子，highest=0  
2. 打卡攒 XP 到 50：自动解锁第 1 章，地图 claimable  
3. 领取后 claimed，重复点不报错、不双徽章  
4. 商城兑换后进度不变  
5. 撤销打卡若 lifetime 下降：已解锁不回锁  
6. 第二账号同 space：同步后状态一致  
7. UI：进度舱 + 路径地图，非纯卡片墙  

- [x] **Step 4: 最终 Commit（若有修复）**

```bash
git add -A
git commit -m "fix(adventure): 闭环同步与验收问题修复"
```

---

## Spec Coverage（自检）

| Spec 要求 | Task |
| --- | --- |
| lifetimeEarned 门槛、不扣余额 | 1, 3, 5 |
| 严格线性自动解锁 | 1, 3, 5 |
| 手动领奖幂等 | 3, 4, 8 |
| 不回锁 / 已领不收回 | 1, 3 |
| 与商城并行 | 5 验收、9 |
| 第 5 Tab + 进度舱 + 地图 | 7, 8 |
| 徽章+叙事，预留 real 类型 | 2 schema `reward_type` |
| 种子 + 懒迁移 | 2, 3, 4 |
| 双人同步 | 4 onChange、7 订阅、9 |
| 阶段 2 管理端 | 明确不做 |

## Placeholder Scan

无 TBD 实现步骤；种子文案为可替换占位，符合 spec 开放项。

## Type Consistency

- `viewStatus`: `locked | claimable | claimed`
- `highestUnlockedOrder`: number，0 表示尚未解锁第 1 章
- 同步 resource 名：`"adventure"`
- 路由前缀：`/api/adventure`

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-12-adventure-chapter-unlock-plan.md`.

**Two execution options:**

1. **Subagent-Driven（推荐）** — 每任务新开子代理，任务间 review，迭代快  
2. **Inline Execution** — 本会话按 `executing-plans` 连续执行并设检查点  

Which approach?
