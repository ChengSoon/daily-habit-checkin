# UI v2 深度打磨 · 设计契约与逐屏 checklist

> 日期:2026-07-19 · 分支:`feat/ui-redesign-v2`
> 源真相(source of truth):`docs/design-prototypes/ui-showcase-board-v2.html`
> 目标:让 App 前端(字体/颜色/布局/设计)忠实对齐 v2 原型看板。

## 背景

前 11 个 commit 已把 v2 招牌组件搭好(IslandHero / HabitRow / CheckButton / ProgressHeader),
字体 Outfit+Nunito 全局接入。代码已对齐约 85%。本次是**逐屏抠细节 + 补两处全局底座**,
不是重做。

## 工作方式(已与用户确认)

- 逐屏精修 **01 → 10**,忠于设计语言、**RN 惯用法优先**(滚动/原生控件等按 RN 习惯,不强行像素级)。
- 节奏:**用户本地跑、按反馈改**。每屏:对照原型 markup 列差异 → 改 → 用户 `npm run ios/web` 验收 → 反馈 → 修 → 下一屏。
- 本文件是逐屏 checklist 与进度台账,随打磨推进更新。

## 决策记录

1. 推进顺序:逐屏精修全 10 屏(非"先统一 tokens")。
2. 还原度:忠于设计语言,RN 惯用法优先。
3. 验收:用户本地跑,按反馈改。
4. **字距:恢复 v2 负字距**(反转旧版"不用负字距"的决定)。
5. **场景卡:给 `Card` 加可选渐变底**,贴原型 `.tint-*` 的 158° 双色渐变。
6. **-ink 深色文字全套**:新增 `candySunInk/candySkyInk/candyOrangeInk/candyMintInk`,浅底上的文字/图标统一用更深的 -ink(对齐原型 sun-ink/sky-ink/mint-ink/orange-ink),对比更利落。

## v2 设计 Token 契约(来自原型 `<style>`)

| 类别 | 值 |
|---|---|
| 底色 | `--bg #F3F4F8` / paper `#FFFFFF` |
| 墨色 | ink `#1F2430` / ink-soft `#5B6475` / muted `#8B93A7` / faint `#B4BAC9` |
| 线 | line `#E8EBF3` / line-strong `#D7DCE8` |
| 珊瑚 | `#FF7B8A` / ink `#E25C70` / soft `#FFE4E8` |
| 薰衣草 | `#9B8CFF` / ink `#6B5AD6` / soft `#ECE8FF` |
| 薄荷 | `#3FBE96` / ink `#1F9B78` / soft `#DDF8EF` |
| 天空 | `#6CB8FF` / ink `#3E86D1` / soft `#E3F1FF` |
| 暖阳 | `#FFC857` / ink `#B8860B` / soft `#FFF3D6` |
| 橙 | `#FF9B6A` / ink `#D67B40` / soft `#FFE7DB` |
| 阴影 | card `0 6px 16px rgba(40,48,72,.035)` · soft `0 10px 24px .06` · float `0 22px 46px .16` |
| 圆角 | screen 30(仅手机壳) · card 20 · sm 14 · pill 999 |
| 字体 | Outfit(标题/数字,800/700)+ Nunito(正文,500/700/800) |
| **字距** | 标题 `-0.02em` · 数字 `-0.03em` · 大标题 `-0.03em` · rowtitle `-0.01em` |

> 现状:`theme.ts` 的 romanceLight 已精确匹配以上色板;阴影/圆角已对齐。**唯字距被写死为 0**。

## 全局底座改动(随 01 落地,波及所有屏)

### A. 恢复负字距
- `theme.ts › type`:display `letterSpacing:-0.5`、title `-0.4`、其余按需;数字位另给 `-0.7`。
  (RN letterSpacing 为绝对 px,由 em×fontSize 换算。)
- 清理散落的 `letterSpacing: 0` 硬覆盖:`Controls.tsx`(StatTile 610 / AppButton 278)、
  `HabitRow.tsx:175`、`habits.tsx:118/126`、`plan-preview.tsx`。数字/标题恢复负字距,按钮文字可保持 0。
- ⚠️ 中文标题 -0.02em 仅紧 ~0.4px;若偏挤,回调该项即可。

### B. Card 渐变底
- 给 `Card` 加 `gradient?: [string, string]` 属性,用 `react-native-svg`(同 `AppButton` 做法)铺 158° 双色底。
- 预置 6 组场景渐变(coral/lav/mint/sky/sun/orange),对应原型 `.tint-*`。
- 纯色 `tintColor` 保留兼容;`gradient` 优先。

### C. -ink 深色文字全套
- `theme.ts` 新增 `candySunInk #B8860B / candySkyInk #3E86D1 / candyOrangeInk #D67B40 / candyMintInk #1F9B78`(dark 用可读浅色对)。
- 共享组件统一走 -ink,一处改多屏受益:`Badge` success、`HabitRow` 标签、`IslandHero` eyebrow、`MonthCalendar` done 日、`StatTile` 场景色、习惯页 `CHIP_PALETTE`。

## 逐屏 checklist

> 状态:☐ 待办 · ◐ 进行中 · ☑ 已过一遍(代码级对齐,待用户实机验收)。

### ☑ 01 · 今日首页 (Today) — `app/(tabs)/index.tsx`
现状已很接近。预期改动:
- [ ] 落地全局底座 A(负字距)+ B(渐变 Card)
- [ ] 对照原型复核:问候行、IslandHero(eyebrow 色/pills)、HabitRow 标签色与进度渐变、"今日待办"区头
- [ ] 空状态卡 / 小贴士卡改用渐变底

### ☑ 02 · 习惯管理 (Habits) — `app/(tabs)/habits.tsx`
- [ ] 对照原型 02 逐项列差异

### ☑ 03 · 闯关旅程 (Adventure) — `app/(tabs)/adventure.tsx`
- [ ] 对照原型 03 逐项列差异

### ☑ 04 · 奖励商城 (Shop) — `app/(tabs)/shop.tsx`
- [ ] 对照原型 04 逐项列差异

### ☑ 05 · 个人中心 (Profile) — `app/(tabs)/profile.tsx`
- [ ] 对照原型 05 逐项列差异

### ☑ 06 · 习惯详情 (Detail) — `app/habit/[id].tsx`
- [ ] 对照原型 06 逐项列差异

### ☑ 07 · AI 计划预览 (AI Plan) — `app/plan-preview.tsx`
- [ ] 对照原型 07 逐项列差异

### ☑ 08 · 世界地图 (Map) — `app/adventure/map.tsx`
- [ ] 对照原型 08 逐项列差异

### ☑ 09 · 徽章收藏 (Badges) — `app/adventure/badges.tsx`
- [ ] 对照原型 09 逐项列差异

### ☑ 10 · 账号同步 (Account) — `app/account.tsx`
- [ ] 对照原型 10 逐项列差异

## 验证

- 每屏改完由用户 `npm run ios`(或 `npm run web`)实机/浏览器验收。
- 关键纯逻辑(如 islandHeroLogic)已有单测;视觉改动以人眼验收为准。
- 不改业务逻辑/数据层,仅 UI 表现层。
