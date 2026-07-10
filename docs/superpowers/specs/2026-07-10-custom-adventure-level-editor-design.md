# 自定义冒险关卡编辑器设计

## 状态

- 产品方向：已确认
- 原型反馈：关卡编辑流程通过；勋章改为支持上传自定义设计图
- 实现状态：待计划与开发

## 背景

当前“星河海岸”关卡在客户端 `src/adventure/adventureCampaign.ts` 和服务端
`server/src/adventure/adventureRules.ts` 中各维护一份固定配置。数据库只保存行动力流水、进度快照和领奖状态，无法由用户新增或编辑关卡。

本设计将现有固定路线迁移为服务端动态配置。每个情侣空间仍只有一条当前路线，但空间创建者可以设计关卡、添加关卡和配置奖励。勋章不局限于内置图标，允许上传自己的设计图。

## 目标

- 空间创建者可以新增、编辑和删除尚未解锁的关卡。
- 关卡按照累计行动力门槛解锁，编辑时直接填写“累计 N 点”。
- XP、勋章和来信三类奖励可以独立启用。
- 勋章支持上传自定义图片，并保留内置图标与颜色作为兜底。
- 已解锁关卡锁定影响结算的字段，避免修改历史奖励或破坏当前进度。
- 客户端和服务端使用同一份服务端配置，移除当前双份写死配置。
- 现有空间自动获得“星河海岸”默认关卡，不丢失行动力、领奖记录或 XP。

## 非目标

- 不支持一个空间同时创建或切换多条冒险路线。
- 不开放地图背景上传、关卡坐标拖拽、分支路线或路线连线编辑。
- 不做 AI 生成关卡、勋章或来信。
- 不允许普通成员修改关卡。
- 不允许通过编辑已解锁关卡重新发放或提高历史 XP。

## 方案选择

### 方案 A：客户端 JSON 配置

把关卡保存为一段客户端 JSON。开发量较小，但服务端奖励结算无法可靠读取最新配置，校验、并发和历史奖励一致性也较差，不采用。

### 方案 B：服务端动态单路线（采用）

关卡定义保存到 PostgreSQL，通过专用 API 读取和编辑。服务端行动力结算直接读取动态配置，客户端只负责展示。该方案满足当前需求，同时可以在未来扩展多路线。

### 方案 C：完整多路线设计器

一次实现路线模板、启用状态、切换、归档和进度隔离。扩展性最高，但当前没有多路线需求，迁移和状态模型明显更复杂，暂不采用。

## 权限

- 所有空间成员均可读取路线、关卡和已获得奖励。
- 只有 `owner` 可以新增、编辑、排序或删除关卡。
- `member` 请求任何管理接口时返回 `403`。
- “关卡设计”入口只对 `owner` 展示，但服务端仍必须独立校验权限。
- `adventure_badge` 类型的图片上传签名只允许 `owner` 获取。

## 页面与交互

### 管理入口

冒险页顶部增加管理按钮。空间创建者点击后进入：

```text
/adventure/manage
```

普通成员不显示该按钮。

### 关卡列表

列表展示：

- 关卡名称
- 累计行动力门槛
- 已启用奖励摘要
- `已解锁` 或 `可编辑` 状态
- 编辑入口
- 添加关卡入口

已解锁关卡形成固定前缀，不能删除，也不能移动到其他门槛。未解锁关卡允许排序；拖动排序时，系统交换未解锁关卡所处的累计门槛，确认前显示变更结果。

### 关卡表单

基础字段：

- 关卡名称，必填，1 至 40 字符。
- 累计行动力门槛，正整数，必须大于前一关并小于后一关。
- XP 奖励开关及数量。
- 勋章奖励开关、名称、默认图标、默认颜色和自定义图片。
- 来信奖励开关、标题和正文。

至少启用一种奖励。新增关卡以及未解锁关卡调整后的门槛都必须处于当前累计行动力之后，避免保存后落入已走过区间而无法经过正常跨关结算。

### 勋章上传

勋章采用“自定义图片优先、内置样式兜底”：

1. 用户从相册选择图片或拍照。
2. 客户端提供 1:1 裁切，最长边压缩到 768 px。
3. 源文件支持 JPEG、PNG、WebP；完成裁切与压缩后的上传文件限制为 5 MB，避免高分辨率原图在压缩前被误拒绝。
4. 客户端调用 `/api/uploads/presign`，使用 `kind: "adventure_badge"` 获取 R2 上传地址。
5. 图片直传 R2，关卡记录只保存 `badge_image_key`。
6. 勋章册、下一站奖励和解锁反馈统一显示该图片。
7. 图片缺失或加载失败时显示默认图标和颜色。

已解锁关卡仍允许替换或移除勋章图片，因为该操作只改变展示，不改变奖励结算。替换或移除后，服务端 best-effort 清理旧 R2 对象。

