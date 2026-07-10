# 自定义冒险关卡编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前写死的星河海岸迁移为 owner 可管理的动态单路线，支持新增关卡、累计行动力门槛、独立奖励开关，以及上传自定义勋章图片。

**Architecture:** PostgreSQL 保存空间级路线与关卡定义，服务端在行动力事务内读取动态配置并批量处理跨越的关卡奖励。客户端统一通过 campaign API 渲染地图和收藏，管理页面只对 owner 开放；勋章图片复用现有 R2 presigned PUT 链路并增加空间归属校验。

**Tech Stack:** Expo Router, React Native, TypeScript, Vitest, Express 5, PostgreSQL, Zod, Cloudflare R2, existing WebSocket invalidation.

---

## File Structure

### Server

- Create `server/src/adventure/adventureCampaignRepository.ts`: 默认路线创建、动态路线读取、关卡 CRUD、版本锁和曾解锁查询。
- Create `server/src/adventure/adventureCampaignRepository.test.ts`: 仓储 SQL、默认数据和空间隔离测试。
- Create `server/src/adventure/adventureAdminService.ts`: 管理字段校验、已解锁字段锁定、排序和图片 key 校验。
- Create `server/src/adventure/adventureAdminService.test.ts`: 管理规则纯逻辑测试。
- Create `server/src/adventure/adventureAdminRoutes.test.ts`: owner/member、CRUD、409 与广播测试。
- Modify `server/src/adventure/adventureRules.ts`: 使用累计 `unlockAt`，支持一次跨越多个关卡。
- Modify `server/src/adventure/adventureActionService.ts`: 在事务内读取动态路线并批量发放/撤销奖励。
- Modify `server/src/adventure/adventureRoutes.ts`: 增加 campaign 与管理接口。
- Modify `server/src/adventure/adventureRepository.ts`: 增加曾解锁查询和批量奖励辅助。
- Modify `server/src/db/schema.ts`: 新增 campaign/station 表。
- Modify `server/src/r2/r2Client.ts`: 增加 `adventure_badge` 对象类型和路径。
- Modify `server/src/uploads/uploadRoutes.ts`: owner-only 勋章上传、大小校验。

### Client

- Create `src/adventure/adventureAdminClient.ts`: 关卡管理 API。
- Create `src/adventure/adventureAdminClient.test.ts`: 管理 API 请求形状。
- Create `src/adventure/adventureStationForm.ts`: 表单值、校验和 DTO 转换纯函数。
- Create `src/adventure/adventureStationForm.test.ts`: 累计门槛和奖励开关测试。
- Create `src/adventure/adventureBadgeImage.ts`: 1:1 选图、缩放和图片限制。
- Create `src/adventure/AdventureBadgePicker.tsx`: 自定义勋章图片选择、预览、替换和移除。
- Create `src/adventure/AdventureStationForm.tsx`: 新增/编辑关卡表单 UI。
- Create `app/adventure/manage.tsx`: owner 关卡列表与新增入口。
- Create `app/adventure/station/[id].tsx`: 新增和编辑关卡页面。
- Modify `src/adventure/types.ts`: 动态 campaign/station/reward DTO。
- Modify `src/adventure/adventureRules.ts`: 累计门槛进度规则。
- Modify `src/adventure/adventureClient.ts`: campaign 读取接口。
- Modify `src/adventure/AdventureCollection.tsx`: 自定义勋章图与兜底。
- Modify `src/adventure/AdventureMap.tsx`: 动态关卡。
- Modify `app/(tabs)/adventure.tsx`: 动态 campaign 和 owner 管理入口。
- Modify `src/sync/uploadClient.ts`: 增加 `adventure_badge` 上传类型和大小字段。

## Task 1: Dynamic Campaign Domain Rules

**Files:**
- Modify: `server/src/adventure/adventureRules.ts`
- Modify: `server/src/adventure/adventureRules.test.ts`
- Modify: `src/adventure/types.ts`
- Modify: `src/adventure/adventureRules.ts`
- Modify: `src/adventure/adventureRules.test.ts`

- [ ] **Step 1: Write server tests for cumulative thresholds and multi-station crossings**

Add cases using a campaign with thresholds `6`, `11`, and `12`:

