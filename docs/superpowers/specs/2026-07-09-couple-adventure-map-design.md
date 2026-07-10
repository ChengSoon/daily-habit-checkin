# 双人冒险地图设计

## 背景

当前 App 已经具备双人共享空间、每日打卡、XP 钱包、奖励商城、头像归属、实时同步和打卡庆祝动画。用户希望在现有“打卡获得积分”的基础上，增加一条更有游戏主线感的长期体验：每天完成习惯不只是增加数字，而是在两个人的共同地图上继续前进。

本功能以 Stitch 原型图中的“Couple Adventure / 去月光灯塔”为视觉方向：温柔、梦幻、带轻游戏感，但仍然像一个真实习惯 App，而不是独立游戏。

## 目标

- 将每日打卡转化为“行动力”，推动双人共享地图进度。
- 让用户打开冒险页时能清楚看到当前目标、累计行动力、已解锁关数、下一站奖励和章节进度。
- 让两个人共享同一条冒险进度；任意一方打卡后，另一方能通过同步看到进展。
- 到达站点时解锁确定性奖励，例如徽章、XP、剧情短句。
- 保持第一版规则简单、正向、幂等，避免引入复杂数值系统。

## 后续扩展

本文描述最初固定路线版本。用户自定义关卡、动态奖励配置和自定义勋章图片由
`docs/superpowers/specs/2026-07-10-custom-adventure-level-editor-design.md` 接续设计；其中与固定客户端配置冲突的内容以后续设计为准。

## 非目标

- 不做自由选路线或多地图并行。
- 不做道具加成、Boss 战、战斗数值或随机抽奖。
- 不做 AI 自动生成地图和剧情。
- 初始版本不做用户自定义站点或章节编辑器；该限制已由后续自定义关卡设计解除。
- 不替代现有 XP 商城；商城仍用于兑换奖励，冒险地图负责长期主线感。
- 不做离线复杂合并；沿用当前云端直连和 WebSocket 变更刷新模型。

## 核心玩法

基础循环：

```text
完成今日习惯
  → 获得行动力
  → 推进当前章节路线
  → 抵达下一站
  → 解锁站点奖励
  → 进入下一段路线
```

V1 使用固定章节“星河海岸”，当前目标站点示例为“月光灯塔”。行动力跨日期永久累计，站点按累计门槛解锁：月光灯塔累计 6 点、水晶桥累计 14 点、观星台累计 24 点。冒险页显示“累计 4 点”“已解锁 0 / 3 关”，并提示“累计行动力还差 2 点到下一站”。

## 行动力规则

行动力是空间级进度，不属于单个账号。规则如下：

- 每完成 1 个今日应执行习惯，获得 `+1` 行动力。
- 当天所有应执行习惯完成后，额外获得 `+1` 全勤行动力。
- 同一个习惯同一天只允许产生一次打卡行动力。
- 同一天的全勤行动力只允许产生一次。
- 暂停习惯不参与今日任务和全勤判断。
- 非执行日不参与今日任务和全勤判断。
- 数值型习惯只有提交数值并完成后才产生行动力。
- 撤销打卡时撤销对应打卡行动力；如果撤销导致当天不再全勤，也撤销全勤行动力。
- 所有行动力变动必须通过唯一键幂等保护，刷新、重试和同步不能重复发放。

唯一键建议：

```text
adventure:checkin:{habitId}:{dateKey}
adventure:all_done:{dateKey}
adventure_undo:checkin:{habitId}:{dateKey}:{checkInId}
adventure_undo:all_done:{dateKey}:{checkInId}
```

## 地图与站点

V1 的地图内容可以先写死在客户端常量中，后续再迁移到服务端配置。

```ts
type AdventureChapter = {
  id: string;
  title: string;
  subtitle: string;
  backgroundImage: string;
  stations: AdventureStation[];
};

type AdventureStation = {
  id: string;
  title: string;
  segmentCost: number;
  reward: {
    xp: number;
    badgeTitle: string | null;
    storyTitle: string | null;
    storyBody: string | null;
  };
};
```

示例：

```ts
{
  id: "star-coast",
  title: "星河海岸",
  subtitle: "去月光灯塔",
  stations: [
    { id: "start", title: "启程", segmentCost: 0, reward: { xp: 0, badgeTitle: null, storyTitle: null } },
    { id: "moonlight-tower", title: "月光灯塔", segmentCost: 6, reward: { xp: 80, badgeTitle: "灯塔徽章", storyTitle: "新剧情" } },
    { id: "crystal-bridge", title: "水晶桥", segmentCost: 8, reward: { xp: 100, badgeTitle: "水晶桥徽章", storyTitle: "星河来信" } }
  ]
}
```

