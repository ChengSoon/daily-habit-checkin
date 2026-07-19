# 前端 UI 重设计 · v2「共同小岛 · 糖果社交」设计系统 & 迁移 spec

> 状态：已获方向批准（2026-07-18）。视觉参照：`docs/design-prototypes/ui-showcase-board-v2.html`（10 屏展示板，Playwright 验证 0 报错）。
> 目标：把整套 RN 前端从「糖果社交 v1」升级为「共同小岛 · 养成陪伴 v2」，**只改前端表现层，不动业务逻辑 / 数据流 / 后端 / 同步 / 导航结构**。

---

## 1. 设计概念

**一句话**：你俩共同经营一片小岛。每天一起打卡 = 给岛注入生命，坚持越久岛越繁荣；闯关地图就是这片群岛的航线。

现状痛点：岛屿视觉目前只活在「闯关」一个 tab。v2 把**岛屿升格为贯穿全 App 的情感主线**，让「社交感」从"两个头像并排"进化成"你俩在共同经营一个看得见的地方"。

核心抓手 = 新增招牌组件 **共同岛屿卡（IslandHero）**，出现在今日 / 我的 / 闯关顶部。

---

## 2. 设计 tokens（`src/ui/theme.ts`）

**结论：配色系统基本复用，不推翻。** v2 board 的色板就是从 `theme.ts` 的 `romance` 主题导出的。

| Token 组 | 处理 |
|---|---|
| `primary`(Coral 你) / `partner`(Lavender TA) | **保留**——关系分色锚点 |
| `candySun/Sky/Orange` + `mint/success` | **保留**——数据与状态点缀 |
| `radius`（sm12/md16/lg22/xl28/pill）| 保留；屏级卡片统一走 `xl`，胶囊走 `pill` |
| `shadow`（card/soft/float）| 保留；确保各屏不再自造 elevation |
| `type`（display/title/section/body/small/caption）| 保留字阶；核对各屏统一走 `AppText` variant |

**可能的小增量**（实现时按需，不强求）：
- 若 IslandHero 需要，新增 1–2 个"天空渐变"辅助色槽（sky→lavender→coral wash），或直接用现有 candy soft 色叠。
- 校对暗色 palette 下岛图合成的对比度。

**非目标**：不新增主色、不改主题切换机制、不动 `themeOptions`。

---

## 3. 岛屿资产系统

- 现有 6 座岛 PNG 已在仓库并被 `src/adventure/mapAssets.ts` 引用：`assets/images/adventure/islands/{lighthouse,forest,market,camp,bridge,summit}.png`（768² 透明）。**App 内可直接 `Image` 引用，无需新增资产。**
- v2 board 用的是这批图的 360px 优化版（仅 board 内嵌用）；RN 端直接用原图 + `resizeMode="contain"`。
- 语义映射：主岛（默认「灯塔湾」）= 空间的共同小岛；6 岛同时是闯关章节与徽章。
- 降级：无岛数据 / 加载中时，IslandHero 回退到当前 `ProgressHeader` 的抽象柔光态（保底不崩）。

---

## 4. 组件层改动（工作重心，做好则多数屏自动继承）

### 4.1 新增 · `IslandHero`（共同岛屿卡）— 招牌
- **地基**：在现有 `ProgressHeader` 上演进（复用 `CoupleAvatars` + `ProgressRing` + candy 柔光容器）。
- **构成**：天空渐变卡 + 右侧真实岛图 + 岛上叠 `CoupleAvatars` + 角落 `ProgressRing`（今日完成率）+ 左列文案（岛名/Lv/「今天一起浇灌 N 次·繁荣 +X」）+ 连续/XP 胶囊。
- **变体**：`today`（全尺寸带进度环）/ `profile`（缩略）/ `adventure`（当前章节岛 + 章节进度条）。
- **Props（初稿）**：`islandKey`、`islandLevel`、`title`、`ratio`、`people`、`streakDays`、`xpBalance`、`caption`、`variant`。
- **降级**：`islandKey` 缺失 → 抽象柔光；单人 → `CoupleAvatars` 已有虚线占位逻辑。

### 4.2 微调现有共享组件
| 组件 | 改动 |
|---|---|
| `Controls.Card` | 校准 padding/圆角到 v2 节奏；补 tint 变体色（coral/lav/mint/sky/sun/orange soft）用于场景卡 |
| `Controls.StatTile` → Bento | 支持 2 列 bento 布局与彩色底（现有 `tint` prop 够用，补用法规范） |
| `HabitRow` | 左侧 `icon-chip`（Ionicons）+ 岛上"角落"标签 + 完成者小头像（现已有 `completedByName/Tone`）|
| `AppButton` | 对齐 v2：primary 渐变感（软阴影已有）、compact 尺寸；图标继续用 Ionicons |
| `ListRow` | 左 icon-chip + 标题/副标 + 右 chevron（现结构已接近）|
| tab bar（`app/(tabs)/_layout.tsx`）| 已是 Ionicons + 选中 chip；对齐 v2 配色/圆角即可 |
| `MonthCalendar` | 你/双人分色热力（现有分色逻辑，校对色）|

