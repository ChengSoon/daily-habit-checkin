# 童话黏土 3D 浮岛冒险地图设计

## 背景

当前 AdventureMap 使用平面圆点、简单曲线和少量背景形状表达路线。它能够正确展示动态关卡与累计行动力，但空间层次、关卡辨识度和抵达仪式感不足。

本设计把地图升级为固定视角的童话黏土 3D 浮岛。高精度地形、城堡、瀑布、树木和房屋使用原创场景素材表达，实时路线、关卡、标签和双人头像继续由 React Native/SVG 渲染。该结构支持 owner 自定义任意数量的关卡，不引入可旋转真 3D 引擎，也不改变现有服务端 campaign、progress 和 rewards 契约。

## 已确认方向

- 交互深度：固定视角 2.5D，不允许手势旋转镜头。
- 视觉主题：用户参考图所示的柔光、粉彩、黏土质感童话浮岛，只改造现有地图区域。
- 路线组织：地图随关卡数量纵向延伸，可滚动探索。
- 延伸节奏：每 4 关形成一座浮岛，每 12 关经过一道章节门，地图始终在同一条纵向世界线上继续生长。
- 扩展方式：owner 只需新增关卡；场景段、章节编号、氛围、章节门和节点位置全部由关卡顺序确定性推导，不增加地图坐标配置。
- 解锁反馈：“岛屿苏醒”——路径点亮、双人移动、节点升起、地标出现。
- 渲染方案：原创 WebP 3D 场景素材 + React Native + react-native-svg 混合渲染。
- 地标层级：建筑位于节点后侧，只承担场景叙事；节点编号和文字永远在前。

原型证据保存在：

    docs/assets/prototypes/3d-fairytale-map-reference.png
    .superpowers/brainstorm/31538-1783678159/content/3d-map-style-options.html
    .superpowers/brainstorm/31538-1783678159/content/star-island-layout.html
    .superpowers/brainstorm/31538-1783678159/content/station-landmark-placement-v2.html
    .superpowers/brainstorm/31538-1783678159/content/island-awakening-storyboard.html

## 目标

1. 地图第一眼具备立体沙盘和漂浮岛屿感，而不是平面节点列表。
2. 支持 0、1 和任意数量动态关卡，不因关卡增加而挤成一屏。
3. 已完成、当前、未来三种状态能在不阅读文字时被识别。
4. 双人头像准确停留在当前路径进度，并在解锁时沿路径移动。
5. 新关卡只播放一次解锁仪式，刷新页面不会重复播放。
6. 深色模式、减少动态效果和较低性能设备均有稳定降级。
7. owner 在现有 campaign 尾部新增关卡后，旧关卡的场景归属和章节归属保持稳定，新关卡自然接入顶部预告区域。

## 非目标

- 不实现手势旋转、自由缩放、透视相机或三维碰撞。
- 不引入 Three.js、Expo GL 或 Skia。
- 不增加服务端地图主题、场景素材或镜头配置字段。
- 第一版不允许 owner 单独选择每一关的建筑模型；地标由顺序和现有勋章图标确定性生成。
- 不修改行动力、关卡解锁和奖励结算规则。

## 方案比较

### 方案 A：纯 React Native View

不增加依赖，使用 View、圆角、阴影和 transform 组合地图。性能稳定，但弯曲道路、发光进度和复杂岛屿轮廓容易显得生硬，不采用。

### 方案 B：纯 React Native + SVG 混合渲染

SVG 绘制路线、渐变、薄雾、岛屿轮廓和进度高光；React Native View 绘制关卡节点、建筑、标签和头像。动态能力足够，但难以达到参考图的黏土材质、丰富地形和柔和全局光照，不采用。

### 方案 C：React Native Skia

粒子、着色和高频动画能力最强，但依赖、构建和维护成本明显高于当前需求，不采用。

### 方案 D：原创 3D 场景素材 + 动态 SVG/UI（采用）

使用生成工具制作无文字、无节点的原创浮岛场景段和透明地标精灵，Expo Image 负责高精度场景；SVG 与 React Native 负责真实路线、发光底座、动态图标、门槛标签、头像和解锁动画。该方案最接近参考图，同时不会把动态关卡写死在一张图片中。