`segmentCost` 表示从上一站到当前站点需要多少行动力。系统根据累计行动力推导当前站点、下一站和当前路段剩余点数。

## 数据模型

### adventure_point_transactions

记录行动力流水，作为事实来源。

```ts
type AdventurePointTransaction = {
  id: string;
  uniqueKey: string;
  amount: number;
  reason: "checkin" | "all_done" | "checkin_undo" | "all_done_undo";
  habitId: string | null;
  checkInId: string | null;
  dateKey: string;
  accountId: string | null;
  createdAt: string;
};
```

服务端表字段建议：

- `id`
- `space_id`
- `unique_key`
- `amount`
- `reason`
- `habit_id`
- `check_in_id`
- `date_key`
- `account_id`
- `created_at`
- 唯一约束：`UNIQUE(space_id, unique_key)`

### adventure_progress

记录空间级进度快照，方便页面加载和同步刷新。

```ts
type AdventureProgress = {
  id: "default";
  campaignId: string;
  chapterId: string;
  totalPoints: number;
  currentStationId: string;
  nextStationId: string | null;
  segmentPoints: number;
  updatedAt: string;
};
```

服务端可以在写入行动力流水后，根据当前总点数重算并 upsert 快照。客户端也可以从流水推导，但页面读取快照更简单。

### adventure_station_rewards

记录站点奖励领取和撤销状态。

```ts
type AdventureStationReward = {
  id: string;
  stationId: string;
  xpTransactionKey: string | null;
  claimedAt: string;
  reversedAt: string | null;
};
```

站点奖励 XP 走现有 XP 钱包流水，新增 XP reason：

```ts
"adventure_station"
"adventure_station_undo"
```

站点 XP 的唯一键建议：

```text
adventure_station:{chapterId}:{stationId}
adventure_station_undo:{chapterId}:{stationId}:{sourceKey}
```

## 服务端接口与同步

新增同步资源：

- `adventure_point_transactions`
- `adventure_progress`
- `adventure_station_rewards`

为了保证行动力、进度快照、站点奖励和 XP 钱包的一致性，建议新增服务端动作接口，而不是完全让客户端分别 upsert 多张表：

```text
POST /api/adventure/checkin-awards
POST /api/adventure/checkin-awards/revoke
GET  /api/adventure/progress
GET  /api/adventure/rewards
```

`POST /api/adventure/checkin-awards` 输入：

```json
{
  "habitId": "habit-id",
  "dateKey": "2026-07-09",
  "checkInId": "check-in-id"
}
```

服务端在一个事务中完成：

1. 校验当前账号属于该 `space_id`。
2. 幂等插入打卡行动力流水。
3. 判断当天是否全勤，必要时幂等插入全勤行动力流水。
4. 重算 `adventure_progress`。
5. 如果新抵达站点，插入 `adventure_station_rewards`。
6. 如果站点包含 XP，调用现有钱包交易逻辑发放 XP。
7. 广播 `data_changed`，让另一台设备刷新冒险页。

撤销接口执行反向逻辑：

1. 插入负向行动力流水。
2. 如全勤条件不再成立，插入负向全勤流水。
3. 重算进度。
4. 如果进度跌回站点前，撤销对应站点奖励和 XP。

## 客户端模块

建议新增目录：

```text
src/adventure/
├── adventureCampaign.ts      # V1 固定章节与站点配置
├── adventureRules.ts         # 进度推导、下一站、奖励命中判断
├── adventureClient.ts        # 调用服务端动作接口
├── adventureRepository.ts    # 读取同步资源或 progress
└── types.ts
```

新增页面：

```text
app/(tabs)/adventure.tsx
```

调整底部 Tab：

```text
今日 / 冒险 / 习惯 / 我的
```

现有 `商城` 不再作为底部常驻 Tab，保留以下入口：

- 今日页 XP 卡片点击进入商城。
- 我的页奖励卡片进入商城。
- 兑换记录和奖励管理继续挂在我的页。

## 打卡流程接入

今日页完成打卡流程从：

```text
completeCheckIn
awardXpForCheckIn
reload
celebration
```

扩展为：

```text
completeCheckIn
awardXpForCheckIn
awardAdventureForCheckIn
reload
如果抵达新站点，显示抵达反馈
```

撤销流程从：

```text
undoCheckIn
revokeXpForCheckIn
reload
```

扩展为：

