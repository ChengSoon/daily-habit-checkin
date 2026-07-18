# 前端 UI 重设计 v2「共同小岛」实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把整套 RN 前端从糖果社交 v1 升级为「共同小岛 · 养成陪伴 v2」，覆盖全部屏（P0–P3）、亮暗双主题。

**Architecture:** 工作重心在共享层——新增招牌组件 `IslandHero`（共同岛屿卡），微调 `Controls`/`HabitRow`/`MonthCalendar`/tab bar，之后各屏重组即自动继承。只改表现层，不动业务逻辑/数据/后端/同步/导航。

**Tech Stack:** React Native 0.86 · React 19.2.3 · Expo 57 · TypeScript 6.0.3 · react-native-svg 15.15.4 · @expo/vector-icons(Ionicons) · vitest 4。

**视觉基准:** `docs/design-prototypes/ui-showcase-board-v2.html`（10 屏，Playwright 验证 0 报错）。
**设计 spec:** `docs/design-prototypes/2026-07-18-candy-island-redesign-spec.md`。

## Global Constraints

- **只改表现层**：不改业务逻辑 / 数据模型 / 仓储 / 同步 / 后端 / XP / 权限 / 导航结构。
- **不新增重依赖**：只用现有 `react-native-svg` + `Ionicons` + `Image`（+ `expo-image` 若已用）。岛图经 `resolveDefaultIslandSource(key)`（`src/adventure/mapAssets.ts`）取，不加新资产。
- **图标**：结构性图标统一 Ionicons；emoji 仅稀疏情感点缀（🔥/💎/✨ 可留）。
- **每个任务的验收门槛（"测试"环节）**：① `npx tsc --noEmit` EXIT 0；② `npm test`（vitest）全绿——**纯表现层重构不得改动测试的行为断言**；若某测试断言了将被改的旧文案/结构，先在该任务里评估再动；③ 亮 + 暗双主题目视，对照 board 对应面板；④ 独立 commit。
- **视觉验证方式**：`npm run ios`（或 `android`/`web`）跑起，或用 `/run` skill；用设置页切主题验证暗色。
- **分支**：全部工作在 `feat/ui-redesign-v2`（Task 0 创建），每任务一个 commit，前缀 `feat(ui):` / `style(ui):`。
- **屏级任务约定**：本计划的屏级任务不预写最终 JSX（应对着**实时文件**写、比凭空编准确），而是给出「用哪些组件 + 对照哪个 board 面板 + 具体组装要点 + 验收标准」。P0 组件层给到代码级接口。

---

## 文件结构地图

**新增**
- `src/ui/IslandHero.tsx` — 招牌「共同岛屿卡」，含 `IslandHero` 组件 + `islandHeroImage()` 纯函数。
- `src/ui/IslandHero.test.ts` — `islandHeroImage()` 单测。

**P0 修改（共享层）**
- `src/ui/theme.ts` — 按需补 island sky wash 辅助色 + 校对暗色。
- `src/ui/Controls.tsx` — `Card` tint 变体、`AppButton` 打磨、`ListRow` icon-chip。
- `src/ui/HabitRow.tsx` — icon-chip + 岛上角落标签 + 完成者头像。
- `src/ui/MonthCalendar.tsx` — 你/双人分色热力校对。
- `app/(tabs)/_layout.tsx` — tab bar 配色/圆角对齐。
- `src/ui/ProgressHeader.tsx` — 今日头部改由 `IslandHero(today)` 承载（保留导出或在 index 直接换）。

**P1 修改（Tab 主屏）**：`app/(tabs)/{index,habits,adventure,shop,profile}.tsx`
**P2 修改（二级屏）**：`app/habit/{[id],new}.tsx`、`app/plan-preview.tsx`、`app/adventure/{map,badges,[chapterId]}.tsx`、`app/account.tsx`、`app/shop/redemptions.tsx`；相关 `src/adventure/{WorldMapCanvas,ChapterIslandHero,AdventureHomeSections,IslandMarker}.tsx`
**P3 修改（管理页）**：`app/admin/{rewards,redemptions,adventure,adventure-claims}.tsx`