## 页面结构

冒险页其他信息结构保持不变，原地图区域替换为一个约 520 px 高的独立地图视口。

    Adventure Screen
    ├── Header / campaign title
    ├── Journey headline
    ├── AdventureMap viewport
    │   └── internal vertical ScrollView
    │       ├── repeating StarIslandSceneAssets
    │       ├── AdventureRouteSvg
    │       ├── AdventureChapterGates
    │       ├── AdventureFogLayer
    │       ├── AdventureStationNodes
    │       ├── AdventureLandmarks
    │       └── AdventureTravelers
    ├── 累计行动力
    ├── 下一站奖励
    ├── 章节进度
    └── 旅程收藏

地图内部负责纵向滚动，避免大量关卡让整个冒险页无限增长。进入页面时自动滚动到当前关卡附近，并保留上一站和下一站的上下文。

## 组件边界

### AdventureMap

保留当前公开组件名，负责：

- 创建地图布局模型。
- 管理内部 ScrollView 和自动定位。
- 协调静态最终状态与解锁动画状态。
- 将 campaign、progress、people 和待展示解锁事件传给子组件。

### StarIslandSceneSegment

通过 Expo Image 渲染本地 WebP 浮岛场景段。第一版准备 3 套原创场景：

- 城堡高地：城堡、花园、云层和高地道路。
- 瀑布溪谷：瀑布、河流、小桥和悬崖。
- 温馨营地：房屋、树林、花田和休息平台。

场景素材不包含文字、关卡底座、头像或发光路径，也不使用巨大空圆台作为 UI 占位。每套素材附带独立布局清单，声明 4 个小型自然落脚点、路径锚点、地标区和上下拼接区。落脚点只比动态节点大约 1.3–1.5 倍，并由连续 S 形泥土路连接。场景段按顺序循环并交替镜像，使用云雾、小浮岛和约 40 px 的视觉重叠遮盖接缝。

同一套素材通过客户端色调层形成章节差异，不随关卡数增加资源包：

- 第 1 章：清晨暖光。
- 第 2 章：夕阳粉橙。
- 第 3 章：月色蓝紫。
- 第 4 章起循环以上氛围，并继续通过镜像和地标排列降低重复感。

### AdventureRouteSvg

负责：

- 每个场景段的贝塞尔曲线路径。
- 未到达路线底色。
- 已完成路线高亮。
- “岛屿苏醒”中的 stroke dash 推进动画。

路线必须表现为一条可追踪的自然道路：背景素材提供泥土路基，SVG 只叠加稀疏踏石和已抵达辉光，不再用粗紫色实线覆盖地形。

### AdventureChapterGate

每完成 12 关在第三个场景段出口放置章节门，负责表达连续世界的阶段转换：

- 关卡 12、24、36……之后出现章节门。
- 已跨越章节门降低亮度并显示完成印记。
- 当前章节门显示下一章编号和氛围名称。
- campaign 恰好停在章节边界时，门后仍露出一部分被云雾遮住的下一座浮岛，提示 owner 后续新增关卡时从这里继续。
- 章节门是客户端推导的展示层，不参与解锁判断，也不作为奖励关卡。

### AdventureFogLayer

云雾只包围尚未配置关卡的顶部预告岛，不再横向切开当前路线。当前目标之后的节点通过降低饱和度、紧凑编号和锁定轮廓表达距离；当最后一座岛刚好填满 4 关时，局部云团遮住预告岛的一部分，并露出章节门或道路剪影。云雾不拦截点击和滚动；减少动态效果时保持静态。

### AdventureStationNode

负责节点、状态和文字：

- completed：粉紫色完成节点，不显示大标签。
- current：金色发光底座、柔和脉冲和双层光环，显示唯一一张完整标题卡。
- next：显示小型“累计 N 点”门槛胶囊，是远方第一个明确目标。
- future：降低饱和度和光晕，只展示关卡序号或锁定图标。
- 完整名称与状态只属于当前目标，避免大量白色标签遮挡地形、头像和路线。

### AdventureLandmark

