# 程序化世界地图设计

## 状态

- 日期：2026-07-12
- 状态：已实现（程序化布局已落地，待实机目视）
- 范围：世界地图 UI 布局与渲染；不改解锁 / 领奖业务规则
- 前置：`2026-07-12-adventure-chapter-unlock-design.md` 已落地线性章节 + 种子 6 章 + 管理端 CRUD
- 目标用户：情侣双人 space；管理端会持续加章
- 路线：程序化路径地图（章节驱动高度与节点，自动延伸）

## 背景

当前世界地图已可展示：

- 固定底图 `assets/images/adventure/world-map.png`
- 客户端硬编码 `CHAPTER_MAP_POINTS` / `THEME_MAP_POINTS`（约 6 个锚点）
- 固定画布 `MAP_CANVAS.height = 645`
- 路径用二次贝塞尔连接节点，解锁进度有实线高亮

问题：

1. **死地图**：节点位置与单张插画空地绑定，视觉上只能服务固定章节数。
2. **手调成本高**：加章要改坐标表或依赖粗糙的 `fallbackPoint`，管理端 CRUD 加章后不会自然铺开。
3. **不能自动延伸**：画布高度与底图比例写死，第 7 章起会挤在顶部或落到「未设计」区域。
4. **感觉简单**：单层静态图 + 圆点，缺少「旅程在生长」的反馈。

业务侧（线性 `sortOrder` + `lifetimeEarned` 门槛 + 手动领奖）已经适合程序化布局，不必为 UI 再引入手摆坐标 CMS。

## 一句话目标

把世界地图从「钉在一张死底图上的 6 个点」升级为「由章节列表驱动的可无限延伸旅程路径」：管理端新增章节后，画布高度、节点位置、路径与背景自动扩展，零坐标手调。

## 目标

1. 章节数从 1 增到 N（至少验证到 12+）时，地图自动变高、节点自动排布，无需改客户端坐标表。
2. 节点不重叠、不贴边；全路径始终连通；已解锁段与未解锁段视觉可区分。
3. 去掉对单张定长插画锚点的强依赖；`mapThemeKey` 只影响节点装饰/色带，不决定坐标。
4. 解锁 / 领奖 / 进度舱业务零回归。
5. 布局算法纯函数、可单测；视觉参数集中在常量，便于微调。
6. 结构预留后续 Region（分区）扩展，但本期不做分区 CMS。

## 非目标

- 不改 `lifetimeEarned` 解锁算法、领奖幂等、回锁策略。
- 不做管理端拖拽坐标、地图编辑器。
- 不做真·大世界瓦片 / 3D / 每章一张 AI 底图。
- 不做章内多关卡分支路径（仍为单线旅程）。
- 本期不做完整 Region 叙事分区（仅在数据/API 上保持兼容，见「演进」）。
- 不强制替换现有 `world-map.png` 资产文件（可保留作装饰参考或删除依赖）。

## 方案选型

| 方案 | 摘要 | 结论 |
| --- | --- | --- |
| A 程序化路径 | 按 index 算点 + 画布随 N 增高 | **本期采用** |
| B Region 拼接 | 每区 4–6 章，满则新开区域 | 二期演进 |
| C 数据坐标 + 拖拽 | DB 存 map_x/map_y，人工摆点 | 否决（与自动延伸冲突） |

## 核心设计

### 原则

1. **业务数据不存默认坐标**。`adventure_chapters` 继续只存叙事 / 门槛 / 主题键 / 图片。
2. **布局 = 纯函数**。输入有序章节列表（+ 可选 seed），输出画布尺寸与每个节点的画布坐标。
3. **画布高度随章节数线性增长**，宽度仍适配屏宽。
4. **背景可延伸**：渐变 / 色带 / 轻量平铺装饰，而不是定长位图 cover。
5. **可选 override 后置**：若将来极少数故事点要钉坐标，再加可空 `map_x/map_y`；本期不做。

### 布局引擎 API

模块：`src/adventure/mapLayout.ts`（重写，替换查表逻辑）