---

## Task 0: 建分支

- [ ] **Step 1:** `git checkout -b feat/ui-redesign-v2`
- [ ] **Step 2:** 确认基线：`npx tsc --noEmit`（记录当前是否 0 错）+ `npm test`（记录当前通过数）。作为重构前的绿色基线。

---

## Task 1: theme.ts 前置校准（P0）

**Files:** Modify: `src/ui/theme.ts`

**Interfaces — Produces:** 若新增，导出 `islandSky` 类色槽（`{skyTop,skyMid,skyBottom}` 或复用 `candySkySurface/partnerSurface/surfaceTint`）。默认**优先复用现有色，不新增**；只有 IslandHero 实测需要才加。

- [ ] **Step 1:** 打开 board v2，取「共同岛屿卡」天空渐变值（`#E7F2FF → #EDE8FF → #FFE7EC`）。判断能否用现有 `candySkySurface`/`lavenderSurface`/`surfaceTint` 叠出；能则本任务**仅记录映射、不改 theme**，跳到 Step 3。
- [ ] **Step 2（仅在必要时）:** 在 `Palette` 类型与三套主题的 light/dark 各加 `islandSkyTop/Mid/Bottom`（暗色用低明度对应值，参考现有 dark palette 明度）。
- [ ] **Step 3:** `npx tsc --noEmit` → EXIT 0。
- [ ] **Step 4:** `npm test` → 全绿。
- [ ] **Step 5:** Commit `style(ui): island sky tokens 校准`（若无改动则并入 Task 2）。

---

## Task 2: IslandHero 招牌组件（P0 · 核心）

**Files:**
- Create: `src/ui/IslandHero.tsx`
- Test: `src/ui/IslandHero.test.ts`

**Interfaces — Produces（后续屏都消费）:**

```ts
import type { ReactNode } from "react";
import type { CouplePerson } from "./Avatar";

export type IslandHeroVariant = "today" | "profile" | "adventure";

/** 无 islandKey → 回退抽象柔光（返回 null）；有则返回 require 的图片 number。 */
export function islandHeroImage(islandKey?: string | null): number | null;

export function IslandHero(props: {
  variant: IslandHeroVariant;
  islandKey?: string | null;   // 经 resolveDefaultIslandSource 映射
  islandName?: string;         // "灯塔湾"
  islandLevel?: number;        // 4 → "Lv.4"
  title?: string;              // 覆盖主标题
  caption?: string;            // "今天一起浇灌 3 次 · 繁荣 +12" / "双人旅程 · Chapter 04"
  ratio?: number;              // 0..1，today 变体的进度环
  people?: CouplePerson[];     // 岛上双人头像
  streakDays?: number;         // 🔥 胶囊
  xpBalance?: number;          // 💎 胶囊
  xpAccessory?: ReactNode;
  onPressXp?: () => void;
  progressBar?: { ratio: number; label?: string }; // adventure 变体章节进度
}): JSX.Element;
```

**Consumes:** `resolveDefaultIslandSource`（mapAssets）、`CoupleAvatars`(Avatar)、`ProgressRing`、`Card`/`AppText`(Controls)、`radius/shadow/spacing`(theme)、`useTheme`。复用 `ProgressHeader` 现有柔光容器与贴纸（StickerStar/Cloud）作 fallback。