```ts
const makeStation = (id: string, unlockAt: number, sortOrder: number): AdventureStation => ({
  id,
  title: id,
  sortOrder,
  unlockAt,
  version: 1,
  everUnlocked: false,
  reward: {
    xpEnabled: false,
    xp: 0,
    badgeEnabled: true,
    badgeTitle: `${id}-badge`,
    badgeImageKey: null,
    badgeIcon: "ribbon",
    badgeColor: "#E9507A",
    storyEnabled: false,
    storyTitle: null,
    storyBody: null
  }
});

const campaign: AdventureCampaign = {
  id: "star-coast",
  title: "星河海岸",
  subtitle: null,
  version: 1,
  stations: [
    makeStation("moonlight-tower", 6, 0),
    makeStation("cloud-garden", 11, 1),
    makeStation("star-observatory", 12, 2)
  ]
};

expect(calculateAdventureProgress(campaign, 11)).toMatchObject({
  currentStationId: "cloud-garden",
  nextStationId: "star-observatory",
  pointsToNext: 1
});

expect(getCrossedStations(campaign, 10, 12).map((item) => item.id)).toEqual([
  "cloud-garden",
  "star-observatory"
]);

expect(getCrossedStations(campaign, 12, 10).map((item) => item.id)).toEqual([
  "star-observatory",
  "cloud-garden"
]);
```

- [ ] **Step 2: Run the server rule test and verify RED**

Run:

```bash
cd server && npm test -- src/adventure/adventureRules.test.ts
```

Expected: FAIL because `AdventureStation.unlockAt` and `getCrossedStations` do not exist.

- [ ] **Step 3: Replace segment configuration with cumulative station definitions**

Use these server domain types:

```ts
export type AdventureReward = {
  xpEnabled: boolean;
  xp: number;
  badgeEnabled: boolean;
  badgeTitle: string | null;
  badgeImageKey: string | null;
  badgeIcon: string | null;
  badgeColor: string | null;
  storyEnabled: boolean;
  storyTitle: string | null;
  storyBody: string | null;
};

export type AdventureStation = {
  id: string;
  title: string;
  sortOrder: number;
  unlockAt: number;
  version: number;
  everUnlocked: boolean;
  reward: AdventureReward;
};

export type AdventureCampaign = {
  id: string;
  title: string;
  subtitle: string | null;
  version: number;
  stations: AdventureStation[];
};
```

Implement progress by finding the last station where `points >= unlockAt`. Use virtual start id `start` at threshold `0`. Implement crossing detection:

```ts
export function getCrossedStations(
  campaign: AdventureCampaign,
  beforePoints: number,
  afterPoints: number
): AdventureStation[] {
  if (afterPoints >= beforePoints) {
    return campaign.stations.filter(
      (station) => station.unlockAt > beforePoints && station.unlockAt <= afterPoints
    );
  }
  return campaign.stations
    .filter((station) => station.unlockAt <= beforePoints && station.unlockAt > afterPoints)
    .reverse();
}
```

- [ ] **Step 4: Mirror the dynamic types and rules on the client**

Update `src/adventure/types.ts` with the same public fields. Keep point transaction types unchanged. Update client rule tests to assert cumulative labels and collection thresholds come directly from `unlockAt`.

- [ ] **Step 5: Run client and server rule tests**

Run:

```bash
npm test -- src/adventure/adventureRules.test.ts
cd server && npm test -- src/adventure/adventureRules.test.ts
```

Expected: both files PASS, including the `+2` and `-2` multi-crossing cases.

- [ ] **Step 6: Optional checkpoint commit after user approval**

```bash
git add src/adventure server/src/adventure
git commit -m "refactor(adventure): 改用累计关卡门槛"
```

## Task 2: Campaign Schema and Default Migration

**Files:**
- Modify: `server/src/db/schema.ts`
- Create: `server/src/adventure/adventureCampaignRepository.ts`
- Create: `server/src/adventure/adventureCampaignRepository.test.ts`

- [ ] **Step 1: Write repository tests for default campaign creation**

Cover these facts with a mocked query client:

```ts
const campaign = await ensureAdventureCampaign(client, "space-1");

expect(campaign.id).toBe("star-coast");
expect(campaign.stations.map((station) => station.unlockAt)).toEqual([6, 14, 24]);
expect(campaign.stations.map((station) => station.id)).toEqual([
  "moonlight-tower",
  "crystal-bridge",
  "star-observatory"
]);
```

Also assert that an existing campaign with zero stations is not reseeded, while a space without a campaign is seeded exactly once.

- [ ] **Step 2: Run repository tests and verify RED**

```bash
cd server && npm test -- src/adventure/adventureCampaignRepository.test.ts
```

Expected: FAIL because the repository and tables do not exist.

- [ ] **Step 3: Add campaign and station tables**

