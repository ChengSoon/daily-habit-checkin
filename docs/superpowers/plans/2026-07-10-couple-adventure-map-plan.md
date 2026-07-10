# 双人冒险地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared couple adventure map that converts daily check-ins into action points, advances a fixed journey, and shows the progress in a new mobile tab.

**Architecture:** Build the feature in layers. Start with pure adventure rules and a fixed campaign config, then add server-side persistence/actions for idempotent shared progress, then connect the Expo client and render the Stitch-inspired adventure tab. Keep ordinary check-in XP separate from adventure points; station XP is an explicit extra reward.

**Tech Stack:** Expo Router, React Native, TypeScript, Vitest, Express 5, PostgreSQL, WebSocket invalidation, existing XP wallet routes.

## Implementation Status (2026-07-10)

- Completed pure client/server adventure rules and fixed Star Coast campaign.
- Completed PostgreSQL schema, point ledger, progress snapshot, station reward, and wallet XP transactions.
- Completed authenticated award, revoke, and progress routes with redo/revoke idempotency and WebSocket invalidation.
- Completed Today-screen integration with resilient warning handling.
- Completed Stitch-aligned Adventure tab and preserved Shop entry points from Today and Profile.
- Completed cross-day cumulative action points with cumulative unlock thresholds at 6 / 14 / 24 points and an unlocked-level count.
- Completed Journey Collection with badge states, delivered/locked letters, and full letter reading modal.
- Automated tests, client type-check, server build, and lint have been run successfully; lint retains one unrelated pre-existing warning in `app/account.tsx`.
- Completed a signed-in local Docker API smoke: three daily completions accumulated 2 -> 4 -> 6 action points, unlocked Moonlight Tower, returned the active station reward, and credited 80 XP. The temporary QA account was deleted afterward.
- Expo Web `/adventure` returns 200 on port 8082. Screenshot review remains pending because this environment has no controllable browser instance.

---

## File Structure

- Create `src/adventure/types.ts` for shared client-side adventure value types.
- Create `src/adventure/adventureCampaign.ts` for the V1 fixed “星河海岸” campaign.
- Create `src/adventure/adventureRules.ts` and `src/adventure/adventureRules.test.ts` for pure progress and transaction calculations.
- Create `server/src/adventure/adventureRules.ts` and `server/src/adventure/adventureRules.test.ts` for server-side pure calculations, mirroring the shared rules without importing client code.
- Modify `server/src/db/schema.ts` to create adventure tables.
- Create `server/src/adventure/adventureRepository.ts` for transaction/progress/reward persistence.
- Create `server/src/adventure/adventureRoutes.ts` and `server/src/adventure/adventureRoutes.test.ts` for `GET /api/adventure/progress`, award, and revoke actions.
- Modify `server/src/index.ts` to mount adventure routes behind auth.
- Create `src/adventure/adventureClient.ts` for client API calls.
- Modify `app/(tabs)/index.tsx` to call adventure award/revoke after check-in/undo.
- Create `app/(tabs)/adventure.tsx` for the new adventure tab screen.
- Modify `app/(tabs)/_layout.tsx` to replace the bottom “商城” tab with “冒险”.
- Modify `app/(tabs)/profile.tsx` only if needed to keep商城入口 visible from “我的”.

## Task 1: Pure Adventure Rules

**Files:**
- Create: `src/adventure/types.ts`
- Create: `src/adventure/adventureCampaign.ts`
- Create: `src/adventure/adventureRules.ts`
- Create: `src/adventure/adventureRules.test.ts`

- [x] **Step 1: Write failing rules tests**