```ts
type LayoutInput = {
  chapterCount: number;
  /** 逻辑宽度 dp，默认 360 */
  width?: number;
  /** 可选：同一 space 路径轻微差异，默认 0 */
  seed?: number;
};

type LayoutNode = {
  index: number;       // 0-based，按 sortOrder 排序后的位置
  sortOrder: number;   // 由调用方填入
  x: number;           // 归一化 0~1
  y: number;           // 归一化 0~1（自上而下；渲染时 cy = y * height）
  cx: number;          // 像素
  cy: number;
};

type MapLayout = {
  width: number;
  height: number;
  nodeRadius: number;
  pathWidth: number;
  points: LayoutNode[]; // 仅几何；章节业务字段由调用方 zip
};

function buildMapLayout(input: LayoutInput): Omit<MapLayout, 'points'> & {
  points: Array<Pick<LayoutNode, 'index' | 'x' | 'y' | 'cx' | 'cy'>>;
};

function layoutChapters<T extends { sortOrder: number }>(
  chapters: T[],
  options?: { width?: number; seed?: number }
): { layout: MapLayout; items: Array<T & { cx: number; cy: number; index: number }> };
```

调用方（`WorldMapCanvas`）只传已排序的 `chapters`，不再调用 `resolveMapPoint({ mapThemeKey })` 查表。

### 几何算法

**坐标系**：逻辑宽 `W = 360`；高 `H` 由章节数决定；归一化 `x,y ∈ [0,1]`，`y=0` 在顶部（与现 RN 一致）。

**旅程方向**：自下而上（第 1 章靠近底部，最后一章靠近顶部），与现种子叙事「启程 → 山顶」一致。

**高度**：

```
SEGMENT_H = 108          // 相邻章节纵向间距（逻辑 px）
PAD_TOP   = 72
PAD_BOTTOM = 88
H = PAD_TOP + PAD_BOTTOM + max(chapterCount - 1, 0) * SEGMENT_H
// chapterCount === 0 → 最小高度（空态）
// chapterCount === 1 → PAD_TOP + PAD_BOTTOM
```

**节点坐标（像素公式为唯一真源；归一化由像素反推）**：

```
// i = 0 .. N-1，i=0 为 sortOrder 最小（第 1 章，靠下）
const baseX = 0.50
const amp   = 0.22
const side  = (i % 2 === 0) ? -1 : 1
const wobble = seed ? 0.03 * Math.sin(seed * 12.9898 + i * 78.233) : 0
const x = clamp(baseX + side * amp + wobble, 0.18, 0.82)

const cy = H - PAD_BOTTOM - i * SEGMENT_H   // 自下而上，i 增大 cy 减小
const cx = x * W
const y  = cy / H                            // 仅供调试/序列化，渲染用 cx/cy
```

**约束（测试断言）**：

- 任意两点欧氏距离 ≥ `2.4 * nodeRadius`（防重叠，含 caption 余量可放宽到 2.2）
- `x ∈ [0.18, 0.82]`
- `cy` 单调：`cy(i) > cy(i+1)`（自下而上减小）
- `N=6` 与 `N=12` 均满足；`N=1` 节点居中偏下

**路径**：

- 复用并强化现有 `buildPathD`（二次贝塞尔）。
- 全路径：全部节点；未解锁段半透明虚线。
- 已解锁路径：`sortOrder <= highestUnlockedOrder` 的子序列，实线 + 渐变高亮。
- tension 保持可配置常量 `PATH_TENSION = 0.35`。

### 渲染结构（`WorldMapCanvas`）

```
View (frame)
  └─ View (canvasW × canvasH)   // height 来自 layout，不再固定 645
       ├─ BackgroundLayer       // 可延伸背景
       ├─ Svg
       │    ├─ fullPath (淡底 + 虚线)
       │    ├─ unlockedPath (发光实线)
       │    └─ focus ring
       └─ Nodes (Pressable 绝对定位)
```

**BackgroundLayer（本期）**：

1. 纵向线性渐变：底部暖色（启程）→ 顶部冷/高光（山顶），用 `Svg` `LinearGradient` 或两层 `View` 渐变近似。
2. 可选：2–3 条极淡的「等高线 / 色带」水平分隔，按 `SEGMENT_H * k` 绘制，增加深度感，不绑定具体插画。
3. **不再** `Image contentFit="cover"` 钉死 `world-map.png`。
4. 资产处理：保留 `world-map.png` 于仓库暂不删；代码去掉 require 依赖。若后续做 Region，可把旧图裁成「海岸区装饰条」。

**节点**：