Append to `SCHEMA_SQL`:

```sql
CREATE TABLE IF NOT EXISTS adventure_campaigns (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, id),
  UNIQUE (space_id)
);

CREATE TABLE IF NOT EXISTS adventure_stations (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  unlock_at INTEGER NOT NULL CHECK (unlock_at > 0),
  xp_enabled BOOLEAN NOT NULL DEFAULT false,
  xp_amount INTEGER NOT NULL DEFAULT 0 CHECK (xp_amount >= 0),
  badge_enabled BOOLEAN NOT NULL DEFAULT false,
  badge_title TEXT,
  badge_image_key TEXT,
  badge_icon TEXT,
  badge_color TEXT,
  story_enabled BOOLEAN NOT NULL DEFAULT false,
  story_title TEXT,
  story_body TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, id),
  FOREIGN KEY (space_id, campaign_id)
    REFERENCES adventure_campaigns(space_id, id) ON DELETE CASCADE,
  UNIQUE (space_id, campaign_id, sort_order),
  UNIQUE (space_id, campaign_id, unlock_at)
);
```

- [ ] **Step 4: Implement default seed data and row mapping**

Export:

```ts
export async function ensureAdventureCampaign(
  client: QueryClient,
  spaceId: string
): Promise<AdventureCampaign>;

export async function getAdventureCampaign(
  client: QueryClient,
  spaceId: string,
  options?: { forUpdate?: boolean }
): Promise<AdventureCampaign | null>;
```

Use one transaction-level campaign insert with `ON CONFLICT DO NOTHING`. Seed default stations only when the campaign insert returned a row. Join `adventure_station_rewards` with `EXISTS` so `everUnlocked` is true for active or reversed reward records.

- [ ] **Step 5: Preserve existing station ids and progress compatibility**

Default rows must use the existing ids and cumulative thresholds:

```ts
const DEFAULT_STATIONS = [
  { id: "moonlight-tower", title: "月光灯塔", sortOrder: 0, unlockAt: 6 },
  { id: "crystal-bridge", title: "水晶桥", sortOrder: 1, unlockAt: 14 },
  { id: "star-observatory", title: "观星台", sortOrder: 2, unlockAt: 24 }
] as const;
```

Do not rewrite `adventure_point_transactions`, `adventure_station_rewards`, or XP transactions.

- [ ] **Step 6: Run repository tests and server build**

```bash
cd server && npm test -- src/adventure/adventureCampaignRepository.test.ts
cd server && npm run build
```

Expected: repository tests PASS and TypeScript exits `0`.

- [ ] **Step 7: Optional checkpoint commit after user approval**

```bash
git add server/src/db/schema.ts server/src/adventure/adventureCampaignRepository.ts server/src/adventure/adventureCampaignRepository.test.ts
git commit -m "feat(adventure): 持久化动态关卡配置"
```

## Task 3: Owner-Only Station Management Rules

**Files:**
- Create: `server/src/adventure/adventureAdminService.ts`
- Create: `server/src/adventure/adventureAdminService.test.ts`
- Create: `server/src/adventure/adventureAdminRoutes.test.ts`
- Modify: `server/src/adventure/adventureRoutes.ts`
- Modify: `server/src/adventure/adventureCampaignRepository.ts`

- [ ] **Step 1: Write pure tests for station validation and lock rules**

Test these exact cases using explicit fixtures:

```ts
const validationContext = { previousUnlockAt: 24, nextUnlockAt: null, totalPoints: 18 };
const baseInput: AdventureStationWriteInput = {
  title: "云端花园",
  unlockAt: 30,
  xpEnabled: true,
  xp: 150,
  badgeEnabled: true,
  badgeTitle: "花园守望者",
  badgeImageKey: null,
  badgeIcon: "flower",
  badgeColor: "#E9507A",
  storyEnabled: false,
  storyTitle: null,
  storyBody: null,
  campaignVersion: 1
};
const unlockedStation: AdventureStation = {
  id: "cloud-garden",
  title: baseInput.title,
  sortOrder: 3,
  unlockAt: baseInput.unlockAt,
  version: 1,
  everUnlocked: true,
  reward: {
    xpEnabled: baseInput.xpEnabled,
    xp: baseInput.xp,
    badgeEnabled: baseInput.badgeEnabled,
    badgeTitle: baseInput.badgeTitle,
    badgeImageKey: baseInput.badgeImageKey,
    badgeIcon: baseInput.badgeIcon,
    badgeColor: baseInput.badgeColor,
    storyEnabled: baseInput.storyEnabled,
    storyTitle: baseInput.storyTitle,
    storyBody: baseInput.storyBody
  }
};

expect(validateStationInput(baseInput, validationContext)).toEqual(baseInput);

expect(() => validateStationInput({ ...baseInput, unlockAt: 24 }, validationContext))
  .toThrow("累计行动力必须高于上一关");

expect(() => assertUnlockedStationUpdateAllowed(unlockedStation, { ...unlockedStation, unlockAt: 31 }))
  .toThrow("已解锁关卡不能修改行动力门槛");

expect(() => assertUnlockedStationUpdateAllowed(unlockedStation, {
  ...unlockedStation,
  reward: { ...unlockedStation.reward, badgeImageKey: "adventure_badges/space-1/new.png" }
}))
  .not.toThrow();
```