## 已解锁关卡规则

“已解锁”按该空间是否曾存在该关卡的 `adventure_station_rewards` 记录判断。即使后来撤销打卡导致奖励处于 `reversed_at` 状态，该关卡仍视为曾解锁，不重新开放结构编辑。

已解锁后锁定：

- 删除关卡
- 累计行动力门槛
- 关卡排序
- XP 开关和 XP 数量
- 勋章、来信奖励的启用或关闭状态

已解锁后仍可编辑：

- 关卡名称
- 勋章名称、默认图标、默认颜色和自定义图片
- 来信标题和正文

这样可以修正文案和替换视觉设计，同时不会撤回已获得内容或重复发放 XP。

## 数据模型

### adventure_campaigns

每个空间首版只有一条路线：

```text
space_id       TEXT NOT NULL
id             TEXT NOT NULL
title          TEXT NOT NULL
subtitle       TEXT
version        INTEGER NOT NULL DEFAULT 1
created_at     TIMESTAMPTZ NOT NULL
updated_at     TIMESTAMPTZ NOT NULL
PRIMARY KEY (space_id, id)
UNIQUE (space_id)
```

默认路线继续使用 `id = "star-coast"`，与现有 `adventure_progress.campaign_id` 保持一致。

### adventure_stations

```text
space_id          TEXT NOT NULL
campaign_id       TEXT NOT NULL
id                TEXT NOT NULL
title             TEXT NOT NULL
sort_order        INTEGER NOT NULL
unlock_at         INTEGER NOT NULL
xp_enabled        BOOLEAN NOT NULL
xp_amount         INTEGER NOT NULL
badge_enabled     BOOLEAN NOT NULL
badge_title       TEXT
badge_image_key   TEXT
badge_icon        TEXT
badge_color       TEXT
story_enabled     BOOLEAN NOT NULL
story_title       TEXT
story_body        TEXT
version           INTEGER NOT NULL DEFAULT 1
created_at        TIMESTAMPTZ NOT NULL
updated_at        TIMESTAMPTZ NOT NULL
PRIMARY KEY (space_id, id)
UNIQUE (space_id, campaign_id, sort_order)
UNIQUE (space_id, campaign_id, unlock_at)
```

`unlock_at` 是累计门槛，不再存当前固定配置中的 `segmentCost`。运行时需要路段行动力时，通过相邻关卡门槛相减得到。

奖励字段校验：

- `xp_enabled = false` 时 `xp_amount` 归零。
- `badge_enabled = true` 时 `badge_title` 必填；图片可为空。
- `story_enabled = true` 时标题和正文必填。
- 至少一个 `*_enabled` 为 `true`。

### 现有表调整

- `adventure_progress` 保留现有结构，快照根据动态关卡重算。
- `adventure_station_rewards` 保留 `station_id`，继续以 `(space_id, station_id)` 幂等。
- 关卡奖励记录不复制文案和图片；收藏页读取当前关卡展示字段，因此 owner 可以更新已解锁勋章与来信的展示内容。

## 默认数据与迁移

首次读取或 schema 初始化时，为没有路线配置的空间写入默认路线：

```text
星河海岸
月光灯塔：累计 6 点
水晶桥：累计 14 点
观星台：累计 24 点
```

默认站点 ID 保持 `moonlight-tower`、`crystal-bridge`、`star-observatory`，确保已有 `adventure_station_rewards.station_id` 继续匹配。

迁移后：

- 不修改 `adventure_point_transactions`。
- 不重新发放或撤销 XP。
- 使用现有总行动力和动态关卡重算 `adventure_progress`。
- 如果已有领奖记录，则对应关卡立即进入结构锁定状态。

## API

### 读取

```text
GET /api/adventure/campaign
```

返回当前路线、按 `sort_order` 排序的关卡、每关是否曾解锁，以及当前配置版本。

### 管理

```text
POST   /api/adventure/stations
PUT    /api/adventure/stations/:stationId
DELETE /api/adventure/stations/:stationId
POST   /api/adventure/stations/reorder
```

所有写接口要求 `owner`。新增、更新和排序在事务内完成：

1. 锁定当前空间路线与相关关卡行。
2. 校验请求版本，版本过期返回 `409`。
3. 校验累计门槛严格递增且不存在重复。
4. 校验关卡是否曾解锁，以及本次修改是否触碰锁定字段。
5. 写入关卡并增加版本。
6. 重算进度快照。
7. 广播 `data_changed: adventure`。

删除接口仅允许删除从未解锁的关卡。删除后清理该关卡尚未引用的勋章图片。

### 图片上传

现有接口扩展上传类型：

```json
POST /api/uploads/presign
{
  "kind": "adventure_badge",
  "contentType": "image/png",
  "sizeBytes": 245760
}
```