### 4.3 图标
- **RN 端统一用 Ionicons**（`@expo/vector-icons`），board 里的手写 SVG 仅为 HTML 模拟。
- 结构性图标一律 Ionicons；emoji 仅作稀疏情感点缀（🔥/💎/✨ 可留）。

---

## 5. 逐屏改造意图（对齐 board 10 屏 + 覆盖全部路由）

| 屏 / 路由 | v2 做法 |
|---|---|
| 今日 `(tabs)/index` | 顶部换 `IslandHero(today)`；待办列表 = 打卡即浇灌，完成项标注是谁 |
| 习惯 `(tabs)/habits` | Bento 双数据卡 + 习惯=岛上角落卡 + AI 规划入口 |
| 闯关 `(tabs)/adventure` | `IslandHero(adventure)` 当前岛 + 现有 `JourneyRail` 章节航线 + How-it-works |
| 商城 `(tabs)/shop` | XP 胶囊 + 2×2 bento 商品卡（兑换进度环）|
| 我的 `(tabs)/profile` | `IslandHero(profile)` 缩略 + 关系统计 bento + 设置 `ListRow` |
| 习惯详情 `habit/[id]` | 角落特写 + 月历(你/双人分色) + 里程碑卡 |
| 新建/编辑 `habit/new` | 复用重构后的表单控件（`TextField`/`WeekdayPicker`/`SegmentedControl`）|
| AI 计划 `plan-preview` | 分阶段编号卡（sky/lav/orange tint）+ 重新生成/导入 |
| 世界地图 `adventure/map` | 群岛航线 + 当前岛脉冲 + 锁定岛雾化 + 领取（board 08 已定版式）|
| 徽章墙 `adventure/badges` | 岛=徽章的 3 列网格 + 下一枚进度 |
| 章节详情 `adventure/[chapterId]` | 单岛 hero + 故事 + 领取（复用 `ChapterIslandHero`）|
| 账号同步 `account` | 账号卡 + 邀请/同步/权限 `ListRow` + 你俩已连接卡 |
| 兑换记录 `shop/redemptions` | 列表卡对齐组件层 |
| 管理页 `admin/*` | 主要继承组件层，做一致性收尾（owner 专用，优先级最低）|

---

## 6. 范围与分期

- **P0 · 设计基座 + 招牌**：`theme.ts` 校准（如需）、新增 `IslandHero`、微调 `Card/StatTile/HabitRow/AppButton/ListRow/tab bar`。← 收益最大，先做。
- **P1 · 五个 Tab 主屏**：今日 / 习惯 / 闯关 / 商城 / 我的。
- **P2 · 二级屏**：习惯详情 / 世界地图 / 徽章墙 / AI 计划 / 账号 / 兑换记录 / 新建习惯 / 章节详情。
- **P3 · 管理页**：rewards / redemptions / adventure / adventure-claims（继承为主）。

> **范围确认（2026-07-18）**：覆盖 **P0–P3 全部屏**（含 owner 管理页）；**亮色 + 暗色双主题逐屏打磨**（不只是自动适配）。

## 7. 非目标（明确不做）
- 不改任何业务逻辑、数据模型、仓储、同步、后端、XP 计算、权限。
- 不改导航 / 路由结构。
- 不新增重依赖——优先复用 `react-native-svg` + `Ionicons` + `Image`。
- 暗色主题：**本次在范围内**，逐屏打磨（见 §6/§8），非"仅自动适配"。

## 8. 验收与验证
- 每阶段：客户端 `tsc` 零错 + 现有 `vitest` 全绿（**纯表现层重构不应改动测试**；若某测试断言了旧文案/结构再单独议）。
- 关键屏：Expo 跑模拟器/真机或 `/run` 目视核对，对照 board v2 验收。
- 每个改造屏在 **亮色 + 暗色** 双主题下都过一遍（IslandHero 岛图在暗色卡上的对比 / 描边重点看）。
- 招牌组件 `IslandHero` 的三态（今日/我的/闯关）+ 降级态（无岛/单人）逐一过。

## 9. 风险
- `ProgressHeader` 现有"抽象柔光 + 贴纸星云"要让位给真实岛图：需处理岛图在 tint 卡上的合成、留白与暗色对比。
- 岛图在小尺寸卡内的裁切/对齐（board 阶段已踩过：过大导致拥挤，RN 端同样注意 `contain` + 尺寸）。
- IslandHero 数据来源跨 today（打卡状态）/ adventure（章节/XP）：Props 设计要能同时喂两处而不耦合业务。

## 10. 下一步
本 spec 获认可后 → 用 writing-plans 产出逐任务实现计划（按 P0→P3 分解），再进入 executing-plans / 子代理逐屏落地。