Also cover XP toggle, reward enable toggles, delete and reorder as locked fields.

- [ ] **Step 2: Run service tests and verify RED**

```bash
cd server && npm test -- src/adventure/adventureAdminService.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement station input parsing and lock comparison**

Define the write input:

```ts
export type AdventureStationWriteInput = {
  title: string;
  unlockAt: number;
  xpEnabled: boolean;
  xp: number;
  badgeEnabled: boolean;
  badgeTitle: string | null;
  badgeImageKey: string | null;
  badgeIcon: string | null;
  badgeColor: string | null;
  storyEnabled: boolean;
  storyTitle: string | null;
  storyBody: string | null;
  campaignVersion: number;
};
```

Validation must enforce title length, positive integer threshold, `0 <= xp <= 1_000_000`, enabled reward fields, and at least one enabled reward.

- [ ] **Step 4: Implement transactional CRUD repository methods**

Add:

```ts
createAdventureStation(client, spaceId, input): Promise<AdventureStation>
updateAdventureStation(client, spaceId, stationId, input): Promise<AdventureStation>
deleteAdventureStation(client, spaceId, stationId, campaignVersion): Promise<void>
reorderAdventureStations(client, spaceId, orderedFutureIds, campaignVersion): Promise<AdventureCampaign>
```

Lock the campaign row with `FOR UPDATE`, compare `campaignVersion`, and return conflict errors that routes map to `409`. Reorder only the future suffix and exchange the sorted future `unlock_at` positions among submitted station ids.

- [ ] **Step 5: Write route tests for owner/member and conflicts**

Route tests must assert:

```text
GET    /api/adventure/campaign                  -> 200 for owner/member
POST   /api/adventure/stations                  -> 200 owner, 403 member
PUT    /api/adventure/stations/:stationId       -> 200 owner
DELETE /api/adventure/stations/:stationId       -> 204 future, 409 ever unlocked
POST   /api/adventure/stations/reorder           -> 200 future suffix, 409 stale version
```

- [ ] **Step 6: Implement management routes**

Check `request.role === "owner"` before all writes. Parse request bodies with Zod. Call `options.onChange?.(spaceId, "adventure")` after successful mutation.

- [ ] **Step 7: Run admin service and route tests**

```bash
cd server && npm test -- src/adventure/adventureAdminService.test.ts src/adventure/adventureAdminRoutes.test.ts
```

Expected: all management and permission cases PASS.

- [ ] **Step 8: Optional checkpoint commit after user approval**

```bash
git add server/src/adventure
git commit -m "feat(adventure): 添加关卡管理接口"
```

## Task 4: Dynamic Progress and Batch Reward Settlement

**Files:**
- Modify: `server/src/adventure/adventureActionService.ts`
- Modify: `server/src/adventure/adventureRoutes.ts`
- Modify: `server/src/adventure/adventureRules.ts`
- Modify: `server/src/adventure/adventureStationRoutes.test.ts`
- Modify: `server/src/adventure/adventureProgressRoutes.test.ts`
- Modify: `server/src/adventure/adventureIdempotencyRoutes.test.ts`

- [ ] **Step 1: Add action tests for crossing two adjacent stations**

Create a dynamic campaign with `unlockAt: 5` and `unlockAt: 6`. From `beforeTotal = 4`, a check-in plus all-done produces `afterTotal = 6`. Assert two station reward rows and both configured XP transactions are created once.

Add the inverse test from `6` to `4`, asserting both rewards and XP transactions are reversed in descending threshold order.

- [ ] **Step 2: Run station route tests and verify RED**

```bash
cd server && npm test -- src/adventure/adventureStationRoutes.test.ts
```

Expected: FAIL because the action service still imports `STAR_COAST_CAMPAIGN` and returns one reward.

- [ ] **Step 3: Load the campaign inside the existing database transaction**

At the start of award/revoke actions:

```ts
const campaign = await ensureAdventureCampaign(client, spaceId);
```

Pass this campaign to progress and crossing rules. Remove the server `STAR_COAST_CAMPAIGN` export.

- [ ] **Step 4: Batch claim and reverse station rewards**

Return arrays:

```ts
type AdventureActionResult = {
  insertedPoints: AdventurePointTransaction[];
  progress: AdventureProgressSnapshot;
  stationRewards: AdventureStationReward[];
  stationXp: AdventureXpTransaction[];
};
```

For award, iterate `getCrossedStations(campaign, beforeTotal, afterTotal)`. For revoke, use the descending result. Keep XP keys station-specific and source-specific.

- [ ] **Step 5: Make progress and campaign reads dynamic**

`GET /api/adventure/progress` ensures the campaign and recalculates the snapshot from current total points. `GET /api/adventure/campaign` returns the same campaign used by settlement.

- [ ] **Step 6: Run all server adventure tests**

```bash
cd server && npm test -- src/adventure
```

Expected: all adventure rule, repository, route, idempotency, batch award and batch revoke tests PASS.

- [ ] **Step 7: Optional checkpoint commit after user approval**

```bash
git add server/src/adventure
git commit -m "feat(adventure): 动态结算自定义关卡奖励"
```

## Task 5: Owner-Scoped Custom Badge Upload

**Files:**
- Modify: `server/src/r2/r2Client.ts`
- Modify: `server/src/uploads/uploadRoutes.ts`
- Create: `server/src/uploads/uploadRoutes.test.ts`
- Modify: `src/sync/uploadClient.ts`
- Modify: `src/sync/uploadClient.test.ts`

- [ ] **Step 1: Write upload route tests**

Cover:

```ts
expect(ownerRequest({ kind: "adventure_badge", contentType: "image/png", sizeBytes: 400_000 }).status)
  .toBe(200);