服务端要求：

- 当前账号是空间 `owner`。
- MIME 为 JPEG、PNG 或 WebP。
- `sizeBytes <= 5 MB`。
- 对象 key 位于当前空间的 `adventure_badges/` 前缀。

关卡保存接口只接受属于当前空间该前缀的 key，不能引用其他空间图片。

## 动态进度与奖励结算

服务端 `adventureActionService` 不再导入固定 `STAR_COAST_CAMPAIGN`，而是在同一事务中读取当前空间动态路线。

计算规则：

- 关卡按 `sort_order` 排序。
- 当前总行动力达到 `unlock_at` 时解锁关卡。
- `segmentCost = next.unlockAt - current.unlockAt`。
- 一次动作可能同时增加打卡和全勤 2 点；服务端必须找出 `(beforePoints, afterPoints]` 内的全部关卡，按顺序逐个通过 `(space_id, station_id)` 幂等领取奖励，不能只处理最终关卡。
- XP 使用关卡当前锁定的 `xp_amount` 发放。
- 撤销打卡可能一次跌破多个门槛；服务端按门槛倒序撤销对应奖励和 XP。

因为已解锁关卡的门槛和 XP 永久锁定，后续展示内容修改不会改变结算结果。

## 客户端结构

新增：

```text
app/adventure/manage.tsx
app/adventure/station/[id].tsx
src/adventure/adventureAdminClient.ts
src/adventure/AdventureStationForm.tsx
src/adventure/AdventureBadgePicker.tsx
```

调整：

- `app/(tabs)/adventure.tsx` 从服务端读取 campaign，不再导入固定配置。
- `AdventureMap`、`AdventureCollection` 接收动态关卡。
- `AdventureCollection` 使用 `publicUrl(badgeImageKey)` 显示自定义图片。
- `src/sync/uploadClient.ts` 增加 `adventure_badge` 上传类型。
- 图片选择逻辑增加 1:1 勋章选择器，不复用当前商城奖励图的 4:3 裁切。

## 错误处理

- 门槛重复或顺序错误：表单定位到累计行动力字段并显示可用范围。
- 已解锁关卡修改锁定字段：服务端返回 `409`，客户端重新加载最新关卡。
- 配置版本过期：提示“关卡已在另一台设备更新”，保留未提交表单内容供用户重新确认。
- 图片选择权限被拒绝：沿用现有相册权限提示。
- 图片上传失败：不提交关卡修改，保留本地预览并允许重试。
- 图片加载失败：展示默认图标和颜色。
- 动态配置缺失：服务端创建默认路线后重试读取，不回退到客户端写死配置。

## 测试策略

### 服务端

- 默认路线创建与已有空间迁移。
- owner 可写、member 返回 `403`。
- 新增关卡的累计门槛和奖励字段校验。
- 未解锁关卡可删除；曾解锁关卡不能删除或修改锁定字段。
- 已解锁关卡可更新勋章图片和来信内容。
- 动态关卡门槛驱动进度、领奖、撤销和 XP 幂等。
- 相邻累计门槛只差 1 点时，一次 `+2` 或 `-2` 正确批量处理全部跨越关卡。
- `adventure_badge` presign 的 owner、MIME、大小和空间前缀校验。
- 图片替换和删除后的旧对象清理。

### 客户端

- owner 显示管理入口，member 不显示。
- 新增和编辑表单字段校验。
- 三类奖励独立开关，至少选择一种。
- 勋章图片选择、1:1 预览、上传、替换、移除和加载失败兜底。
- 已解锁关卡禁用结构字段，但允许编辑展示字段。
- 动态关卡正确渲染地图、累计门槛、勋章册和来信。

### 运行时验证

1. 从默认三关开始新增“云端花园”，设置累计 30 点。
2. 为该关上传自定义勋章，并启用来信、关闭 XP。
3. 普通成员可以看到新关卡但不能进入管理页。
4. 累计到 30 点后解锁该关，勋章册显示上传图片。
5. 替换已解锁勋章图片，双方刷新后看到新图，奖励不重复发放。
6. 尝试修改该关门槛、XP 或删除，服务端拒绝。

## 验收标准

- 关卡定义不再由客户端和服务端常量决定。
- owner 可以添加任意数量的未来关卡，并直接设置累计行动力门槛。
- XP、勋章和来信可以逐项启用或关闭。
- 勋章可上传自定义图片，并在所有奖励展示位置一致呈现。
- 自定义图片失败时有默认样式兜底，勋章不会显示为空白。
- 已解锁关卡不能删除或修改门槛、排序、奖励开关和 XP。
- 已解锁关卡可以更新名称、勋章图片和来信内容。
- member 无法通过 UI 或 API 修改关卡。
- 现有空间迁移后行动力、关卡进度、领奖记录和 XP 保持一致。