- 状态色沿用现逻辑：`claimed` / `claimable` / `locked`。
- 图标优先级：`nodeImageKey` → `badgeImageKey` → `badgeEmoji` → 序号。
- `mapThemeKey`：可选映射到节点外环色或微标签（如 lighthouse/forest 色板），**不参与坐标**。
- caption：标题 + 状态/门槛，与现一致；注意 caption 宽度，避免相邻左右节点文字互盖（左右交替已缓解）。

**交互**：

- 点击节点 → 章节详情（不变）。
- 外层 `Screen scroll` 可滚动完整画布；`N` 大时自然变长。
- 可选（本期可做若成本低）：挂载后 `scrollTo` 聚焦 `claimable` 或当前最高解锁节点；不做则保持手动滑。

### 与业务数据的边界

| 关注点 | 归属 |
| --- | --- |
| 解锁条件、领奖、阈值 | 服务端 + `adventureService`（不变） |
| `sortOrder`、title、theme、图片 | DB / 管理端（不变） |
| 节点 x/y、画布高、路径 d | **仅客户端** `mapLayout` |
| 主题装饰色 | 客户端 theme 表，可选 |

服务端 API **无需**为本期新增字段。管理端加章后，客户端下次 `loadAdventureState` 即自动多一段路径。

### 空态与边界

| 情况 | 行为 |
| --- | --- |
| 0 章 | 矮画布 + 文案「暂无章节」（map 页 Card 已有进度文案即可） |
| 1 章 | 单节点靠下居中，无路径或仅点 |
| 章节极多（20+） | 高度线性增长，滚动浏览；不虚拟化（本期） |
| 草稿/下架章 | 地图只渲染 `published` 列表（与现 state API 一致） |

## 文件改动范围（实现时）

| 路径 | 动作 |
| --- | --- |
| `src/adventure/mapLayout.ts` | 重写：生成布局；删除 `CHAPTER_MAP_POINTS` / `THEME_MAP_POINTS` 坐标表 |
| `src/adventure/mapLayout.test.ts` | 重写：高度公式、单调性、边界 clamp、N=6/12 不重叠、`buildPathD` |
| `src/adventure/WorldMapCanvas.tsx` | 接新 layout；可延伸背景；去掉固定底图 |
| `app/adventure/map.tsx` | 若需，微调滚动/文案；业务数据流不变 |
| `assets/images/adventure/world-map.png` | 停止引用；文件可暂留 |
| DB / server / admin | **不改**（除非二期 override） |

## 视觉完成度（相对「太简单」）

本期必做：

1. 随进度变亮的路径（已有基础，保留并适配新坐标）。
2. 可延伸的氛围渐变背景（替换死底图）。
3. 当前焦点节点光圈。
4. 节点状态层次清晰（可领 > 已领 > 锁定）。

本期可选（时间允许）：

- 轻微上下浮动（仅 claimable，Reanimated 若项目已有则用，否则静态）。
- 按 `mapThemeKey` 的 6 色微差外环。

明确不做：粒子特效、全屏视差、每章独立大插画。

## 测试与验收

### 单测（`mapLayout`）

1. `N=0` 高度为最小空态高度。
2. `N=1` 单点 `x∈[0.18,0.82]`，`cy` 在下半区。
3. `N=6` 与 `N=12`：`cy` 严格递减；相邻距离足够；所有 `x` 在安全区。
4. `H(N)` 随 N 线性增加：`H(n+1) - H(n) === SEGMENT_H`（n≥1）。
5. `buildPathD` 多点含 `M` 与 `Q`。
6. 相同输入布局结果稳定（纯函数）。

### 手工 / 冒烟

1. 现有 6 种子章：路径连贯，可点进详情，领取状态正确。
2. 管理端新增第 7 章（published）：地图自动变高并出现新节点，无需改代码坐标。
3. 锁定 / 可领 / 已领三态颜色正确。
4. 小屏与大屏宽度缩放正常，节点可点。

### 回归

- Tab 闯关进度舱、领奖页、XP 入账后 advance：**不改协议与规则**。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 去掉插画后「游戏感」下降 | 渐变 + 路径高亮 + 节点图/emoji；后续 Region 再加分区插画条 |
| 左右交替导致 caption 重叠 | 限制 caption 宽、交替侧、字号；测试 N=12 |
| 旧用户习惯「钉在图上的点」位置变化 | 接受一次性视觉迁移；业务进度不变 |
| 超长列表性能 | 20 章内绝对定位足够；超长再议虚拟化 |