- [ ] **Step 1: 写失败测试** `src/ui/IslandHero.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { islandHeroImage } from "./IslandHero";
import { DEFAULT_ISLAND_IMAGES } from "../adventure/mapAssets";

describe("islandHeroImage", () => {
  it("无 key 回退抽象柔光（null）", () => {
    expect(islandHeroImage(null)).toBeNull();
    expect(islandHeroImage(undefined)).toBeNull();
    expect(islandHeroImage("")).toBeNull();
  });
  it("有 key 返回对应岛图", () => {
    expect(islandHeroImage("lighthouse")).toBe(DEFAULT_ISLAND_IMAGES.lighthouse);
    expect(islandHeroImage("camp")).toBe(DEFAULT_ISLAND_IMAGES.camp);
  });
  it("未知 key 走 mapAssets 的 fallback 岛（非 null）", () => {
    expect(islandHeroImage("nope")).not.toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败** `npm test -- IslandHero` → FAIL（模块不存在）。
- [ ] **Step 3: 写 `islandHeroImage` 纯函数**

```ts
import { resolveDefaultIslandSource } from "../adventure/mapAssets";
export function islandHeroImage(islandKey?: string | null): number | null {
  if (!islandKey) return null;
  return resolveDefaultIslandSource(islandKey);
}
```

- [ ] **Step 4: 跑测试确认通过** `npm test -- IslandHero` → PASS。
- [ ] **Step 5: 实现 `IslandHero` 组件**（对照 board 面板 01/05/03）：天空渐变卡（`overflow:hidden` + 柔光 sun orb）→ 右侧 `Image`(岛图, `resizeMode="contain"`) → 左列文案（caption/islandName+Lv/title/caption 明细）→ `streakDays`/`xpBalance` 胶囊 → 岛基叠 `CoupleAvatars` → `variant==="today"` 角落 `ProgressRing(ratio)`；`variant==="adventure"` 显 `progressBar`；`islandHeroImage()===null` 时回退 `ProgressHeader` 式抽象柔光。暗色用 `useTheme().scheme` 切换渐变与描边（岛图加轻微 `rgba` 底衬保证暗色对比）。
- [ ] **Step 6:** `npx tsc --noEmit` → 0；`npm test` → 全绿。
- [ ] **Step 7: Commit** `feat(ui): 新增 IslandHero 共同岛屿卡组件`

---

## Task 3: Controls 微调（P0）

**Files:** Modify: `src/ui/Controls.tsx`

**Interfaces — Produces:** `Card` 支持 `tintColor?: string`（直接给场景色底，替代只有 surface/tint/muted 三档）；`ListRow` 支持可选 `icon?: IoniconName` + `iconTint?: string`（渲染左侧 icon-chip）；`AppButton` 视觉对齐 board（primary 软阴影已具，校准 compact 尺寸）。保持所有现有 props 向后兼容。

- [ ] **Step 1:** `Card` 加 `tintColor?: string`（存在则作 background，边框用同色系浅线）；不破坏 `tone` 旧用法。
- [ ] **Step 2:** `ListRow` 加 `icon?`/`iconTint?`，渲染 36–38px 圆角 icon-chip（Ionicons）在最左，右侧 chevron 逻辑不变。
- [ ] **Step 3:** `AppButton` 对照 board 校准圆角/内距/图标间距（不改 variant 语义）。
- [ ] **Step 4:** `npx tsc --noEmit` → 0；`npm test` → 全绿。
- [ ] **Step 5: Commit** `style(ui): Card tint 变体 + ListRow icon-chip`

---

## Task 4: HabitRow 重做（P0）

**Files:** Modify: `src/ui/HabitRow.tsx`

**Consumes:** Ionicons、`Card`/`AppText`、`Avatar`（完成者小头像，现已有 `completedByName/completedByTone`）。

- [ ] **Step 1:** 对照 board 面板 01/02 的习惯行：左 icon-chip（按习惯类型/图标映射 Ionicons）+ 标题/副标 + 右侧 XP/状态 tag；完成态显 `check.on`（Ionicons checkmark）+ 完成者小头像；数值型习惯显 mini 进度条。保留现有 `completedByName/Tone` 与撤销逻辑（CheckButton）。
- [ ] **Step 2:** `npx tsc --noEmit` → 0；`npm test` → 全绿（HabitRow/CheckButton 相关测试不变）。
- [ ] **Step 3: Commit** `style(ui): HabitRow 岛屿角落卡样式`

---

## Task 5: tab bar + MonthCalendar 对齐（P0）

**Files:** Modify: `app/(tabs)/_layout.tsx`、`src/ui/MonthCalendar.tsx`

- [ ] **Step 1:** tab bar：对照 board，校准选中 chip 底色（`surfaceTint`/coral-soft）、圆角、active/inactive 色。图标已是 Ionicons，结构不动。
- [ ] **Step 2:** MonthCalendar：你=mint、双人=coral↔lavender 渐变、today 描边——对照 board 面板 06 校色。
- [ ] **Step 3:** `npx tsc --noEmit` → 0；`npm test` → 全绿。
- [ ] **Step 4: Commit** `style(ui): tab bar 与月历配色对齐 v2`

---

## Task 6: 今日 index.tsx（P1）

**Files:** Modify: `app/(tabs)/index.tsx`（并在此处把 `ProgressHeader` 换成 `IslandHero(today)`）
**Consumes:** `IslandHero`、`HabitRow`、`useCouple`。
**对照:** board 面板 01。
**组装要点:** 顶部 `IslandHero variant="today"` 喂 `people`(useCouple)、`ratio`(今日完成率)、`streakDays`、`xpBalance`、`islandKey`(空间主岛，取当前/首个解锁章节 themeKey，无则 null 走柔光)、caption「今天一起浇灌 N 次」；下方今日待办用重构后的 `HabitRow`（完成项标注是谁）。保留所有数据加载 / `useSyncScreen` / 打卡逻辑。

- [ ] **Step 1:** 重组今日页匹配 board 01（IslandHero + 待办）。
- [ ] **Step 2:** `npx tsc --noEmit` → 0；`npm test` → 全绿。
- [ ] **Step 3: 目视** 跑 app → 今日页对照 board 01；切暗色核对 IslandHero 岛图对比。
- [ ] **Step 4: Commit** `feat(ui): 今日页接入 IslandHero`

---

## Task 7: 习惯 habits.tsx（P1）
**Files:** Modify: `app/(tabs)/habits.tsx` · **对照:** board 02
**组装要点:** 标题 + ＋新增；2 列 bento 数据（进行中 / 本周完成率，用 `StatTile` 彩底）；习惯列表用重构 `HabitRow`（岛上角落标签）；AI 规划入口卡（tint-lav + sparkles）。保留数据与跳转。
- [ ] **Step 1:** 重组匹配 board 02。
- [ ] **Step 2:** `npx tsc --noEmit` → 0；`npm test` → 全绿。
- [ ] **Step 3:** 目视（亮/暗）对照 board 02。
- [ ] **Step 4: Commit** `feat(ui): 习惯页 v2`

## Task 8: 闯关 adventure.tsx（P1）
**Files:** Modify: `app/(tabs)/adventure.tsx`（+ 复用 `src/adventure/AdventureHomeSections.tsx` 的 `JourneyRail`/`HowItWorksCard`）· **对照:** board 03
**组装要点:** 顶部 `IslandHero variant="adventure"`（当前章节岛 + 章节进度条 + 累计 XP/已点亮 N/8）；下接现有 `JourneyRail`（横向章节岛卡，样式对齐 board rail）；`HowItWorksCard`。保留 adventure 数据。
- [ ] **Step 1:** 重组匹配 board 03。
- [ ] **Step 2:** `npx tsc --noEmit` → 0；`npm test` → 全绿。
- [ ] **Step 3:** 目视（亮/暗）对照 board 03。
- [ ] **Step 4: Commit** `feat(ui): 闯关页 v2`

## Task 9: 商城 shop.tsx（P1）
**Files:** Modify: `app/(tabs)/shop.tsx` · **对照:** board 04
**组装要点:** 标题 + XP 胶囊；2×2 bento 商品卡（缩略图/名称/类型/XP tag/可兑 or 兑换进度条）；兑换记录按钮。保留 `RewardImage`/兑换逻辑与 owner 相关入口。
- [ ] **Step 1:** 重组匹配 board 04。
- [ ] **Step 2:** `npx tsc --noEmit` → 0；`npm test` → 全绿。
- [ ] **Step 3:** 目视（亮/暗）对照 board 04。
- [ ] **Step 4: Commit** `feat(ui): 商城页 v2`

## Task 10: 我的 profile.tsx（P1）
**Files:** Modify: `app/(tabs)/profile.tsx` · **对照:** board 05
**组装要点:** 顶部 `IslandHero variant="profile"`（缩略岛 + 空间名 + 双人头像 + XP/累计胶囊）；2 列 bento（连续打卡 / 徽章）；设置 `ListRow`（账号与同步 / 主题外观[带色卡] / 提醒 / 导出）。保留 owner 判定、账号入口、主题切换、各 `.catch` 降级。
- [ ] **Step 1:** 重组匹配 board 05。
- [ ] **Step 2:** `npx tsc --noEmit` → 0；`npm test` → 全绿。
- [ ] **Step 3:** 目视（亮/暗）对照 board 05。
- [ ] **Step 4: Commit** `feat(ui): 我的页 v2`

---

## Task 11: 习惯详情 habit/[id].tsx（P2）
**对照:** board 06 · **组装:** 角落特写头 + 2 列 bento(当前连续/本月完成) + `MonthCalendar`(你/双人分色) + 里程碑 tint-mint 卡。保留 `useSyncScreen`、习惯不存在 → EmptyState。
- [ ] Step 1 重组 → Step 2 `tsc`+`npm test` → Step 3 目视(亮/暗) board 06 → Step 4 Commit `feat(ui): 习惯详情 v2`

## Task 12: 新建/编辑习惯 habit/new.tsx（P2）
**组装:** 复用重构后表单控件（`TextField`/`WeekdayPicker`/`SegmentedControl`/`AppButton`），卡片化分组，配色对齐 v2。保留全部表单/校验/保存逻辑。
- [ ] Step 1 重组 → Step 2 `tsc`+`npm test` → Step 3 目视(亮/暗) → Step 4 Commit `feat(ui): 新建习惯表单 v2`

## Task 13: AI 计划 plan-preview.tsx（P2）
**对照:** board 07 · **组装:** AI Generated caption + 标题 + 分阶段编号卡(tint sky/lav/orange，强度/XP tag) + 重新生成/导入按钮。保留计划数据(路由参数)与 savePlan try/catch。
- [ ] Step 1 重组 → Step 2 `tsc`+`npm test` → Step 3 目视(亮/暗) board 07 → Step 4 Commit `feat(ui): AI 计划预览 v2`

## Task 14: 世界地图 adventure/map.tsx（P2）
**对照:** board 08 · **Files:** `app/adventure/map.tsx` + `src/adventure/WorldMapCanvas.tsx`/`IslandMarker.tsx`
**组装:** 群岛航线画布（岛图 + 虚线航线 + 当前岛脉冲圈 + 「你们在这」pin + 锁定岛雾化）+ 当前章节卡 + 领取按钮。board 08 已定版式（岛尺寸/间距/pin nowrap 经验照搬）。保留解锁/领取逻辑。
- [ ] Step 1 重组 → Step 2 `tsc`+`npm test` → Step 3 目视(亮/暗) board 08 → Step 4 Commit `feat(ui): 世界地图 v2`

## Task 15: 徽章墙 adventure/badges.tsx（P2）
**对照:** board 09 · **组装:** 岛=徽章 3 列网格（已点亮彩色/锁定雾化）+ 下一枚进度卡。复用 `AdventureHomeSections` 的 `BadgeVisual`。
- [ ] Step 1 重组 → Step 2 `tsc`+`npm test` → Step 3 目视(亮/暗) board 09 → Step 4 Commit `feat(ui): 徽章墙 v2`

## Task 16: 章节详情 adventure/[chapterId].tsx（P2）
**Files:** + `src/adventure/ChapterIslandHero.tsx` · **组装:** 单岛 hero + 故事文 + 徽章 + 领取/兑现态。对齐 v2 卡片/按钮。保留领取逻辑。
- [ ] Step 1 重组 → Step 2 `tsc`+`npm test` → Step 3 目视(亮/暗) → Step 4 Commit `feat(ui): 章节详情 v2`

## Task 17: 账号 account.tsx（P2）
**对照:** board 10 · **组装:** 账号卡(头像+space+role+在线 tag) + 邀请/实时同步/权限 `ListRow` + 你俩已连接 tint-lav 卡 + 邀请按钮。保留登录/注册/加入/改密/退出空间/删账号全部逻辑与 `AvatarPicker`。
- [ ] Step 1 重组 → Step 2 `tsc`+`npm test` → Step 3 目视(亮/暗) board 10 → Step 4 Commit `feat(ui): 账号同步页 v2`

## Task 18: 兑换记录 shop/redemptions.tsx（P2）
**组装:** 列表卡对齐组件层（`Card`/`ListRow`/`Badge` 状态）。保留 `useSyncScreen` 与 owner 兑现/取消逻辑。
- [ ] Step 1 重组 → Step 2 `tsc`+`npm test` → Step 3 目视(亮/暗) → Step 4 Commit `feat(ui): 兑换记录 v2`

---

## Task 19: 管理页 admin/rewards.tsx + redemptions.tsx（P3）
**组装:** 继承组件层为主，卡片/按钮/表单/图片选择器对齐 v2；`OwnerGate` 无权态样式一并对齐。保留全部 owner 管理逻辑。
- [ ] Step 1 重组两页 → Step 2 `tsc`+`npm test` → Step 3 目视(亮/暗，owner 账号) → Step 4 Commit `feat(ui): 奖励管理页 v2`

## Task 20: 管理页 admin/adventure.tsx + adventure-claims.tsx（P3）
**组装:** 同上，章节编辑/领取管理对齐 v2 组件。保留逻辑。
- [ ] Step 1 重组两页 → Step 2 `tsc`+`npm test` → Step 3 目视(亮/暗，owner) → Step 4 Commit `feat(ui): 冒险管理页 v2`

---

## Task 21: 全局暗色回归 + 终验收（P3 收尾）
**Files:** 按需微调任意屏。
- [ ] **Step 1:** 亮色逐屏对照 board v2 面板走查，记录偏差清单。
- [ ] **Step 2:** 暗色逐屏走查（重点 IslandHero 岛图合成、tint 卡对比、文字可读性 ≥4.5:1），记录偏差。
- [ ] **Step 3:** 修偏差（小改直接改，成组的按屏 commit）。
- [ ] **Step 4:** `npx tsc --noEmit` → 0；`npm test` → 全绿；`npm run lint` → 0 错。
- [ ] **Step 5: Commit** `style(ui): 双主题回归收尾`
- [ ] **Step 6:** 用 superpowers:finishing-a-development-branch 决定合并/PR。

---

## Self-Review（写完自检）

- **Spec 覆盖**：spec §4 组件 → Task 2–5；§5 逐屏 → Task 6–20；§6 分期 P0(1–5)/P1(6–10)/P2(11–18)/P3(19–21)；§8 亮暗验证 → 每屏 Step + Task 21；均有对应任务 ✅。
- **占位符**：屏级任务按「计划约定」给组装规格而非空话，均含对照面板 + 组件 + 验收门；P0 组件层给到接口/测试代码 ✅。
- **类型一致**：`IslandHero`/`islandHeroImage` 签名在 Task 2 定义，Task 6/8/10 按此消费；`Card.tintColor`、`ListRow.icon` 在 Task 3 定义后各屏消费——一致 ✅。