地标使用独立透明 WebP 精灵，而不是画死在节点上。第一版准备灯塔、桥、观星台和花园 4 个变体，按站点顺序和现有 badgeIcon 确定性选择。地标放置在场景清单预留的安全区，zIndex 低于节点和标签，因此可以执行“从节点后侧升起”的解锁动画，同时不新增数据库字段。

### AdventureTravelers

使用现有情侣头像数据：

- 静态时停留在当前累计进度对应的路径坐标。
- 动画时从上一坐标插值到新节点。
- 无头像时继续使用双人默认符号兜底。

### adventureMapSceneManifest.ts

声明本地场景和地标资源、节点安全区、贝塞尔路径锚点、镜像规则和接缝重叠量。场景素材本身不得包含任何产品文案或关卡状态。

### adventureMapLayout.ts

纯函数模块，把动态 campaign 转换为渲染模型：

    type AdventureMapLayout = {
      contentHeight: number;
      segments: ScenePlacement[];
      chapterGates: ChapterGatePlacement[];
      stations: StationPlacement[];
      routePoints: MapPoint[];
      traveler: RoutePosition;
    };

不得读取主题、网络、组件状态或本地存储，确保可独立测试。

## 布局与长期延伸算法

### 稳定分段

- 每 4 个关卡形成一个 IslandSegment，并绑定一套场景素材清单。
- `segmentIndex = floor(stationIndex / 4)`；既有关卡不会因为尾部新增关卡而改变场景归属。
- `chapterIndex = floor(stationIndex / 12)`；章节完全由关卡顺序推导，不写入服务端。
- 单段视觉高度为 640 px，相邻素材重叠约 40 px。
- 每段提供 4 个预留自然落脚点和一条连续道路。
- 关卡少于 4 个时只使用所需锚点，起点作为独立锚点，不计入 campaign station 数量。

### 顶部预告与新增关卡

- 地图场景数按 `max(1, ceil((stationCount + 1) / 4))` 计算。
- 当当前最后一座岛刚好填满 4 关时，额外创建一座被云雾覆盖的预告岛；新增下一关会直接填入该岛，而不是突然创建一个无上下文的新页面。
- campaign 恰好为 12、24、36……关时，预告岛前显示下一章节门。
- owner 新增关卡不需要选择坐标、场景或章节；保存并刷新 campaign 后，新节点自动接到现有路线顶端。
- 删除或重排关卡仍以最新 `sortOrder` 重新布局，这是 owner 主动改变旅程顺序的预期结果。

### 章节门与场景变体

```ts
type ChapterGatePlacement = {
  id: string;
  chapterIndex: number;
  afterStationIndex: number;
  segmentIndex: number;
  point: MapPoint;
};
```

- 每 12 关生成一道门，位置取该章第三个场景段的出口锚点。
- 第 13、25、37……关位于门后的下一场景段。
- 场景顺序始终为 `camp → waterfall → castle`，章节通过色调、镜像和地标组合形成差异。
- 章节门不插入 `routePoints`，因此不会改变服务端 `stationIndex` 和旅者插值语义。

### 滚动稳定性与长地图性能

- contentHeight 取视口高度和全部场景段高度中的较大值。
- 当前旅者位置由 `stationIndex` 与 `segmentPoints / segmentCost` 插值得到。
- 进入地图后将当前节点放在视口中部偏下，方便预览下一站。
- 尾部新增关卡导致 contentHeight 增加时，ScrollView 同步增加相同的 offset，保持用户当前看到的旧场景不跳动。
- 只挂载视口上下各 1 个缓冲场景内的高分辨率背景、地标、节点和章节门；未挂载区域保留完整占位高度。
- SVG 路线可以保持单层矢量路径；高内存 WebP 和 React Native 节点必须按可见窗口裁剪。
- 30、60、120 个关卡使用同一套 3 张场景和 4 张地标资源，资源包大小不随关卡数增长。

## “岛屿苏醒”动画

### 单关解锁

总时长约 1.6 秒：