expect(memberRequest({ kind: "adventure_badge", contentType: "image/png", sizeBytes: 400_000 }).status)
  .toBe(403);
expect(ownerRequest({ kind: "adventure_badge", contentType: "image/svg+xml", sizeBytes: 400_000 }).status)
  .toBe(400);
expect(ownerRequest({ kind: "adventure_badge", contentType: "image/png", sizeBytes: 5_242_881 }).status)
  .toBe(400);
```

- [ ] **Step 2: Run upload tests and verify RED**

```bash
cd server && npm test -- src/uploads/uploadRoutes.test.ts
```

Expected: FAIL because `adventure_badge` and `sizeBytes` are not accepted.

- [ ] **Step 3: Extend upload types and R2 key generation**

Use:

```ts
export type UploadKind = "avatar" | "reward" | "adventure_badge";

const prefixByKind: Record<UploadKind, string> = {
  avatar: "avatars",
  reward: "rewards",
  adventure_badge: "adventure_badges"
};
```

For badges, scope is `request.spaceId`. Reject non-owner before calling `createPresignedUpload`.

- [ ] **Step 4: Validate size and key ownership**

Extend presign input with optional `sizeBytes`; require it for `adventure_badge`, enforce positive integer and `<= 5 * 1024 * 1024`. Export:

```ts
export function isAdventureBadgeKeyForSpace(key: string, spaceId: string): boolean {
  return key.startsWith(`adventure_badges/${spaceId}/`);
}
```

Use this check in station create/update before accepting `badgeImageKey`.

- [ ] **Step 5: Extend the client upload call**

Change the signature without breaking avatar/reward callers:

```ts
export async function uploadImage(
  kind: UploadKind,
  picked: PickedImage & { sizeBytes?: number }
): Promise<string>;
```

Send `sizeBytes` for `adventure_badge`.

- [ ] **Step 6: Run client/server upload tests**

```bash
npm test -- src/sync/uploadClient.test.ts
cd server && npm test -- src/uploads/uploadRoutes.test.ts
```

Expected: request shape, owner restriction, MIME and size cases PASS.

- [ ] **Step 7: Optional checkpoint commit after user approval**

```bash
git add src/sync server/src/r2 server/src/uploads server/src/adventure
git commit -m "feat(adventure): 支持上传自定义勋章"
```

## Task 6: Dynamic Campaign Client and Adventure Rendering

**Files:**
- Modify: `src/adventure/adventureClient.ts`
- Modify: `src/adventure/adventureClient.test.ts`
- Delete after migration: `src/adventure/adventureCampaign.ts`
- Modify: `app/(tabs)/adventure.tsx`
- Modify: `src/adventure/AdventureMap.tsx`
- Modify: `src/adventure/AdventureCollection.tsx`

- [ ] **Step 1: Add campaign client tests**

Assert:

```ts
await fetchAdventureCampaign();
expect(mocks.apiRequest).toHaveBeenCalledWith("/api/adventure/campaign");
```

Use a response fixture containing a custom fourth station and `badgeImageKey`.

- [ ] **Step 2: Run client tests and verify RED**

```bash
npm test -- src/adventure/adventureClient.test.ts
```

Expected: FAIL because `fetchAdventureCampaign` does not exist.

- [ ] **Step 3: Implement campaign API and dynamic screen load**

Load campaign, progress, rewards and habits together:

```ts
const [campaign, progress, rewards, habits] = await Promise.all([
  fetchAdventureCampaign(),
  fetchAdventureProgress(),
  fetchAdventureRewards(),
  listActiveHabits()
]);
```

Store campaign in state and pass it to all rules/components. Remove client imports of `STAR_COAST_CAMPAIGN`.

- [ ] **Step 4: Render custom badge images with fallback**

In `AdventureCollection`, resolve:

```ts
const badgeUri = publicUrl(item.badgeImageKey);
```

Use `expo-image` when a URI exists. On load failure or null key, render the configured Ionicon and color. Keep locked state visually distinct.

- [ ] **Step 5: Make map geometry support arbitrary station counts**

Keep the map path deterministic and automatically distribute station nodes by index. Add stable dimensions so 1, 4, 8 and 12 station campaigns do not overlap labels or avatars. Do not add coordinate editing.

- [ ] **Step 6: Delete the fixed client campaign only after all imports are removed**

Run:

```bash
rg -n "STAR_COAST_CAMPAIGN|adventureCampaign" src app
```

Expected: no runtime imports remain; tests use local fixtures. Then remove `src/adventure/adventureCampaign.ts`.

- [ ] **Step 7: Run client tests and type check**

```bash
npm test -- src/adventure
npx tsc --noEmit
```

Expected: dynamic campaign tests PASS and TypeScript exits `0`.

## Task 7: Badge Image Picker and Form Model

**Files:**
- Create: `src/adventure/adventureBadgeImage.ts`
- Create: `src/adventure/adventureBadgeImage.test.ts`
- Create: `src/adventure/adventureStationForm.ts`
- Create: `src/adventure/adventureStationForm.test.ts`
- Create: `src/adventure/AdventureBadgePicker.tsx`
- Create: `src/adventure/AdventureStationForm.tsx`

- [ ] **Step 1: Write pure form tests**

Define the form model in `src/adventure/adventureStationForm.ts`:

```ts
export type AdventureStationFormValue = {
  title: string;
  unlockAtText: string;
  xpEnabled: boolean;
  xpText: string;
  badgeEnabled: boolean;
  badgeTitle: string;
  badgeImageKey: string | null;
  badgeIcon: string;
  badgeColor: string;
  storyEnabled: boolean;
  storyTitle: string;
  storyBody: string;
};
```

Test valid and invalid values using a complete fixture:

```ts
const formContext = { previousUnlockAt: 24, nextUnlockAt: null };
const validForm: AdventureStationFormValue = {
  title: "云端花园",
  unlockAtText: "30",
  xpEnabled: true,
  xpText: "150",
  badgeEnabled: true,
  badgeTitle: "花园守望者",
  badgeImageKey: null,
  badgeIcon: "flower",
  badgeColor: "#E9507A",
  storyEnabled: false,
  storyTitle: "",
  storyBody: ""
};