Create `src/adventure/adventureRules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { STAR_COAST_CAMPAIGN } from "./adventureCampaign";
import {
  calculateAdventureProgress,
  calculateAdventurePointAwards,
  getNextStationReward,
  getStationSummary
} from "./adventureRules";

describe("adventure rules", () => {
  it("derives current and next station from total points", () => {
    expect(calculateAdventureProgress(STAR_COAST_CAMPAIGN, 0)).toMatchObject({
      currentStationId: "start",
      nextStationId: "moonlight-tower",
      segmentPoints: 0,
      pointsToNext: 6
    });

    expect(calculateAdventureProgress(STAR_COAST_CAMPAIGN, 4)).toMatchObject({
      currentStationId: "start",
      nextStationId: "moonlight-tower",
      segmentPoints: 4,
      pointsToNext: 2
    });

    expect(calculateAdventureProgress(STAR_COAST_CAMPAIGN, 6)).toMatchObject({
      currentStationId: "moonlight-tower",
      nextStationId: "crystal-bridge",
      segmentPoints: 0,
      pointsToNext: 8
    });
  });

  it("caps progress at the final station", () => {
    const progress = calculateAdventureProgress(STAR_COAST_CAMPAIGN, 999);

    expect(progress.currentStationId).toBe("star-observatory");
    expect(progress.nextStationId).toBeNull();
    expect(progress.pointsToNext).toBe(0);
    expect(progress.chapterIndexLabel).toBe("第 4 / 4 站");
  });

  it("detects newly reached station reward after point gain", () => {
    expect(getNextStationReward(STAR_COAST_CAMPAIGN, 5, 6)?.stationId).toBe("moonlight-tower");
    expect(getNextStationReward(STAR_COAST_CAMPAIGN, 6, 7)).toBeNull();
  });

  it("creates idempotent point awards for check-in and all-done", () => {
    expect(
      calculateAdventurePointAwards({
        habitId: "habit-1",
        dateKey: "2026-07-10",
        checkInId: "checkin-1",
        shouldAwardAllDone: true
      })
    ).toEqual([
      {
        uniqueKey: "adventure:checkin:habit-1:2026-07-10",
        amount: 1,
        reason: "checkin",
        habitId: "habit-1",
        checkInId: "checkin-1",
        dateKey: "2026-07-10"
      },
      {
        uniqueKey: "adventure:all_done:2026-07-10",
        amount: 1,
        reason: "all_done",
        habitId: null,
        checkInId: "checkin-1",
        dateKey: "2026-07-10"
      }
    ]);
  });

  it("summarizes current route for the mobile UI", () => {
    expect(getStationSummary(STAR_COAST_CAMPAIGN, 4)).toEqual({
      title: "去月光灯塔",
      subtitle: "累计行动力还差 2 点到下一站",
      actionPointLabel: "累计 4 点",
      chapterProgressLabel: "星河海岸 · 已解锁 0 / 3 关"
    });
  });
});
```

- [x] **Step 2: Verify RED**

Run:

```bash
npm test -- src/adventure/adventureRules.test.ts
```

Expected: fails because `src/adventure/*` modules do not exist.

- [x] **Step 3: Implement minimal types, campaign, and rules**

Create `src/adventure/types.ts`, `src/adventure/adventureCampaign.ts`, and `src/adventure/adventureRules.ts` with the smallest implementation that satisfies the tests. Use station ids `start`, `moonlight-tower`, `crystal-bridge`, `star-observatory`.

- [x] **Step 4: Verify GREEN**

Run:

```bash
npm test -- src/adventure/adventureRules.test.ts
```

Expected: all adventure rule tests pass.

## Task 2: Server Rule Mirror

**Files:**
- Create: `server/src/adventure/adventureRules.ts`
- Create: `server/src/adventure/adventureRules.test.ts`

- [x] **Step 1: Write failing server-side rules tests**

Use the same cases as Task 1, but import from `server/src/adventure/adventureRules.ts`. Keep the server copy independent so the server build does not depend on Expo app modules.

- [x] **Step 2: Run RED**

```bash
cd server && npm test -- src/adventure/adventureRules.test.ts
```

Expected: fails because server adventure modules do not exist.

- [x] **Step 3: Implement server rule mirror**

Duplicate only pure data/types/rules needed by the backend transaction flow. Do not import client `src/adventure/*`.

- [x] **Step 4: Run GREEN**

```bash
cd server && npm test -- src/adventure/adventureRules.test.ts
```

Expected: server adventure rules pass.

## Task 3: Server Schema and Repository

**Files:**
- Modify: `server/src/db/schema.ts`
- Create: `server/src/adventure/adventureRepository.ts`
- Create: `server/src/adventure/adventureRepository.test.ts`

- [x] **Step 1: Add repository tests for idempotent point insertion**

Test that inserting the same `uniqueKey` twice only counts once and that progress is recalculated from transaction totals.

- [x] **Step 2: Add tables**

Add `adventure_point_transactions`, `adventure_progress`, and `adventure_station_rewards` to the schema with `space_id` isolation and `UNIQUE(space_id, unique_key)`.

- [x] **Step 3: Implement repository**

Implement transaction helpers:

```ts
insertPointTransactions(client, spaceId, transactions)
getAdventureProgress(client, spaceId)
upsertAdventureProgress(client, spaceId, progress)
claimStationReward(client, spaceId, reward)
reverseStationReward(client, spaceId, stationId)
```

- [x] **Step 4: Run server repository tests**

```bash
cd server && npm test -- src/adventure/adventureRepository.test.ts
```

Expected: idempotency and progress persistence tests pass.

## Task 4: Server Adventure Routes