1. 0–200 ms：地图定位目标路段。
2. 200–800 ms：路径从上一站向新节点点亮。
3. 600–1100 ms：双人头像沿路线移动，节点向上弹出。
4. 900–1400 ms：地标从节点后侧淡入并上升。
5. 1200–1600 ms：显示本关勋章、来信和 XP 摘要。

### 多关同时解锁

- 2–3 关：按路线顺序播放压缩版路径推进，每段约 500 ms，只在最终关展示完整奖励摘要。
- 超过 3 关：用一次 1.2 秒路径扫光到最终节点，避免长时间阻塞操作。

### 动画约束

- 动画不可阻塞地图滚动、返回或标签切换。
- 页面刷新、远端 invalidation 和重复加载不重复播放。
- 开启系统“减少动态效果”时只执行路径变色和节点淡入。
- 动画发生异常时立即进入最终状态，不影响 campaign 展示。

## 解锁事件识别

服务端继续返回现有 campaign、progress 和 active station rewards。客户端在本地记录已展示过的 station ids。

本地 key：

    adventure_seen_stations:<spaceId>:<campaignId>

流程：

1. 冒险页并行读取 campaign、progress、rewards、account 和本地 seen ids。
2. claimedStationIds 减去 seenStationIds 得到待展示解锁列表。
3. 本地不存在记录时，把当前 claimed ids 作为初始基线，不重播历史关卡。
4. 有新增 ids 时按 campaign 顺序交给地图动画队列。
5. 动画完成或用户跳过后保存最新 seen ids。
6. 切换账号、空间或 campaign 时使用独立 key，互不干扰。

本地记录只控制动画展示，不参与奖励真实性、解锁状态或同步判断。

## 视觉系统

### 基础美术

- 造型：圆润黏土、微缩沙盘和等距浮岛。
- 色彩：奶油白、樱花粉、薰衣草紫、嫩绿和浅湖蓝。
- 光照：柔和晨雾、暖色边缘光和低对比环境阴影。
- 场景：城堡、瀑布、河流、树木、房屋、花田和云层。
- 路线：白色石板加粉紫辉光。
- 当前节点：参考图式金色发光底座。
- 已完成节点：粉紫色发光底座。
- 未来节点：降低饱和度和发光强度。

### 深色主题

- 第一版复用同一套粉彩场景素材，避免资源包翻倍。
- 地图外围、标签和遮罩根据深色主题调整为深蓝紫；场景覆盖轻量冷色蒙层。
- 路线、节点与文字继续使用深色主题高对比语义色。

### 层级

    3D 场景素材 < 动态路线 < 透明地标精灵
    < 章节门 < 预告岛云雾 < 双人头像 < 关卡节点 < 当前关卡标签

任何建筑、薄雾和粒子都不能遮挡节点编号、门槛或当前状态。

## 性能与可访问性

- 使用 Expo Image 渲染本地 WebP，使用 Expo 兼容版本的 react-native-svg 绘制动态路线，不使用 GL。
- 3 套场景素材建议为 1024 px WebP，单张目标小于 700 KB；透明地标精灵单张目标小于 150 KB。
- 场景素材本地打包并复用，禁止按用户关卡数量生成新图片或网络实时生成。
- SVG 按场景段拆分，避免一条超长 path 频繁重绘。
- 仅动画中的路段使用 Animated 值，历史路段保持静态。
- Expo Image 负责缓存重复场景资源；同一素材的多个实例不重新下载。
- 长地图只渲染可见窗口附近的场景和节点，避免 100+ 关同时解码数十张 1080p 场景图。
- 节点提供完整 accessibility label，例如“第 4 关，云端花园，累计 30 点解锁”。
- 当前关卡使用颜色、光环和文字三重表达，不只依赖颜色。
- 降低动态效果时不使用大范围位移和弹性缩放。

## 错误与边界处理