expect(validateAdventureStationForm(validForm, formContext))
  .toMatchObject({ unlockAt: 30, badgeEnabled: true });

expect(() => validateAdventureStationForm({ ...validForm, unlockAtText: "24" }, formContext))
  .toThrow("累计行动力必须高于上一关");

expect(() => validateAdventureStationForm({
  ...validForm,
  xpEnabled: false,
  badgeEnabled: false,
  storyEnabled: false
}, formContext))
  .toThrow("至少选择一种关卡奖励");
```

- [ ] **Step 2: Write badge image result tests**

Extract pure validation helpers and assert JPEG/PNG/WebP are accepted, files over 5 MB are rejected, and the normalized picker result carries `sizeBytes`.

- [ ] **Step 3: Run tests and verify RED**

```bash
npm test -- src/adventure/adventureStationForm.test.ts src/adventure/adventureBadgeImage.test.ts
```

Expected: FAIL because form and image helpers do not exist.

- [ ] **Step 4: Implement the 1:1 badge picker**

Define the selected image value:

```ts
export type PickedBadgeImage = {
  uri: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
};
```

Use `expo-image-picker` with:

```ts
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1]
});
```

Resize to 768 px. Preserve PNG when the selected image is PNG; otherwise normalize to WebP or JPEG. Return local URI, MIME and byte size.

- [ ] **Step 5: Build `AdventureBadgePicker`**

The component must show upload, current local/remote preview, replace, remove and busy states. Props:

```ts
type AdventureBadgePickerProps = {
  previewUri: string | null;
  disabled?: boolean;
  onChange: (image: PickedBadgeImage | null) => void;
};
```

Use a square preview and display supported types/5 MB limit without adding instructional feature copy elsewhere in the page.

- [ ] **Step 6: Build reusable station form UI**

Use existing `AppText`, `AppButton`, `Card`, segmented controls, toggles and inputs. Locked stations disable threshold, XP and reward-enable controls while leaving title, badge presentation and letter content editable.

- [ ] **Step 7: Run form tests, type check and lint**

```bash
npm test -- src/adventure/adventureStationForm.test.ts src/adventure/adventureBadgeImage.test.ts
npx tsc --noEmit
npm run lint
```

Expected: tests/type-check PASS; lint has no new errors or warnings.

## Task 8: Owner Management Screens

**Files:**
- Create: `src/adventure/adventureAdminClient.ts`
- Create: `src/adventure/adventureAdminClient.test.ts`
- Create: `app/adventure/manage.tsx`
- Create: `app/adventure/station/[id].tsx`
- Modify: `app/(tabs)/adventure.tsx`

- [ ] **Step 1: Write admin API request tests**

Assert exact endpoints and methods for create, update, delete and reorder. Use `new` as the create route id on the client only; server-generated station ids are returned from POST.

- [ ] **Step 2: Run API tests and verify RED**

```bash
npm test -- src/adventure/adventureAdminClient.test.ts
```

Expected: FAIL because the admin client does not exist.

- [ ] **Step 3: Implement the admin client**

Export:

```ts
createAdventureStation(input)
updateAdventureStation(stationId, input)
deleteAdventureStation(stationId, campaignVersion)
reorderAdventureStations(orderedStationIds, campaignVersion)
```

- [ ] **Step 4: Build the owner-only management list**

Wrap the screen in `OwnerGate`. Show campaign summary, unlocked/future state, reward summary, edit buttons and “添加关卡”. Disable delete/reorder for `everUnlocked` rows.

- [ ] **Step 5: Build create/edit routing**

Use:

```text
/adventure/station/new
/adventure/station/:stationId
```

On save, validate locally, upload a newly selected badge image with `uploadImage("adventure_badge", picked)`, then submit the station DTO. Do not upload until the user presses Save.

- [ ] **Step 6: Add the owner management icon to the Adventure tab**

Read `getCurrentAccount()` during screen load. Show a `construct-outline` or `create-outline` icon only for owner and navigate to `/adventure/manage`.

- [ ] **Step 7: Handle stale versions and upload failures**

On `409`, reload campaign and preserve the current form values. On upload failure, keep the local preview and allow retry. On successful replacement, display the new public URL returned from the saved campaign.

- [ ] **Step 8: Run admin tests and full client checks**

```bash
npm test -- src/adventure
npx tsc --noEmit
npm run lint
```

Expected: all client adventure/admin tests PASS; no new lint findings.

## Task 9: Integration, Migration, and Runtime Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-10-custom-adventure-level-editor-design.md` only when runtime evidence proves a documented contract inaccurate.
- Modify: `docs/superpowers/plans/2026-07-10-custom-adventure-level-editor-plan.md` to record checkbox states and verification evidence.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm test
npx tsc --noEmit
npm run lint
cd server && npm test
cd server && npm run build
git diff --check
```

Expected:

- Client: all tests PASS.
- Client TypeScript: exit `0`.
- Lint: `0` errors and no new warnings; the existing unrelated `app/account.tsx` warning may remain.
- Server: all tests PASS and build exits `0`.
- Diff check: no whitespace errors.

- [ ] **Step 2: Rebuild the Docker backend and verify migration**

```bash
cd server && docker compose up -d --build app
curl -fsS http://127.0.0.1:8787/health
```

Expected: container healthy and response `{"ok":true}`.

- [ ] **Step 3: Smoke the default campaign migration**

Register a temporary owner account, call `GET /api/adventure/campaign`, and verify default ids and thresholds `6/14/24`. Confirm existing progress endpoint uses the same campaign id.

- [ ] **Step 4: Smoke owner/member management permissions**

Create a second account, join the owner space, and verify:

```text
owner POST /api/adventure/stations -> 200
member POST /api/adventure/stations -> 403
```

Delete both temporary accounts after verification.

- [ ] **Step 5: Smoke custom station and badge behavior**

Create “云端花园” at cumulative `30`, disable XP, enable badge and letter, upload a square badge image, and confirm:

```text
GET /api/adventure/campaign -> station badgeImageKey under adventure_badges/<spaceId>/
GET /api/adventure/progress -> next station reflects dynamic order
Adventure tab -> custom station appears
Journey Collection -> uploaded badge image appears after unlock
```

- [ ] **Step 6: Smoke locked field behavior**

Reach the new station, then verify badge replacement succeeds while threshold update, XP update and delete each return `409`. Confirm wallet XP is not duplicated.

- [ ] **Step 7: Visual QA on desktop and mobile widths**

Open `http://localhost:8082/adventure` and management routes. Check 390x844 and 1280x900 viewports for text overflow, map node overlap, image fallback, modal/form scroll, disabled states and owner-only controls.

