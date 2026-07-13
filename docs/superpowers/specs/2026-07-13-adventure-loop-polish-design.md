# 冒险岛闭环补齐设计

## 状态

- 日期：2026-07-13
- 状态：已确认（待实现计划）
- 范围：徽章收藏墙 + 用户侧现实惊喜兑现状态 + 领奖/解锁庆祝反馈
- 前置：线性章节解锁、群岛地图 Phase1+2、管理端章节 CRUD、`real_pending` 管理端兑现流已落地
- 路线：方案 1 — 状态扩展 + 轻页面（不新建表）
- 不改：`lifetimeEarned` 线性解锁、领奖幂等、不回锁、双人 space 共享进度、owner 专属兑现写操作

## 背景

闯关主链路已可玩：打卡涨累计 XP → 自动解锁章节 → 手动领奖 → 管理端可配置章节与兑现现实惊喜。缺口集中在用户侧「收获得见、兑现可见、情绪有峰值」：

1. 已获徽章只在章节页零散展示，没有收藏墙。
2. `real_pending` 领取后，兑现状态仅管理端可见，用户不知道是否已兑现。
3. 领奖/新解锁反馈弱于打卡庆祝体系（`CheckInCelebration` / `MiniCheckInBurst`）。

管理端 `adventure_claims` 已具备 `fulfillment_status`、`fulfilled_at`、`cancelled_at`、`note`、`claimed_by`，缺的是用户可读暴露与 UI。

## 一句话目标

在不改解锁/领奖核心规则的前提下，为 space 成员补齐 **徽章收藏墙、现实惊喜用户侧状态、领奖与新解锁庆祝**，形成「解锁 → 领取 → 收藏 →（可选）兑现」的完整闭环。

## 目标

1. 从闯关域内进入徽章墙，一览已获徽章与未解锁剪影。
2. 现实惊喜领取后，用户侧可见 `pending → fulfilled / cancelled`；owner 备注对双方可读。
3. 领奖成功有明确庆祝；进入地图时若发现新解锁，有一次轻量反馈。
4. 支持系统「减少动态效果」：减动效时跳过循环/重动画，流程仍可完成。
5. 解锁算法、幂等领取、不回锁、管理端 CRUD/兑现、双人一致性 **零回归**。

## 非目标（本期）

- 不做推送 / 本地系统通知 / Tab 角标推送通道扩展。
- 不做 Region 分区、坐标 override、用户共创上传岛图。
- 不做双人 XP 贡献条、领章共同回忆图文。
- 不新建 `badge_collection` 等独立收藏表。
- 不改 XP 经济、商城、回锁策略。
- 不做用户侧 fulfill/cancel 写接口（兑现写操作仍仅 owner admin）。
- 不做音效、强制长时全屏阻断。

## 方案选型

| 方案 | 摘要 | 结论 |
| --- | --- | --- |
| 1 状态扩展 + 轻页面 | claims 并入用户 state；徽章墙/章节卡/庆祝 | **采用** |
| 2 纯前端聚合 | 仅用 chapters 状态；用户不见兑现细节 | 否决（闭环不完整） |
| 3 独立收藏子系统 | 新表双写 | 否决（过重，重复 claims） |

## 信息架构

```
闯关 Tab（进度舱）
  ├─ 主 CTA：打开世界地图 / 去领取
  ├─ 次 CTA：徽章收藏墙
  └─ 待兑现提示条（pendingFulfillmentCount > 0）

世界地图
  └─ 点岛 → 章节页

章节页
  ├─ 叙事 + 领奖（既有）
  ├─ 兑现状态卡（real_pending 且已领）
  └─ 领奖成功 → AdventureClaimCelebration

徽章墙 /adventure/badges
  ├─ 顶部统计：已获 n / 已发布章节 m
  ├─ 待兑现分区（若有）
  └─ 网格：已获彩色 / 未获剪影
```

## 核心规则（不变 + 补充）

| 项 | 约定 |
| --- | --- |
| 进度主体 | 每个 space 共享一条章节线与 claim 集合 |
| 解锁 / 领奖 | 与既有设计一致：线性 + `lifetimeEarned` + 手动领 + `UNIQUE(space_id, chapter_id)` |
| 撤销打卡 | 不回锁、不收回徽章 |
| 取消兑现 | 仅改 `fulfillment_status`；章节仍 `claimed`；徽章仍在墙 |
| 谁可兑现 | 仅 owner（现 admin 路由）；member 只读 |
| note | 双方可读；用户不可编辑 |
| 徽章墙数据源 | `published` 章节 + space claims；无 claim 的章显示为未获 |

## 数据与 API

### 原则