**Files:**
- Create: `server/src/adventure/adventureRoutes.ts`
- Create: `server/src/adventure/adventureRoutes.test.ts`
- Modify: `server/src/index.ts`
- Modify: `server/src/data/dataRoutes.ts` if adventure resources need generic list visibility.

- [x] **Step 1: Test award route behavior**

Cover:
- `POST /api/adventure/checkin-awards` inserts one check-in point.
- Repeating the same request is idempotent.
- Crossing `moonlight-tower` creates a station reward and XP transaction once.

- [x] **Step 2: Test revoke route behavior**

Cover:
- `POST /api/adventure/checkin-awards/revoke` inserts negative point transactions.
- Repeating revoke is idempotent.
- Falling back below a station reverses its XP reward.

- [x] **Step 3: Implement routes in one transaction**

Use existing auth middleware context (`request.spaceId`, `request.accountId`) and existing wallet transaction math for station XP.

- [x] **Step 4: Mount routes**

Mount under:

```text
/api/adventure
```

- [x] **Step 5: Run route tests**

```bash
cd server && npm test -- src/adventure/adventureRoutes.test.ts
```

Expected: route tests pass.

## Task 5: Client Adventure API

**Files:**
- Create: `src/adventure/adventureClient.ts`
- Create: `src/adventure/adventureClient.test.ts`

- [x] **Step 1: Test client request shapes**

Verify `awardAdventureForCheckIn`, `revokeAdventureForCheckIn`, and `fetchAdventureProgress` call the expected endpoints with the expected body.

- [x] **Step 2: Implement client**

Use existing `apiRequest` from `src/sync/apiClient.ts`.

- [x] **Step 3: Run client tests**

```bash
npm test -- src/adventure/adventureClient.test.ts
```

Expected: request shape tests pass.

## Task 6: Today Screen Integration

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify or create tests near existing UI/check-in tests if practical.

- [x] **Step 1: Add adventure calls after check-in/undo**

After `awardXpForCheckIn`, call `awardAdventureForCheckIn`. After `revokeXpForCheckIn`, call `revokeAdventureForCheckIn`.

- [x] **Step 2: Keep the check-in path resilient**

If adventure call fails, surface a lightweight error or allow reload retry. Do not mark check-in as failed after it was already saved.

- [x] **Step 3: Run existing check-in UI tests**

```bash
npm test -- src/ui/CheckButton.test.ts src/checkins/undoWindow.test.ts
```

Expected: existing check-in behavior remains stable.

## Task 7: Adventure Tab UI

**Files:**
- Create: `app/(tabs)/adventure.tsx`
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/(tabs)/profile.tsx` if商城 entry needs to stay prominent.

- [x] **Step 1: Replace bottom tab item**

Change tab order to:

```text
今日 / 冒险 / 习惯 / 我的
```

- [x] **Step 2: Build Stitch-aligned page**

Render:
- top bar with avatar/title/settings icon
- title section
- dreamy map card
- 累计行动力与下一关累计门槛 card
- 下一站奖励 card
- 旅程收藏（勋章册 / 来信阅读）
- 章节进度 card
- empty states for no login, no habits, no today tasks

- [x] **Step 3: Keep商城 reachable**

Verify Today XP card and Profile reward section still navigate to `/shop`.

- [x] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: TypeScript passes.

## Task 8: Final Verification

**Files:**
- All changed files.

- [x] **Step 1: Run focused client tests**

```bash
npm test -- src/adventure/adventureRules.test.ts src/adventure/adventureClient.test.ts
```

- [x] **Step 2: Run focused server tests**

```bash
cd server && npm test -- src/adventure/adventureRules.test.ts src/adventure/adventureRepository.test.ts src/adventure/adventureRoutes.test.ts
```

- [x] **Step 3: Run type checks**

```bash
npx tsc --noEmit
cd server && npm run build
```

- [x] **Step 4: Run lint**

```bash
npm run lint
```

- [x] **Step 5: Manual smoke**

> 2026-07-10：Expo Web 已成功 bundle，`/adventure` 路由返回 200。本机 Docker 后端真实 smoke 结果：跨 3 天完成打卡后累计行动力按 2 -> 4 -> 6 增长，在累计 6 点时抵达月光灯塔；`GET /api/adventure/rewards` 返回月光灯塔奖励，钱包增加 80 XP，临时 QA 账号随后已删除。当前会话没有可用浏览器控制实例，因此未生成自动化移动端截图。

Start the app and verify:
- 冒险 tab appears.
- Completing a habit increases action points.
- Undo reverses action points.
- Reaching 月光灯塔 shows reward state.
- 商城 remains reachable.