- [ ] **Step 8: Final implementation record**

Update this plan with actual test counts, runtime smoke evidence and any known residual limitation. Do not claim completion without fresh command output.

## Execution Notes

- This feature changes PostgreSQL schema and shared adventure contracts; execution requires explicit user approval under the repository rules.
- Do not create commits unless the user separately approves git history changes. The checkpoint commit commands above are optional gates, not automatic actions.
- Keep the existing fixed campaign file until dynamic campaign reads are working and verified; remove it only in Task 6.
- Do not modify unrelated reward shop behavior or existing R2 object prefixes.

## Final Implementation Record — 2026-07-10

状态：所有非可选实现步骤均已完成；未创建 checkpoint commit，等待用户单独授权 Git 历史操作。

### 自动化验证

- Client tests：`28 files / 125 tests` 通过。
- Client TypeScript：`npx tsc --noEmit` 退出码 `0`。
- Client lint：`0 errors`；仅保留原有 `app/account.tsx` 未使用 `Divider` 警告。
- Server tests：`18 files / 81 tests` 通过。
- Server build：`npm run build` 退出码 `0`。
- Whitespace：`git diff --check` 退出码 `0`。

### Docker 与运行时证据

- 最新服务端源码已重建为 Docker 镜像 `sha256:a52f98005a28a9b3d0b38e364d29ab96d6dada530594474255ba002cbc4bd03c`。
- `GET http://127.0.0.1:8787/health` 返回 `{"ok":true}`。
- 默认关卡门槛为 `6 / 14 / 24`；自定义“云端花园”在累计 `30` 点解锁。
- member 写接口返回 `403`；已解锁后结构字段修改返回 `409`。
- 自定义勋章通过真实 R2 presigned PUT 上传，替换/移除路径完成旧对象清理验证。
- 奖励结算结果：累计行动力 `30`、4 个已领取关卡奖励、钱包余额 `300`，未重复发放 XP。

### 审查后补强

- 未解锁关卡门槛必须高于当前累计行动力，防止保存到已走过区间后漏发奖励。
- 编辑页关闭前后台和远端自动刷新，避免系统相册返回时清空未保存表单。
- `409` 后刷新最新 campaign，同时保留名称、勋章与来信等未提交展示内容。
- 勋章上传成功后缓存对象 key，保存重试不会重复上传同一张图片。
- 高分辨率源图先裁切压缩，5 MB 限制作用于最终上传文件。
- 深链打开管理页/新增页时提供安全返回路径，并隐藏 Expo Router 自动生成的英文双层标题。

### 视觉 QA

- iPhone 17 Pro 模拟器完成 `/adventure/manage` 与 `/adventure/station/new` 截图检查：无标题溢出、列表卡片重叠或表单横向截断；表单可纵向滚动。
- 截图中的蓝色齿轮为 Expo Go 开发菜单悬浮按钮，不属于产品 UI。
- 本轮浏览器运行面未提供可用实例，因此桌面路由仅完成 HTTP `200` 验证，未生成新的 1280×900 浏览器截图；移动端是当前交付主运行面。