- **不新建表**，不改 claims 写路径语义。
- 扩展 `GET /api/adventure/state` 与 `POST /api/adventure/claim` 的返回体。
- 管理端 `/admin/claims` 与 fulfill/cancel 行为不变。

### Claim 摘要 DTO

```ts
type AdventureClaimSummary = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  badgeName: string;
  badgeEmoji: string | null;
  badgeImageKey: string | null;
  rewardType: string; // badge_story | real_pending
  claimedAt: string;
  claimedBy: string | null;
  fulfillmentStatus: "none" | "pending" | "fulfilled" | "cancelled";
  fulfilledAt: string | null;
  cancelledAt: string | null;
  note: string | null;
};
```

### `AdventureState` 扩展

```ts
type AdventureState = {
  lifetimeEarned: number;
  highestUnlockedOrder: number;
  claimableCount: number;
  chapters: AdventureChapterView[];
  nextChapter: AdventureChapterView | null;
  // 新增
  claims: AdventureClaimSummary[];
  pendingFulfillmentCount: number; // fulfillmentStatus === "pending"
};
```

### 章节视图挂载 claim（推荐）

在 `AdventureChapterView` 增加：

```ts
claim: {
  fulfillmentStatus: AdventureFulfillmentStatus;
  claimedAt: string;
  note: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
} | null;
```

- `viewStatus !== "claimed"` 时 `claim` 恒为 `null`。
- 实现优先挂在 chapter 上，减少页面侧 `claims.find`。
- 徽章墙仍可用 `chapters + claims` 双源构建网格。

### 映射规则

| 章节奖励类型 | 领取后 fulfillmentStatus | 用户侧展示 |
| --- | --- | --- |
| `badge_story` | `none` | 已获徽章；无兑现卡 |
| `real_pending` | `pending` → owner 操作后 `fulfilled` / `cancelled` | 兑现状态卡 + 墙角标 |

### 同步

- 既有 `onChange(spaceId, "adventure")` 覆盖 claim / fulfill / cancel。
- 客户端 `useSyncScreen` 刷新后进度舱、地图、徽章墙、章节页一致。
- 不新增 WebSocket 资源名。

### 兼容

- 字段只增不删；旧客户端忽略 `claims` 仍可玩主链路。
- 章节数预期为十级量级；claims 摘要字段控制体积。

## 界面与交互

### 进度舱 `app/(tabs)/adventure.tsx`

1. 保留主 CTA：有可领 →「去领取奖励」，否则「打开世界地图」。
2. 新增次 CTA：「徽章收藏」→ `/adventure/badges`。
3. 当 `pendingFulfillmentCount > 0`：提示卡「有 N 个现实惊喜待兑现」，点击进徽章墙（优先锚定待兑现区）。
4. 文案区分「可领取徽章」与「待兑现惊喜」，避免混称「奖励」。

### 徽章墙 `app/adventure/badges.tsx`（新）

**顶部**

- 标题「徽章收藏」。
- 统计：`已获 {claimedCount} / {publishedCount}`。
- 可选副文案：累计 XP（来自 state）。

**待兑现分区**

- 仅当存在 `fulfillmentStatus === "pending"` 的 claim。
- 列表或横滑卡片：章节名 + 徽章名 +「待兑现」角标。
- 点击 → 对应章节页。

**网格**

- 默认 2 列。
- **已获**：emoji 或 `badgeImageKey` 图 + 徽章名 + 章节短标题；`real_pending` 角标：
  - pending → 主色「待兑现」
  - fulfilled → 成功色「已兑现」
  - cancelled → 危险色弱化「已取消」
  - none（叙事徽章）→ 无兑现角标，可显示「已获得」
- **未获**（locked 或 claimable 未领）：灰剪影/低透明 + 序号或锁；claimable 可强调「可领取」。
- **点击**：任意状态进入章节页（锁定页只读门槛，与地图一致）。

**空态**

- 尚无任何 claim：插画/文案「去地图点亮第一座岛」+ CTA 打开世界地图。

### 章节页 `app/adventure/[chapterId].tsx`

**兑现状态卡**（仅 `viewStatus === "claimed"` 且 `rewardType === "real_pending"`）

| 状态 | 文案要点 |
| --- | --- |
| pending | 已领取 · 等待创建者兑现惊喜 |
| fulfilled | 已兑现 · 展示 `fulfilledAt`；有 `note` 则展示 |
| cancelled | 已取消兑现 · 章节仍完成、徽章保留；有 `note` 则展示 |

`badge_story` 已领：保持「已获得该徽章」，不显示兑现卡。

**领奖成功**

- 触发 `AdventureClaimCelebration`（见下节）。
- 成功文案可区分徽章 vs 现实惊喜（现有按钮文案已区分，庆祝标题对齐）。