## 演进（非本期）

1. **Region 分段**：每 K 章一个区域头（标题 + 色板切换）；区内仍用同一布局函数，仅 `PAD` / 色带不同。
2. **坐标 override**：可空 `map_x/map_y`，有值则跳过算法点。
3. **space seed**：用 `spaceId` hash 作 `seed`，不同情侣路径微差（纯表现）。
4. **自动滚到当前章**：map 页 `ScrollView` ref + 初次 focus。

## 成功标准

1. 管理端只加章节数据，客户端地图自动延伸 —— **无需**改 `mapLayout` 坐标表。
2. 删除 `CHAPTER_MAP_POINTS` / `THEME_MAP_POINTS` 硬编码表。
3. 单测覆盖布局不变量；6 章与 12 章目视可滚动完整旅程。
4. 解锁/领奖行为与改前一致。

## 实现顺序建议

1. TDD 重写 `mapLayout` + 测试。
2. 改 `WorldMapCanvas` 接新 layout + 渐变背景。
3. map 页冒烟与管理端加章验证。
4. 清理无用底图引用与过时注释。

## 开放问题（若审阅时需拍板）

1. 是否保留极淡「仿插画」纹理叠加，还是纯扁平渐变？（默认：纯渐变 + 轻色带）
2. 新增章后是否自动滚动到最新/可领节点？（默认：本期不做，下期可选）
3. `mapThemeKey` 是否立刻做色板映射？（默认：有则微差外环，无则主题色）

## 附录：现状对照

| 项 | 现状 | 目标 |
| --- | --- | --- |
| 坐标来源 | 主题键 / sortOrder 查表 | index 算法 |
| 画布高 | 固定 645 | `f(N)` |
| 底图 | 定长 PNG cover | 可延伸渐变层 |
| 加第 7 章 | fallback 锯齿或手调 | 自动多一段 |
| 服务端 | 无坐标字段 | 仍无（本期） |

## 地图资产管线（真·闯关地图感）

程序化布局解决的是「节点自动延伸」；**地图感**来自可导入的竖向插画底图。两者叠加：

```
竖向地图插画（可拼段）  +  算法节点/路径  =  可加章的闯关地图
```

### 推荐做法（由易到难）

| 等级 | 做法 | 适合 |
| --- | --- | --- |
| L1 单张竖图 | 一张竖向长图（约 1024×2560），代码按高度 cover / 自下而上拼段 | 6–12 章，最快有「真地图」 |
| L2 分区条带 | 海岸 / 森林 / 高山各一条可拼接 strip，按章节段切换 | 章节很多、要世界观分区 |
| L3 多图层 | 远景平铺 + 中景装饰 + 路径/节点 UI 层 | 最像手游，成本最高 |

### 设计规范（给画师 / AI 出图）

1. **竖构图**：宽:高 ≈ 2:5 或更高；内容自下而上叙事（海滩 → 林 → 山）。
2. **中轴走廊**：画面左右 18%–82% 之间少放大建筑，留给程序化路径与节点。
3. **关卡空地**：每隔一段留圆形/平台状空地（可选），即使不完全对齐算法点也有氛围。
4. **可拼段**：若要无限加章，顶/底边缘色调接近，便于垂直拼接；或做成独立 Region 条带。
5. **导出**：PNG/WebP，宽 1024–1536；放进 `assets/images/adventure/`。
6. **代码接入**：改 `WorldMapCanvas` 里的 `WORLD_MAP_ART` require 路径与 `MAP_ART_ASPECT`；**不必**改坐标表。

### 出图工具

- **Stitch / Midjourney / 即梦**：提示词强调 top-down journey map、soft painterly、vertical scroll、clear path corridor、no text。
- **手绘 + Procreate/Figma**：按 Region 条带画，导出后配置进 `assets`。
- **现成素材站**：选无字竖向 fantasy map，再按规范裁切。

### 当前工程资产

- `assets/images/adventure/world-map-procedural-v1.png`（1024×2560）— 主用可延伸底图
- `assets/images/adventure/world-map.png`（1152×2064）— 备用旧版

替换步骤：

1. 按规范出图 → 覆盖或新增文件  
2. 更新 `WORLD_MAP_ART` + `MAP_ART_ASPECT`  
3. 热重载看路径是否压住关键地标；算法节点仍自动排布  