```text
undoCheckIn
revokeXpForCheckIn
revokeAdventureForCheckIn
reload
```

注意：冒险行动力和 XP 仍然是两条流水。普通打卡 XP 不依赖冒险；冒险站点 XP 作为额外奖励独立发放。

## 冒险页 UI

页面遵循 Stitch 原型：

1. 顶部栏
   - 左侧：当前用户头像。
   - 中间：`Couple Adventure` 或中文 `双人冒险`。
   - 右侧：设置入口，V1 可先跳转到“我的”或保留无操作。

2. 标题区
   - `双人冒险`
   - 当前目标，例如 `去月光灯塔`
   - 动态提示：`累计行动力还差 2 点到下一站`

3. 地图卡片
   - 使用固定背景图展示“星河海岸”。
   - 叠加路线节点、当前双人头像位置、终点标签。
   - 双人头像使用现有 `useCouple` 数据；只有自己时显示单头像。

4. 累计行动力卡片
   - 标题：`累计行动力`
   - 数值：`累计 4 点`
   - 说明：`跨天累计，每次打卡 +1，全勤额外 +1`
   - 下一关：`累计 6 点解锁月光灯塔`
   - 进度条颜色使用主题主色。

5. 下一站奖励
   - 展示徽章、XP、剧情三类奖励。
   - 没有某类奖励时隐藏对应项。

6. 章节进度
   - 展示 `星河海岸 · 已解锁 1 / 3 关`
   - 使用章节总站点数计算进度条。

7. 旅程收藏
   - “勋章册”展示所有站点勋章、累计解锁门槛和当前锁定状态。
   - “来信”展示已送达与未送达的信件；已送达来信可打开阅读正文。
   - 收藏状态以 `adventure_station_rewards` 中 `reversed_at IS NULL` 的记录为准。

## 反馈与状态

今日页打卡成功后新增轻反馈：

```text
行动力 +1
离月光灯塔还差 2 点
```

抵达站点时显示弹窗或全屏庆祝：

```text
抵达月光灯塔
解锁：灯塔徽章、+80 XP、新剧情
```

空状态：

- 未登录：提示“登录后和另一半开启双人冒险”。
- 已登录但没有另一半：显示单人也可推进，并提示邀请另一半。
- 没有活跃习惯：提示先创建习惯。
- 今日没有应执行习惯：显示“今天没有任务，冒险进度保持不变”。

## 风险与边界

- 行动力、站点奖励和 XP 必须在服务端事务中保持一致，否则可能出现“到站但没发奖励”或“撤销后奖励还在”。
- 如果站点 XP 与普通打卡 XP 都写入钱包，需要清晰区分 reason，避免撤销普通打卡时误撤站点奖励。
- 底部 Tab 移除商城入口会改变用户路径，需要保留今日页和我的页的商城入口。
- 地图背景如果直接使用 AI 生成图，需要保存在项目资产中，并避免过大影响包体。
- 当前同步模型是云端直连；未登录时不适合创建本地冒险进度，否则后续合并复杂。

## 验收标准

- 完成一个今日应执行习惯后，冒险行动力增加 1。
- 同一习惯同一天重复刷新或重试不会重复增加行动力。
- 当天所有应执行习惯完成后，只额外增加 1 点全勤行动力。
- 冒险页能显示当前章节、当前目标、累计行动力、累计解锁门槛、已解锁关数和章节进度。
- 已解锁勋章在勋章册中展示，已解锁来信可以打开阅读；未解锁奖励显示累计门槛。
- 行动力达到下一站门槛后，冒险页显示已抵达新站点。
- 抵达站点后，站点 XP 奖励只发放一次。
- 撤销打卡会撤销对应行动力；如果因此跌回站点门槛前，站点奖励和 XP 被撤销。
- 另一台设备完成打卡后，本机冒险页能通过同步刷新看到进度变化。
- 未登录、没有另一半、没有习惯、今日无任务时都有明确空状态。
- 现有 XP 商城、兑换记录、奖励管理入口仍可访问。

## 推荐实现顺序

1. 新增冒险类型、固定章节配置和纯规则测试。
2. 新增服务端表、动作接口和事务级幂等逻辑。
3. 新增客户端 adventure client/repository，并接入打卡和撤销流程。
4. 新增冒险 Tab 页面，先使用固定地图背景和站点配置。
5. 调整底部 Tab，把商城入口迁移到今日页和我的页。
6. 增加抵达站点反馈和今日页行动力轻反馈。
7. 补齐同步、撤销、空状态和回归测试。