### 世界地图（轻量）

- 进入地图时：若 `highestUnlockedOrder > lastSeenUnlockedOrder(spaceId)`，对「新解锁」相关岛播一次 scale pop / 光晕（可叠在既有 claimable 浮动上）。
- 播放后写入本地：`adventure:lastSeenUnlockedOrder:{spaceId}`。
- order 未升高则不播，避免每次进入刷屏。
- 减动效：跳过动画，可仅更新 lastSeen。

### 庆祝组件

| 场景 | 组件 | 触发 | 时长与行为 |
| --- | --- | --- | --- |
| 领奖成功 | `AdventureClaimCelebration` | claim API 成功当帧 | 约 1.0–1.5s；徽章/emoji 放大 + 轻粒子；可点击或自动关闭 |
| 地图新解锁 | 岛级一次性 pop | lastSeen 比较 | 短；不阻断滚动点击 |
| 减动效 | — | `useReducedMotion() === true` | 无循环/重动画；HelperText 或 Toast 足够 |

实现参考：`src/ui/CheckInCelebration.tsx` 的 Reanimated 模式；组件可放 `src/adventure/AdventureClaimCelebration.tsx`。

本地键：

```text
adventure:lastSeenUnlockedOrder:{spaceId}
```

换 space 隔离；无 space 时不写。

## 客户端选择器（建议纯函数，便于单测）

```ts
// 示意
function buildBadgeWallItems(state: AdventureState): BadgeWallItem[]
function selectPendingClaims(state: AdventureState): AdventureClaimSummary[]
function shouldPlayUnlockFeedback(highest: number, lastSeen: number | null): boolean
```

- `BadgeWallItem`：`kind: "claimed" | "unclaimed"` + 展示字段 + `chapterId` + 可选 fulfillment 角标。
- 排序：按 `sortOrder` 升序（启程在前），与地图叙事一致。

## 主要改动面

| 层 | 点 |
| --- | --- |
| 服务端 DTO/Service | `buildState` 附带 claims 列表与 `pendingFulfillmentCount`；chapter DTO 挂 `claim`；映射 badge 展示字段 |
| 服务端测试 | state 含 claims；领取 real_pending 后 pending 计数；fulfill 后计数下降 |
| 客户端类型 | `src/adventure/types.ts` |
| 客户端服务 | `adventureClient` / `adventureService` 透传新字段 |
| 页面 | 新 `app/adventure/badges.tsx`；改进度舱、章节页；地图 lastSeen 反馈 |
| UI | `AdventureClaimCelebration`；复用 `Badge` / `Card` / `RewardImage` / `EmptyState` |
| 客户端测试 | 徽章墙选择器；unlock feedback 判定；类型兼容 |

## 实现分期

1. **切片 1 — API 与类型**：state/claim 返回扩展 + 单测。
2. **切片 2 — 徽章墙与状态展示**：badges 页、进度舱入口、章节兑现卡。
3. **切片 3 — 庆祝与新解锁反馈**：领奖庆祝、地图 lastSeen、减动效、回归验证。

## 验收标准

1. 进度舱可进入徽章墙；已领徽章出现在网格，未领为剪影。
2. 领取 `real_pending` 后，用户侧立刻见「待兑现」；owner 确认兑现后同步为「已兑现」（含 note 若有）。
3. 取消兑现后状态为「已取消」；徽章仍在墙，章节仍 claimed。
4. 领奖成功有庆祝；`useReducedMotion` 为 true 时无重动画且流程可完成。
5. 地图：相对 lastSeen 的新解锁有一次轻反馈；order 未变再进不重复播。
6. 回归：门槛解锁、幂等领取、不回锁、admin CRUD/兑现、双人同步后状态一致。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| state 体积随 claims 增长 | 章节量小；只返回摘要字段 |
| 「可领」与「待兑现」文案混淆 | 分色角标 + 进度舱分卡 |
| 新解锁动画重复 | lastSeen order 本地缓存 |
| 旧客户端 | 字段只增不删 |
| note 含敏感内容 | 本期双方可读（情侣 space）；后续若需可加仅 owner 可见开关（非本期） |

## 设计决策摘要

- 范围：闭环补齐，不做运营 Phase3 与双人贡献/回忆。
- 数据：扩展 state，不新表；兑现写操作仍 admin。
- 徽章墙：chapters + claims 视图，2 列网格。
- 庆祝：领奖峰值 + 地图一次性新解锁反馈；尊重减动效。
- 同步：沿用 adventure 资源失效与 `useSyncScreen`。

## 修订记录

- 2026-07-13：头脑风暴确认方案 1 后初稿落盘。