- campaign 为空：显示起点浮岛和“等待添加关卡”，不生成无效路径。
- 只有 1 关：起点和目标保持完整间距。
- segmentCost 小于等于 0：旅者停在当前锚点，避免除零。
- 头像图片失败：沿用现有默认头像。
- 场景素材加载失败：显示同尺寸渐变天空、简化浮岛和完整动态节点，地图仍可使用。
- SVG 渲染或动画状态异常：显示静态最终路径与节点。
- 本地 seen ids 解析失败：以当前 claimed ids 建立新基线，不重播全部历史。
- 新关卡在动画期间被远端调整：本轮按已加载快照完成，下一次刷新使用最新 campaign。
- 尾部新增关卡导致地图高度变化：补偿旧 scroll offset；若用户位于当前目标附近，则优先自动定位到当前目标。
- 超长地图可见窗口计算异常：回退为渲染当前场景及相邻场景，不影响节点数据和进度判断。

## 文件影响

预计修改：

    package.json
    package-lock.json
    app/(tabs)/adventure.tsx
    src/sync/localSettings.ts
    src/adventure/AdventureMap.tsx

预计新增素材：

    assets/adventure-map/scene-castle.webp
    assets/adventure-map/scene-waterfall.webp
    assets/adventure-map/scene-camp.webp
    assets/adventure-map/landmark-lighthouse.webp
    assets/adventure-map/landmark-bridge.webp
    assets/adventure-map/landmark-observatory.webp
    assets/adventure-map/landmark-garden.webp

预计新增：

    src/adventure/adventureMapLayout.ts
    src/adventure/adventureMapLayout.test.ts
    src/adventure/adventureUnlockPresentation.ts
    src/adventure/adventureUnlockPresentation.test.ts
    src/adventure/adventureMapSceneManifest.ts
    src/adventure/AdventureRouteSvg.tsx
    src/adventure/AdventureStationNode.tsx
    src/adventure/StarIslandSceneSegment.tsx
    src/adventure/AdventureLandmark.tsx
    src/adventure/AdventureTravelers.tsx

## 测试策略

### 纯逻辑

- 0、1、4、5、11、12、13、24、25、30、60、120 关卡布局。
- 奇偶场景段镜像。
- 每 12 关章节门的位置、数量和章节色调循环。
- 满 4 关后的顶部预告岛，以及新增下一关前后旧关卡场景归属稳定。
- 可见场景窗口和 contentHeight 增长后的滚动偏移补偿。
- 当前进度坐标插值和 segmentCost 为 0。
- claimed/seen 差集、首次基线和多空间隔离。
- 多关动画压缩策略。

### 组件与静态检查

- SVG 路线接受动态路径和进度。
- 场景清单中的资源、4 个安全锚点和拼接区完整。
- 节点状态、标签和 accessibility 文案。
- TypeScript、lint 和现有全量测试。

### 运行时

- iPhone 模拟器检查明亮和深色主题。
- 3、8、12、13、30、60 个关卡检查滚动、章节门、迷雾、节点遮挡和场景复用。
- 在 owner 端从 12 关新增到 13 关，确认新关进入门后预告岛，旧地图视野不跳动。
- 真实打卡跨 1 关和一次跨多关。
- 重新进入页面不重复播放。
- 开启减少动态效果验证降级。
- Android/Web 至少完成静态渲染和类型检查；若运行面可用则补截图。

## 验收标准

- 地图呈现接近参考图视觉语言的童话黏土浮岛、城堡、瀑布、树木、柔光和微缩沙盘层次，但不复制参考图具体构图。
- 场景素材保持纯背景，真实关卡、路径、门槛和头像均由动态 UI 渲染。
- 关卡数量增加后地图纵向扩展，不缩小成难以点击的一屏。
- 每 4 关自然进入下一座浮岛，每 12 关出现章节门和明显氛围变化；13、25、37……关能继续向上生长。
- campaign 尾部新增关卡后无需手工配置地图，既有关卡场景归属稳定，当前滚动视野不突跳。
- 60+ 关时只挂载可见窗口附近的高分辨率场景与节点，不随总关卡数线性占用图片内存。
- 当前、完成和未来状态清晰，建筑不遮挡节点或文字。
- 双人头像位于实际路径进度上。
- 新关卡解锁播放一次“岛屿苏醒”，刷新后不重播。
- 多关同时解锁不会产生过长动画。
- 减少动态效果和动画异常不会影响地图使用。
- 不修改服务端解锁、奖励或 campaign 数据模型。
