# Couple Reward Shop XP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first XP wallet, reward shop, redemption flow, and hidden admin management mode for the couple reward feature.

**Architecture:** Keep the existing Expo app and SQLite-first structure. Add focused feature modules for XP, rewards, and admin settings; integrate them into existing check-in, profile, and navigation screens. XP is tracked through immutable transactions plus a wallet summary so reward spending and refunds remain auditable.

**Tech Stack:** Expo Router, React Native, TypeScript, expo-sqlite, Vitest, existing local repository pattern, existing UI primitives in `src/ui/Controls.tsx`.

---

## Scope Check

This is one cohesive feature, not separate products: XP is earned from existing check-ins, spent in a local shop, and managed through a hidden local admin mode. Do not introduce accounts, a backend, cloud sync, payment, or multi-user permissions in this implementation.

The confirmed design source is `docs/superpowers/specs/2026-07-06-couple-reward-shop-xp-design.md`.

## File Structure

Create:

- `src/xp/types.ts` - XP wallet, transaction, award result types.
- `src/xp/xpRules.ts` - deterministic XP award calculation.
- `src/xp/xpRules.test.ts` - unit tests for award rules.
- `src/xp/xpRepository.ts` - SQLite wallet and transaction persistence.
- `src/xp/xpRepository.test.ts` - repository tests for wallet, idempotency, spend, refund.
- `src/xp/xpService.ts` - check-in XP orchestration using habits, check-ins, plans, and rules.
- `src/xp/xpService.test.ts` - integration-style tests for check-in awards.
- `src/rewards/types.ts` - reward and redemption types.
- `src/rewards/rewardRepository.ts` - reward configuration and redemption persistence.
- `src/rewards/rewardService.ts` - redeem, fulfill, cancel, and default seed orchestration.
- `src/rewards/rewardService.test.ts` - reward business flow tests.
- `src/admin/adminSettingsRepository.ts` - local admin PIN hash and verification.
- `src/admin/adminSettingsRepository.test.ts` - admin PIN tests.
- `app/shop/index.tsx` - reward shop screen.
- `app/shop/redemptions.tsx` - user-facing redemption history screen.
- `app/admin/rewards.tsx` - hidden reward management screen.
- `app/admin/redemptions.tsx` - hidden fulfillment management screen.

Modify:

- `src/db/migrations.ts` - add XP, reward, redemption, and admin tables.
- `src/db/database.ts` - reset new tables in tests.
- `test/fakes/expo-sqlite.ts` - add fake behavior for new tables used by tests.
- `app/_layout.tsx` - register shop and admin stack screens.
- `app/(tabs)/index.tsx` - award XP after successful check-in and show XP feedback.
- `app/(tabs)/profile.tsx` - show XP balance, shop entries, and hidden admin PIN entry.
- `src/ui/Controls.tsx` - add only tiny reusable controls if a page needs them; prefer current primitives first.
- `src/export/exportData.ts` - include XP and reward data in export if current export already includes all app data.

Do not modify server files for this feature.

## Task 1: Add Local Database Tables And Test Fake Support

**Files:**
- Modify: `src/db/migrations.ts`
- Modify: `src/db/database.ts`
- Modify: `test/fakes/expo-sqlite.ts`

- [ ] **Step 1: Extend migrations**

Add these table definitions inside the existing `db.execAsync` migration block after `app_settings`:

```ts
CREATE TABLE IF NOT EXISTS xp_wallet (
  id TEXT PRIMARY KEY NOT NULL,
  balance INTEGER NOT NULL,
  lifetime_earned INTEGER NOT NULL,
  lifetime_spent INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  unique_key TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  habit_id TEXT,
  check_in_id TEXT,
  reward_id TEXT,
  redemption_id TEXT,
  date_key TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  price_xp INTEGER NOT NULL,
  status TEXT NOT NULL,
  virtual_kind TEXT NOT NULL,
  inventory_limit INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id TEXT PRIMARY KEY NOT NULL,
  reward_id TEXT NOT NULL,
  price_xp INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  fulfilled_at TEXT,
  cancelled_at TEXT,
  note TEXT,
  FOREIGN KEY(reward_id) REFERENCES rewards(id)
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
```

- [ ] **Step 2: Extend test reset**

Modify `resetDatabaseForTests()` in `src/db/database.ts` so it deletes new tables before old tables:

```ts
await db.execAsync(`
  DELETE FROM admin_settings;
  DELETE FROM reward_redemptions;
  DELETE FROM rewards;
  DELETE FROM xp_transactions;
  DELETE FROM xp_wallet;
  DELETE FROM app_settings;
  DELETE FROM reminder_settings;
  DELETE FROM habit_plans;
  DELETE FROM check_ins;
  DELETE FROM habits;
`);
```

- [ ] **Step 3: Extend fake row types**

Add these row types to `test/fakes/expo-sqlite.ts`:

```ts
type XpWalletRow = {
  id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string;
};

type XpTransactionRow = {
  id: string;
  unique_key: string;
  amount: number;
  type: "earn" | "spend" | "refund" | "adjust";
  reason:
    | "checkin"
    | "streak_3"
    | "streak_7"
    | "plan_complete"
    | "return_bonus"
    | "reward_redeem"
    | "redemption_cancel";
  habit_id: string | null;
  check_in_id: string | null;
  reward_id: string | null;
  redemption_id: string | null;
  date_key: string | null;
  created_at: string;
};

type RewardRow = {
  id: string;
  title: string;
  description: string | null;
  type: "virtual" | "real_world";
  price_xp: number;
  status: "active" | "archived";
  virtual_kind: "theme" | "celebration" | "title" | "badge" | "card_skin" | "none";
  inventory_limit: number | null;
  created_at: string;
  updated_at: string;
};

type RewardRedemptionRow = {
  id: string;
  reward_id: string;
  price_xp: number;
  status: "pending_fulfillment" | "fulfilled" | "cancelled";
  created_at: string;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  note: string | null;
};

type AdminSettingRow = {
  key: string;
  value: string;
};
```

- [ ] **Step 4: Add fake storage arrays**

Add these fields to `FakeSQLiteDatabase`:

```ts
private xpWallets: XpWalletRow[] = [];
private xpTransactions: XpTransactionRow[] = [];
private rewards: RewardRow[] = [];
private rewardRedemptions: RewardRedemptionRow[] = [];
private adminSettings: AdminSettingRow[] = [];
```

- [ ] **Step 5: Reset fake storage**

Update `execAsync` so reset clears new arrays when the reset SQL includes `DELETE FROM xp_wallet`:

```ts
if (sql.includes("DELETE FROM xp_wallet")) {
  this.xpWallets = [];
  this.xpTransactions = [];
  this.rewards = [];
  this.rewardRedemptions = [];
  this.adminSettings = [];
}
```

Keep the existing reset behavior for habits, check-ins, plans, and settings.

- [ ] **Step 6: Add fake SQL branches**

Add `runAsync`, `getAllAsync`, and `getFirstAsync` branches for the new SQL used in later tasks:

```ts
if (sql.includes("INSERT INTO xp_wallet")) {
  const row: XpWalletRow = {
    id: String(params[0]),
    balance: Number(params[1]),
    lifetime_earned: Number(params[2]),
    lifetime_spent: Number(params[3]),
    updated_at: String(params[4])
  };
  this.xpWallets = this.xpWallets.filter((wallet) => wallet.id !== row.id);
  this.xpWallets.push(row);
  return;
}

if (sql.includes("UPDATE xp_wallet SET")) {
  this.xpWallets = this.xpWallets.map((wallet) => {
    if (wallet.id !== params[4]) {
      return wallet;
    }
    return {
      ...wallet,
      balance: wallet.balance + Number(params[0]),
      lifetime_earned: wallet.lifetime_earned + Number(params[1]),
      lifetime_spent: wallet.lifetime_spent + Number(params[2]),
      updated_at: String(params[3])
    };
  });
  return;
}

if (sql.includes("INSERT INTO xp_transactions")) {
  if (this.xpTransactions.some((transaction) => transaction.unique_key === params[1])) {
    return;
  }
  this.xpTransactions.push({
    id: String(params[0]),
    unique_key: String(params[1]),
    amount: Number(params[2]),
    type: params[3] as XpTransactionRow["type"],
    reason: params[4] as XpTransactionRow["reason"],
    habit_id: params[5] === null ? null : String(params[5]),
    check_in_id: params[6] === null ? null : String(params[6]),
    reward_id: params[7] === null ? null : String(params[7]),
    redemption_id: params[8] === null ? null : String(params[8]),
    date_key: params[9] === null ? null : String(params[9]),
    created_at: String(params[10])
  });
  return;
}
```

Also add reward, redemption, and admin setting branches when implementing their repositories:

```ts
if (sql.includes("INSERT INTO rewards")) {
  const row: RewardRow = {
    id: String(params[0]),
    title: String(params[1]),
    description: params[2] === null ? null : String(params[2]),
    type: params[3] as RewardRow["type"],
    price_xp: Number(params[4]),
    status: params[5] as RewardRow["status"],
    virtual_kind: params[6] as RewardRow["virtual_kind"],
    inventory_limit: params[7] === null ? null : Number(params[7]),
    created_at: String(params[8]),
    updated_at: String(params[9])
  };
  this.rewards = this.rewards.filter((reward) => reward.id !== row.id);
  this.rewards.push(row);
  return;
}

if (sql.includes("UPDATE rewards SET")) {
  this.rewards = this.rewards.map((reward) => {
    if (reward.id !== params[8]) {
      return reward;
    }
    return {
      ...reward,
      title: String(params[0]),
      description: params[1] === null ? null : String(params[1]),
      type: params[2] as RewardRow["type"],
      price_xp: Number(params[3]),
      status: params[4] as RewardRow["status"],
      virtual_kind: params[5] as RewardRow["virtual_kind"],
      inventory_limit: params[6] === null ? null : Number(params[6]),
      updated_at: String(params[7])
    };
  });
  return;
}

if (sql.includes("INSERT INTO reward_redemptions")) {
  this.rewardRedemptions.push({
    id: String(params[0]),
    reward_id: String(params[1]),
    price_xp: Number(params[2]),
    status: params[3] as RewardRedemptionRow["status"],
    created_at: String(params[4]),
    fulfilled_at: params[5] === null ? null : String(params[5]),
    cancelled_at: params[6] === null ? null : String(params[6]),
    note: params[7] === null ? null : String(params[7])
  });
  return;
}

if (sql.includes("UPDATE reward_redemptions SET status = ?")) {
  this.rewardRedemptions = this.rewardRedemptions.map((redemption) => {
    if (redemption.id !== params[3]) {
      return redemption;
    }
    return {
      ...redemption,
      status: params[0] as RewardRedemptionRow["status"],
      fulfilled_at: params[1] === null ? null : String(params[1]),
      cancelled_at: params[2] === null ? null : String(params[2])
    };
  });
  return;
}

if (sql.includes("INSERT INTO admin_settings")) {
  const row = { key: String(params[0]), value: String(params[1]) };
  this.adminSettings = this.adminSettings.filter((setting) => setting.key !== row.key);
  this.adminSettings.push(row);
  return;
}
```

Add these read branches:

```ts
if (sql.includes("FROM xp_wallet WHERE id = ?")) {
  return (this.xpWallets.find((wallet) => wallet.id === params[0]) as T | undefined) ?? null;
}

if (sql.includes("FROM xp_transactions WHERE unique_key = ?")) {
  return (this.xpTransactions.find((transaction) => transaction.unique_key === params[0]) as T | undefined) ?? null;
}

if (sql.includes("FROM rewards WHERE id = ?")) {
  return (this.rewards.find((reward) => reward.id === params[0]) as T | undefined) ?? null;
}

if (sql.includes("FROM reward_redemptions WHERE id = ?")) {
  return (this.rewardRedemptions.find((redemption) => redemption.id === params[0]) as T | undefined) ?? null;
}

if (sql.includes("FROM admin_settings WHERE key = ?")) {
  return (this.adminSettings.find((setting) => setting.key === params[0]) as T | undefined) ?? null;
}
```

```ts
if (sql.includes("FROM xp_transactions")) {
  return [...this.xpTransactions].sort((left, right) => left.created_at.localeCompare(right.created_at)) as T[];
}

if (sql.includes("FROM rewards WHERE status = 'active'")) {
  return this.rewards.filter((reward) => reward.status === "active") as T[];
}

if (sql.includes("FROM rewards ORDER BY")) {
  return [...this.rewards].sort((left, right) => left.created_at.localeCompare(right.created_at)) as T[];
}

if (sql.includes("FROM reward_redemptions")) {
  return [...this.rewardRedemptions].sort((left, right) => right.created_at.localeCompare(left.created_at)) as T[];
}
```

- [ ] **Step 7: Run existing tests**

Run:

```bash
npm test
```

Expected: Existing tests pass or fail only because new repository tests have not been added yet. Do not proceed if existing habit, check-in, reminder, AI, or utility tests regress.

## Task 2: Add XP Types And Award Rules

**Files:**
- Create: `src/xp/types.ts`
- Create: `src/xp/xpRules.ts`
- Create: `src/xp/xpRules.test.ts`

- [ ] **Step 1: Write failing XP rules tests**

Create `src/xp/xpRules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateCheckInXpAwards } from "./xpRules";

describe("xp rules", () => {
  it("awards base check-in XP", () => {
    const awards = calculateCheckInXpAwards({
      habitId: "habit_1",
      dateKey: "2026-07-06",
      scheduledDates: ["2026-07-06"],
      completedDates: ["2026-07-06"],
      hasAnyEarlierCompletion: false,
      planCompleted: false
    });

    expect(awards).toEqual([
      { reason: "checkin", amount: 10, label: "完成打卡", uniqueKey: "checkin:habit_1:2026-07-06" }
    ]);
  });

  it("awards streak bonuses when the current streak reaches 3 or 7", () => {
    expect(
      calculateCheckInXpAwards({
        habitId: "habit_1",
        dateKey: "2026-07-03",
        scheduledDates: ["2026-07-01", "2026-07-02", "2026-07-03"],
        completedDates: ["2026-07-01", "2026-07-02", "2026-07-03"],
        hasAnyEarlierCompletion: true,
        planCompleted: false
      }).map((award) => award.reason)
    ).toEqual(["checkin", "streak_3"]);

    expect(
      calculateCheckInXpAwards({
        habitId: "habit_1",
        dateKey: "2026-07-07",
        scheduledDates: [
          "2026-07-01",
          "2026-07-02",
          "2026-07-03",
          "2026-07-04",
          "2026-07-05",
          "2026-07-06",
          "2026-07-07"
        ],
        completedDates: [
          "2026-07-01",
          "2026-07-02",
          "2026-07-03",
          "2026-07-04",
          "2026-07-05",
          "2026-07-06",
          "2026-07-07"
        ],
        hasAnyEarlierCompletion: true,
        planCompleted: false
      }).map((award) => award.reason)
    ).toEqual(["checkin", "streak_7"]);
  });

  it("awards return bonus after a missed scheduled day", () => {
    const awards = calculateCheckInXpAwards({
      habitId: "habit_1",
      dateKey: "2026-07-04",
      scheduledDates: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"],
      completedDates: ["2026-07-01", "2026-07-02", "2026-07-04"],
      hasAnyEarlierCompletion: true,
      planCompleted: false
    });

    expect(awards.map((award) => award.reason)).toEqual(["checkin", "return_bonus"]);
  });

  it("awards plan completion bonus once the plan is complete", () => {
    const awards = calculateCheckInXpAwards({
      habitId: "habit_1",
      dateKey: "2026-07-21",
      scheduledDates: ["2026-07-21"],
      completedDates: ["2026-07-21"],
      hasAnyEarlierCompletion: true,
      planCompleted: true
    });

    expect(awards.map((award) => award.reason)).toEqual(["checkin", "plan_complete"]);
  });
});
```

- [ ] **Step 2: Run rules tests to verify failure**

Run:

```bash
npm test -- src/xp/xpRules.test.ts
```

Expected: FAIL because `src/xp/xpRules.ts` does not exist.

- [ ] **Step 3: Add XP types**

Create `src/xp/types.ts`:

```ts
export type XpTransactionType = "earn" | "spend" | "refund" | "adjust";

export type XpReason =
  | "checkin"
  | "streak_3"
  | "streak_7"
  | "plan_complete"
  | "return_bonus"
  | "reward_redeem"
  | "redemption_cancel";

export type XpWallet = {
  id: "default";
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
};

export type XpTransaction = {
  id: string;
  uniqueKey: string;
  amount: number;
  type: XpTransactionType;
  reason: XpReason;
  habitId: string | null;
  checkInId: string | null;
  rewardId: string | null;
  redemptionId: string | null;
  dateKey: string | null;
  createdAt: string;
};

export type XpAward = {
  reason: Extract<XpReason, "checkin" | "streak_3" | "streak_7" | "plan_complete" | "return_bonus">;
  amount: number;
  label: string;
  uniqueKey: string;
};

export type XpAwardResult = {
  awards: XpAward[];
  insertedTransactions: XpTransaction[];
  wallet: XpWallet;
};
```

- [ ] **Step 4: Implement XP rules**

Create `src/xp/xpRules.ts`:

```ts
import { XpAward } from "./types";

type CheckInXpInput = {
  habitId: string;
  dateKey: string;
  scheduledDates: string[];
  completedDates: string[];
  hasAnyEarlierCompletion: boolean;
  planCompleted: boolean;
};

const AWARD_LABELS = {
  checkin: "完成打卡",
  streak_3: "连续 3 天",
  streak_7: "连续 7 天",
  plan_complete: "完成阶段计划",
  return_bonus: "回来就好"
} as const;

function currentStreak(dateKey: string, scheduledDates: string[], completedDates: Set<string>): number {
  const scheduled = scheduledDates.filter((date) => date <= dateKey).sort();
  let streak = 0;

  for (let index = scheduled.length - 1; index >= 0; index -= 1) {
    const date = scheduled[index];
    if (!completedDates.has(date)) {
      break;
    }
    streak += 1;
  }

  return streak;
}

function missedPreviousScheduledDay(dateKey: string, scheduledDates: string[], completedDates: Set<string>): boolean {
  const previousDates = scheduledDates.filter((date) => date < dateKey).sort();
  const previous = previousDates[previousDates.length - 1];

  return Boolean(previous && !completedDates.has(previous));
}

function award(
  habitId: string,
  dateKey: string,
  reason: XpAward["reason"],
  amount: number
): XpAward {
  return {
    reason,
    amount,
    label: AWARD_LABELS[reason],
    uniqueKey: `${reason}:${habitId}:${dateKey}`
  };
}

export function calculateCheckInXpAwards(input: CheckInXpInput): XpAward[] {
  const completedDates = new Set(input.completedDates);
  const awards: XpAward[] = [award(input.habitId, input.dateKey, "checkin", 10)];
  const streak = currentStreak(input.dateKey, input.scheduledDates, completedDates);

  if (streak === 3) {
    awards.push(award(input.habitId, input.dateKey, "streak_3", 20));
  }

  if (streak === 7) {
    awards.push(award(input.habitId, input.dateKey, "streak_7", 50));
  }

  if (
    input.hasAnyEarlierCompletion &&
    missedPreviousScheduledDay(input.dateKey, input.scheduledDates, completedDates)
  ) {
    awards.push(award(input.habitId, input.dateKey, "return_bonus", 15));
  }

  if (input.planCompleted) {
    awards.push(award(input.habitId, input.dateKey, "plan_complete", 100));
  }

  return awards;
}
```

- [ ] **Step 5: Run rules tests to verify pass**

Run:

```bash
npm test -- src/xp/xpRules.test.ts
```

Expected: PASS.

## Task 3: Add XP Repository

**Files:**
- Create: `src/xp/xpRepository.ts`
- Create: `src/xp/xpRepository.test.ts`
- Modify: `test/fakes/expo-sqlite.ts`

- [ ] **Step 1: Write failing repository tests**

Create `src/xp/xpRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { initializeDatabase, resetDatabaseForTests } from "../db/database";
import { applyXpTransactions, getWallet, listXpTransactions } from "./xpRepository";

describe("xp repository", () => {
  beforeEach(async () => {
    await initializeDatabase();
    await resetDatabaseForTests();
  });

  it("creates a default wallet on first read", async () => {
    const wallet = await getWallet();

    expect(wallet).toEqual({
      id: "default",
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      updatedAt: expect.any(String)
    });
  });

  it("applies earn transactions once by unique key", async () => {
    await applyXpTransactions([
      {
        uniqueKey: "checkin:habit_1:2026-07-06",
        amount: 10,
        type: "earn",
        reason: "checkin",
        habitId: "habit_1",
        checkInId: "checkin_1",
        rewardId: null,
        redemptionId: null,
        dateKey: "2026-07-06"
      }
    ]);
    await applyXpTransactions([
      {
        uniqueKey: "checkin:habit_1:2026-07-06",
        amount: 10,
        type: "earn",
        reason: "checkin",
        habitId: "habit_1",
        checkInId: "checkin_1",
        rewardId: null,
        redemptionId: null,
        dateKey: "2026-07-06"
      }
    ]);

    expect(await getWallet()).toMatchObject({ balance: 10, lifetimeEarned: 10, lifetimeSpent: 0 });
    expect(await listXpTransactions()).toHaveLength(1);
  });

  it("tracks spend and refund without counting refund as earned XP", async () => {
    await applyXpTransactions([
      {
        uniqueKey: "seed",
        amount: 100,
        type: "earn",
        reason: "checkin",
        habitId: null,
        checkInId: null,
        rewardId: null,
        redemptionId: null,
        dateKey: null
      },
      {
        uniqueKey: "spend:redemption_1",
        amount: -40,
        type: "spend",
        reason: "reward_redeem",
        habitId: null,
        checkInId: null,
        rewardId: "reward_1",
        redemptionId: "redemption_1",
        dateKey: null
      },
      {
        uniqueKey: "refund:redemption_1",
        amount: 40,
        type: "refund",
        reason: "redemption_cancel",
        habitId: null,
        checkInId: null,
        rewardId: "reward_1",
        redemptionId: "redemption_1",
        dateKey: null
      }
    ]);

    expect(await getWallet()).toMatchObject({ balance: 100, lifetimeEarned: 100, lifetimeSpent: 0 });
  });
});
```

- [ ] **Step 2: Run repository tests to verify failure**

Run:

```bash
npm test -- src/xp/xpRepository.test.ts
```

Expected: FAIL because `src/xp/xpRepository.ts` does not exist.

- [ ] **Step 3: Implement XP repository**

Create `src/xp/xpRepository.ts`:

```ts
import { getDatabase } from "../db/database";
import { createId } from "../utils/id";
import { XpReason, XpTransaction, XpTransactionType, XpWallet } from "./types";

const DEFAULT_WALLET_ID = "default";

type XpTransactionInput = {
  uniqueKey: string;
  amount: number;
  type: XpTransactionType;
  reason: XpReason;
  habitId: string | null;
  checkInId: string | null;
  rewardId: string | null;
  redemptionId: string | null;
  dateKey: string | null;
};

type XpWalletRow = {
  id: "default";
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string;
};

type XpTransactionRow = {
  id: string;
  unique_key: string;
  amount: number;
  type: XpTransactionType;
  reason: XpReason;
  habit_id: string | null;
  check_in_id: string | null;
  reward_id: string | null;
  redemption_id: string | null;
  date_key: string | null;
  created_at: string;
};

function mapWallet(row: XpWalletRow): XpWallet {
  return {
    id: row.id,
    balance: row.balance,
    lifetimeEarned: row.lifetime_earned,
    lifetimeSpent: row.lifetime_spent,
    updatedAt: row.updated_at
  };
}

function mapTransaction(row: XpTransactionRow): XpTransaction {
  return {
    id: row.id,
    uniqueKey: row.unique_key,
    amount: row.amount,
    type: row.type,
    reason: row.reason,
    habitId: row.habit_id,
    checkInId: row.check_in_id,
    rewardId: row.reward_id,
    redemptionId: row.redemption_id,
    dateKey: row.date_key,
    createdAt: row.created_at
  };
}

async function ensureWallet(): Promise<void> {
  const db = getDatabase();
  const existing = await db.getFirstAsync<XpWalletRow>("SELECT * FROM xp_wallet WHERE id = ?", [DEFAULT_WALLET_ID]);

  if (existing) {
    return;
  }

  await db.runAsync(
    `INSERT INTO xp_wallet (id, balance, lifetime_earned, lifetime_spent, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [DEFAULT_WALLET_ID, 0, 0, 0, new Date().toISOString()]
  );
}

function walletDeltas(input: XpTransactionInput): { earned: number; spent: number } {
  if (input.type === "earn") {
    return { earned: input.amount, spent: 0 };
  }
  if (input.type === "spend") {
    return { earned: 0, spent: Math.abs(input.amount) };
  }
  if (input.type === "refund") {
    return { earned: 0, spent: -Math.abs(input.amount) };
  }
  return { earned: Math.max(input.amount, 0), spent: Math.max(-input.amount, 0) };
}

export async function getWallet(): Promise<XpWallet> {
  const db = getDatabase();
  await ensureWallet();
  const row = await db.getFirstAsync<XpWalletRow>("SELECT * FROM xp_wallet WHERE id = ?", [DEFAULT_WALLET_ID]);

  if (!row) {
    throw new Error("XP 钱包初始化失败");
  }

  return mapWallet(row);
}

export async function listXpTransactions(): Promise<XpTransaction[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<XpTransactionRow>("SELECT * FROM xp_transactions ORDER BY created_at ASC");

  return rows.map(mapTransaction);
}

export async function applyXpTransactions(inputs: XpTransactionInput[]): Promise<XpTransaction[]> {
  const db = getDatabase();
  await ensureWallet();
  const inserted: XpTransaction[] = [];

  for (const input of inputs) {
    const existing = await db.getFirstAsync<XpTransactionRow>(
      "SELECT * FROM xp_transactions WHERE unique_key = ?",
      [input.uniqueKey]
    );

    if (existing) {
      continue;
    }

    const now = new Date().toISOString();
    const id = createId("xp");

    await db.runAsync(
      `INSERT INTO xp_transactions (
        id, unique_key, amount, type, reason, habit_id, check_in_id,
        reward_id, redemption_id, date_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.uniqueKey,
        input.amount,
        input.type,
        input.reason,
        input.habitId,
        input.checkInId,
        input.rewardId,
        input.redemptionId,
        input.dateKey,
        now
      ]
    );

    const deltas = walletDeltas(input);
    await db.runAsync(
      `UPDATE xp_wallet SET
        balance = balance + ?,
        lifetime_earned = lifetime_earned + ?,
        lifetime_spent = lifetime_spent + ?,
        updated_at = ?
      WHERE id = ?`,
      [input.amount, deltas.earned, deltas.spent, now, DEFAULT_WALLET_ID]
    );

    inserted.push({
      id,
      uniqueKey: input.uniqueKey,
      amount: input.amount,
      type: input.type,
      reason: input.reason,
      habitId: input.habitId,
      checkInId: input.checkInId,
      rewardId: input.rewardId,
      redemptionId: input.redemptionId,
      dateKey: input.dateKey,
      createdAt: now
    });
  }

  return inserted;
}
```

- [ ] **Step 4: Finish fake support required by XP repository**

Update `test/fakes/expo-sqlite.ts` so the fake SQL branches from Task 1 match the exact SQL strings in `xpRepository.ts`.

- [ ] **Step 5: Run repository tests**

Run:

```bash
npm test -- src/xp/xpRepository.test.ts
```

Expected: PASS.

## Task 4: Award XP From Check-Ins

**Files:**
- Create: `src/xp/xpService.ts`
- Create: `src/xp/xpService.test.ts`
- Modify: `test/fakes/expo-sqlite.ts` if the plan repository read branch needs adjustment.

- [ ] **Step 1: Write failing service tests**

Create `src/xp/xpService.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { completeCheckIn } from "../checkins/checkinRepository";
import { initializeDatabase, resetDatabaseForTests } from "../db/database";
import { createHabit } from "../habits/habitRepository";
import { getWallet, listXpTransactions } from "./xpRepository";
import { awardXpForCheckIn } from "./xpService";

describe("xp service", () => {
  beforeEach(async () => {
    await initializeDatabase();
    await resetDatabaseForTests();
  });

  it("awards XP once for a completed check-in", async () => {
    const habit = await createHabit({
      name: "阅读",
      description: null,
      frequency: { type: "daily" },
      reminderTime: null,
      isReminderEnabled: false,
      trackType: "check",
      numericUnit: null
    });
    await completeCheckIn({ habitId: habit.id, date: "2026-07-06", value: null, note: null });

    const first = await awardXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-06" });
    const second = await awardXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-06" });

    expect(first.awards.map((award) => award.reason)).toEqual(["checkin"]);
    expect(second.insertedTransactions).toHaveLength(0);
    expect(await getWallet()).toMatchObject({ balance: 10, lifetimeEarned: 10 });
    expect(await listXpTransactions()).toHaveLength(1);
  });

  it("awards a three-day streak bonus", async () => {
    const habit = await createHabit({
      name: "运动",
      description: null,
      frequency: { type: "daily" },
      reminderTime: null,
      isReminderEnabled: false,
      trackType: "check",
      numericUnit: null
    });

    for (const date of ["2026-07-01", "2026-07-02", "2026-07-03"]) {
      await completeCheckIn({ habitId: habit.id, date, value: null, note: null });
    }

    const result = await awardXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-03" });

    expect(result.awards.map((award) => award.reason)).toEqual(["checkin", "streak_3"]);
    expect(await getWallet()).toMatchObject({ balance: 30, lifetimeEarned: 30 });
  });
});
```

- [ ] **Step 2: Run service tests to verify failure**

Run:

```bash
npm test -- src/xp/xpService.test.ts
```

Expected: FAIL because `src/xp/xpService.ts` does not exist.

- [ ] **Step 3: Implement check-in XP service**

Create `src/xp/xpService.ts`:

```ts
import { getPlanForHabit } from "../ai/habitPlanRepository";
import { listCheckInsForHabit } from "../checkins/checkinRepository";
import { getHabitById } from "../habits/habitRepository";
import { shouldRunOnDate } from "../habits/habitRules";
import { eachDateKey } from "../utils/date";
import { XpAwardResult } from "./types";
import { applyXpTransactions, getWallet } from "./xpRepository";
import { calculateCheckInXpAwards } from "./xpRules";

export async function awardXpForCheckIn(input: {
  habitId: string;
  dateKey: string;
  checkInId?: string | null;
}): Promise<XpAwardResult> {
  const habit = await getHabitById(input.habitId);

  if (!habit) {
    throw new Error("习惯不存在，无法发放 XP");
  }

  const checkIns = await listCheckInsForHabit(input.habitId);
  const completedDates = checkIns
    .filter((checkIn) => checkIn.status === "completed")
    .map((checkIn) => checkIn.date);
  const habitStart = habit.createdAt.slice(0, 10);
  const scheduledDates = eachDateKey(habitStart, input.dateKey).filter((date) =>
    shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`))
  );
  const plan = await getPlanForHabit(input.habitId);
  const planCompleted = Boolean(plan && input.dateKey >= plan.endDate);
  const hasAnyEarlierCompletion = completedDates.some((date) => date < input.dateKey);
  const awards = calculateCheckInXpAwards({
    habitId: input.habitId,
    dateKey: input.dateKey,
    scheduledDates,
    completedDates,
    hasAnyEarlierCompletion,
    planCompleted
  });

  const insertedTransactions = await applyXpTransactions(
    awards.map((award) => ({
      uniqueKey: award.reason === "plan_complete" && plan
        ? `plan_complete:${plan.id}`
        : award.uniqueKey,
      amount: award.amount,
      type: "earn",
      reason: award.reason,
      habitId: input.habitId,
      checkInId: input.checkInId ?? null,
      rewardId: null,
      redemptionId: null,
      dateKey: input.dateKey
    }))
  );

  return {
    awards,
    insertedTransactions,
    wallet: await getWallet()
  };
}
```

- [ ] **Step 4: Run XP tests**

Run:

```bash
npm test -- src/xp/xpRules.test.ts src/xp/xpRepository.test.ts src/xp/xpService.test.ts
```

Expected: PASS.

## Task 5: Add Reward Repository And Redemption Service

**Files:**
- Create: `src/rewards/types.ts`
- Create: `src/rewards/rewardRepository.ts`
- Create: `src/rewards/rewardService.ts`
- Create: `src/rewards/rewardService.test.ts`
- Modify: `test/fakes/expo-sqlite.ts`

- [ ] **Step 1: Write failing reward service tests**

Create `src/rewards/rewardService.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { initializeDatabase, resetDatabaseForTests } from "../db/database";
import { applyXpTransactions, getWallet } from "../xp/xpRepository";
import { createReward, getRewardById, listRewards } from "./rewardRepository";
import { cancelRedemption, fulfillRedemption, redeemReward } from "./rewardService";

describe("reward service", () => {
  beforeEach(async () => {
    await initializeDatabase();
    await resetDatabaseForTests();
  });

  it("redeems a real-world reward as pending fulfillment", async () => {
    await applyXpTransactions([
      {
        uniqueKey: "seed",
        amount: 500,
        type: "earn",
        reason: "checkin",
        habitId: null,
        checkInId: null,
        rewardId: null,
        redemptionId: null,
        dateKey: null
      }
    ]);
    const reward = await createReward({
      title: "奶茶一杯",
      description: "周末兑现",
      type: "real_world",
      priceXp: 300,
      status: "active",
      virtualKind: "none",
      inventoryLimit: null
    });

    const redemption = await redeemReward(reward.id);

    expect(redemption).toMatchObject({ rewardId: reward.id, priceXp: 300, status: "pending_fulfillment" });
    expect(await getWallet()).toMatchObject({ balance: 200, lifetimeSpent: 300 });
  });

  it("redeems a virtual reward as fulfilled", async () => {
    await applyXpTransactions([
      {
        uniqueKey: "seed",
        amount: 500,
        type: "earn",
        reason: "checkin",
        habitId: null,
        checkInId: null,
        rewardId: null,
        redemptionId: null,
        dateKey: null
      }
    ]);
    const reward = await createReward({
      title: "粉色主题",
      description: "解锁新的主题色",
      type: "virtual",
      priceXp: 100,
      status: "active",
      virtualKind: "theme",
      inventoryLimit: null
    });

    const redemption = await redeemReward(reward.id);

    expect(redemption.status).toBe("fulfilled");
  });

  it("blocks redemption when XP is insufficient", async () => {
    const reward = await createReward({
      title: "约会基金",
      description: null,
      type: "real_world",
      priceXp: 1000,
      status: "active",
      virtualKind: "none",
      inventoryLimit: null
    });

    await expect(redeemReward(reward.id)).rejects.toThrow("XP 不足，还差 1000 XP");
  });

  it("fulfills and cancels pending redemptions", async () => {
    await applyXpTransactions([
      {
        uniqueKey: "seed",
        amount: 500,
        type: "earn",
        reason: "checkin",
        habitId: null,
        checkInId: null,
        rewardId: null,
        redemptionId: null,
        dateKey: null
      }
    ]);
    const reward = await createReward({
      title: "电影夜",
      description: null,
      type: "real_world",
      priceXp: 200,
      status: "active",
      virtualKind: "none",
      inventoryLimit: null
    });
    const first = await redeemReward(reward.id);
    const fulfilled = await fulfillRedemption(first.id);
    expect(fulfilled.status).toBe("fulfilled");
    await expect(cancelRedemption(first.id)).rejects.toThrow("已兑现的奖励不能取消");

    const second = await redeemReward(reward.id);
    const cancelled = await cancelRedemption(second.id);
    expect(cancelled.status).toBe("cancelled");
    expect(await getWallet()).toMatchObject({ balance: 300, lifetimeSpent: 200 });
  });

  it("lists active and archived rewards", async () => {
    const reward = await createReward({
      title: "称号",
      description: null,
      type: "virtual",
      priceXp: 100,
      status: "active",
      virtualKind: "title",
      inventoryLimit: null
    });

    expect((await listRewards({ includeArchived: false })).map((item) => item.id)).toEqual([reward.id]);
    expect(await getRewardById(reward.id)).toMatchObject({ title: "称号" });
  });
});
```

- [ ] **Step 2: Run reward tests to verify failure**

Run:

```bash
npm test -- src/rewards/rewardService.test.ts
```

Expected: FAIL because reward modules do not exist.

- [ ] **Step 3: Add reward types**

Create `src/rewards/types.ts`:

```ts
export type RewardType = "virtual" | "real_world";
export type RewardStatus = "active" | "archived";
export type VirtualRewardKind = "theme" | "celebration" | "title" | "badge" | "card_skin" | "none";
export type RedemptionStatus = "pending_fulfillment" | "fulfilled" | "cancelled";

export type Reward = {
  id: string;
  title: string;
  description: string | null;
  type: RewardType;
  priceXp: number;
  status: RewardStatus;
  virtualKind: VirtualRewardKind;
  inventoryLimit: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RewardRedemption = {
  id: string;
  rewardId: string;
  priceXp: number;
  status: RedemptionStatus;
  createdAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  note: string | null;
};

export type CreateRewardInput = {
  title: string;
  description: string | null;
  type: RewardType;
  priceXp: number;
  status: RewardStatus;
  virtualKind: VirtualRewardKind;
  inventoryLimit: number | null;
};
```

- [ ] **Step 4: Implement reward repository**

Create `src/rewards/rewardRepository.ts`:

```ts
import { getDatabase } from "../db/database";
import { createId } from "../utils/id";
import { CreateRewardInput, RedemptionStatus, Reward, RewardRedemption } from "./types";

type RewardRow = {
  id: string;
  title: string;
  description: string | null;
  type: Reward["type"];
  price_xp: number;
  status: Reward["status"];
  virtual_kind: Reward["virtualKind"];
  inventory_limit: number | null;
  created_at: string;
  updated_at: string;
};

type RewardRedemptionRow = {
  id: string;
  reward_id: string;
  price_xp: number;
  status: RedemptionStatus;
  created_at: string;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  note: string | null;
};

function mapReward(row: RewardRow): Reward {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    priceXp: row.price_xp,
    status: row.status,
    virtualKind: row.virtual_kind,
    inventoryLimit: row.inventory_limit,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRedemption(row: RewardRedemptionRow): RewardRedemption {
  return {
    id: row.id,
    rewardId: row.reward_id,
    priceXp: row.price_xp,
    status: row.status,
    createdAt: row.created_at,
    fulfilledAt: row.fulfilled_at,
    cancelledAt: row.cancelled_at,
    note: row.note
  };
}

export async function createReward(input: CreateRewardInput): Promise<Reward> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const reward: Reward = {
    id: createId("reward"),
    title: input.title,
    description: input.description,
    type: input.type,
    priceXp: input.priceXp,
    status: input.status,
    virtualKind: input.virtualKind,
    inventoryLimit: input.inventoryLimit,
    createdAt: now,
    updatedAt: now
  };

  await db.runAsync(
    `INSERT INTO rewards (
      id, title, description, type, price_xp, status, virtual_kind,
      inventory_limit, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reward.id,
      reward.title,
      reward.description,
      reward.type,
      reward.priceXp,
      reward.status,
      reward.virtualKind,
      reward.inventoryLimit,
      reward.createdAt,
      reward.updatedAt
    ]
  );

  return reward;
}

export async function updateReward(id: string, input: CreateRewardInput): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    `UPDATE rewards SET
      title = ?,
      description = ?,
      type = ?,
      price_xp = ?,
      status = ?,
      virtual_kind = ?,
      inventory_limit = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      input.title,
      input.description,
      input.type,
      input.priceXp,
      input.status,
      input.virtualKind,
      input.inventoryLimit,
      new Date().toISOString(),
      id
    ]
  );
}

export async function listRewards(input: { includeArchived: boolean }): Promise<Reward[]> {
  const db = getDatabase();
  const rows = input.includeArchived
    ? await db.getAllAsync<RewardRow>("SELECT * FROM rewards ORDER BY created_at ASC")
    : await db.getAllAsync<RewardRow>("SELECT * FROM rewards WHERE status = 'active' ORDER BY created_at ASC");

  return rows.map(mapReward);
}

export async function getRewardById(id: string): Promise<Reward | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<RewardRow>("SELECT * FROM rewards WHERE id = ?", [id]);

  return row ? mapReward(row) : null;
}

export async function createRedemption(input: {
  rewardId: string;
  priceXp: number;
  status: RedemptionStatus;
  note: string | null;
}): Promise<RewardRedemption> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const redemption: RewardRedemption = {
    id: createId("redemption"),
    rewardId: input.rewardId,
    priceXp: input.priceXp,
    status: input.status,
    createdAt: now,
    fulfilledAt: input.status === "fulfilled" ? now : null,
    cancelledAt: null,
    note: input.note
  };

  await db.runAsync(
    `INSERT INTO reward_redemptions (
      id, reward_id, price_xp, status, created_at, fulfilled_at, cancelled_at, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      redemption.id,
      redemption.rewardId,
      redemption.priceXp,
      redemption.status,
      redemption.createdAt,
      redemption.fulfilledAt,
      redemption.cancelledAt,
      redemption.note
    ]
  );

  return redemption;
}

export async function updateRedemptionStatus(
  id: string,
  status: RedemptionStatus
): Promise<RewardRedemption | null> {
  const db = getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE reward_redemptions SET status = ?, fulfilled_at = ?, cancelled_at = ? WHERE id = ?`,
    [status, status === "fulfilled" ? now : null, status === "cancelled" ? now : null, id]
  );

  return getRedemptionById(id);
}

export async function getRedemptionById(id: string): Promise<RewardRedemption | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<RewardRedemptionRow>("SELECT * FROM reward_redemptions WHERE id = ?", [id]);

  return row ? mapRedemption(row) : null;
}

export async function listRedemptions(): Promise<RewardRedemption[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<RewardRedemptionRow>(
    "SELECT * FROM reward_redemptions ORDER BY created_at DESC"
  );

  return rows.map(mapRedemption);
}
```

- [ ] **Step 5: Implement reward service**

Create `src/rewards/rewardService.ts`:

```ts
import { applyXpTransactions, getWallet } from "../xp/xpRepository";
import {
  createRedemption,
  createReward,
  getRedemptionById,
  getRewardById,
  listRewards,
  updateRedemptionStatus
} from "./rewardRepository";
import { CreateRewardInput, RewardRedemption } from "./types";

export const DEFAULT_REWARDS: CreateRewardInput[] = [
  {
    title: "粉色主题",
    description: "解锁一套更甜一点的界面主题",
    type: "virtual",
    priceXp: 100,
    status: "active",
    virtualKind: "theme",
    inventoryLimit: null
  },
  {
    title: "专属称号",
    description: "解锁一个阶段称号",
    type: "virtual",
    priceXp: 200,
    status: "active",
    virtualKind: "title",
    inventoryLimit: null
  },
  {
    title: "奶茶一杯",
    description: "兑换后等待兑现",
    type: "real_world",
    priceXp: 300,
    status: "active",
    virtualKind: "none",
    inventoryLimit: null
  }
];

export async function ensureDefaultRewards(): Promise<void> {
  const existing = await listRewards({ includeArchived: true });

  if (existing.length > 0) {
    return;
  }

  for (const reward of DEFAULT_REWARDS) {
    await createReward(reward);
  }
}

export async function redeemReward(rewardId: string): Promise<RewardRedemption> {
  const reward = await getRewardById(rewardId);

  if (!reward || reward.status !== "active") {
    throw new Error("奖励不可兑换");
  }

  const wallet = await getWallet();
  const missing = reward.priceXp - wallet.balance;

  if (missing > 0) {
    throw new Error(`XP 不足，还差 ${missing} XP`);
  }

  const redemption = await createRedemption({
    rewardId: reward.id,
    priceXp: reward.priceXp,
    status: reward.type === "virtual" ? "fulfilled" : "pending_fulfillment",
    note: null
  });

  await applyXpTransactions([
    {
      uniqueKey: `reward_redeem:${redemption.id}`,
      amount: -reward.priceXp,
      type: "spend",
      reason: "reward_redeem",
      habitId: null,
      checkInId: null,
      rewardId: reward.id,
      redemptionId: redemption.id,
      dateKey: null
    }
  ]);

  return redemption;
}

export async function fulfillRedemption(id: string): Promise<RewardRedemption> {
  const redemption = await getRedemptionById(id);

  if (!redemption) {
    throw new Error("兑换记录不存在");
  }
  if (redemption.status === "cancelled") {
    throw new Error("已取消的奖励不能兑现");
  }

  const updated = await updateRedemptionStatus(id, "fulfilled");
  if (!updated) {
    throw new Error("兑现失败");
  }
  return updated;
}

export async function cancelRedemption(id: string): Promise<RewardRedemption> {
  const redemption = await getRedemptionById(id);

  if (!redemption) {
    throw new Error("兑换记录不存在");
  }
  if (redemption.status === "fulfilled") {
    throw new Error("已兑现的奖励不能取消");
  }
  if (redemption.status === "cancelled") {
    return redemption;
  }

  const updated = await updateRedemptionStatus(id, "cancelled");
  if (!updated) {
    throw new Error("取消失败");
  }

  await applyXpTransactions([
    {
      uniqueKey: `redemption_cancel:${redemption.id}`,
      amount: redemption.priceXp,
      type: "refund",
      reason: "redemption_cancel",
      habitId: null,
      checkInId: null,
      rewardId: redemption.rewardId,
      redemptionId: redemption.id,
      dateKey: null
    }
  ]);

  return updated;
}
```

- [ ] **Step 6: Finish fake support required by reward modules**

Update `test/fakes/expo-sqlite.ts` so all fake SQL branches from Task 1 match the exact SQL strings in `rewardRepository.ts`.

- [ ] **Step 7: Run reward tests**

Run:

```bash
npm test -- src/rewards/rewardService.test.ts
```

Expected: PASS.

## Task 6: Add Hidden Admin PIN Repository

**Files:**
- Create: `src/admin/adminSettingsRepository.ts`
- Create: `src/admin/adminSettingsRepository.test.ts`
- Modify: `test/fakes/expo-sqlite.ts`

- [ ] **Step 1: Write failing admin tests**

Create `src/admin/adminSettingsRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { initializeDatabase, resetDatabaseForTests } from "../db/database";
import { hasAdminPin, setAdminPin, verifyAdminPin } from "./adminSettingsRepository";

describe("admin settings repository", () => {
  beforeEach(async () => {
    await initializeDatabase();
    await resetDatabaseForTests();
  });

  it("sets and verifies the admin PIN without storing it as plain text", async () => {
    expect(await hasAdminPin()).toBe(false);

    await setAdminPin("1314");

    expect(await hasAdminPin()).toBe(true);
    expect(await verifyAdminPin("1314")).toBe(true);
    expect(await verifyAdminPin("0000")).toBe(false);
  });
});
```

- [ ] **Step 2: Run admin tests to verify failure**

Run:

```bash
npm test -- src/admin/adminSettingsRepository.test.ts
```

Expected: FAIL because `src/admin/adminSettingsRepository.ts` does not exist.

- [ ] **Step 3: Implement admin settings repository**

Create `src/admin/adminSettingsRepository.ts`:

```ts
import { getDatabase } from "../db/database";

const ADMIN_PIN_KEY = "admin_pin_hash";
const ADMIN_PIN_SALT = "couple-reward-shop-v1";

type AdminSettingRow = {
  key: string;
  value: string;
};

function hashPin(pin: string): string {
  let hash = 2166136261;
  const value = `${ADMIN_PIN_SALT}:${pin}`;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a:${(hash >>> 0).toString(16)}`;
}

async function getSetting(key: string): Promise<string | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<AdminSettingRow>("SELECT * FROM admin_settings WHERE key = ?", [key]);

  return row?.value ?? null;
}

async function saveSetting(key: string, value: string): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    "INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function hasAdminPin(): Promise<boolean> {
  return (await getSetting(ADMIN_PIN_KEY)) !== null;
}

export async function setAdminPin(pin: string): Promise<void> {
  if (pin.trim().length < 4) {
    throw new Error("管理 PIN 至少需要 4 位");
  }

  await saveSetting(ADMIN_PIN_KEY, hashPin(pin));
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const stored = await getSetting(ADMIN_PIN_KEY);

  return stored !== null && stored === hashPin(pin);
}
```

- [ ] **Step 4: Finish fake support required by admin repository**

Update `test/fakes/expo-sqlite.ts` so `INSERT INTO admin_settings` and `SELECT * FROM admin_settings WHERE key = ?` work exactly as used above.

- [ ] **Step 5: Run admin tests**

Run:

```bash
npm test -- src/admin/adminSettingsRepository.test.ts
```

Expected: PASS.

## Task 7: Integrate XP Feedback Into Today And Profile

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/_layout.tsx`
- Create later tasks depend on: `app/shop/index.tsx`, `app/shop/redemptions.tsx`, `app/admin/rewards.tsx`, `app/admin/redemptions.tsx`

- [ ] **Step 1: Register new routes**

Modify `app/_layout.tsx` inside `<Stack>`:

```tsx
<Stack.Screen name="shop/index" options={{ title: "奖励商城" }} />
<Stack.Screen name="shop/redemptions" options={{ title: "兑换记录" }} />
<Stack.Screen name="admin/rewards" options={{ title: "奖励管理" }} />
<Stack.Screen name="admin/redemptions" options={{ title: "兑现管理" }} />
```

- [ ] **Step 2: Add XP state and loading to Today screen**

In `app/(tabs)/index.tsx`, import:

```tsx
import { getWallet } from "../../src/xp/xpRepository";
import { awardXpForCheckIn } from "../../src/xp/xpService";
import { XpAwardResult } from "../../src/xp/types";
```

Add state:

```tsx
const [xpBalance, setXpBalance] = useState(0);
const [lastXpResult, setLastXpResult] = useState<XpAwardResult | null>(null);
```

Inside `load()`, after settings load:

```tsx
const wallet = await getWallet();
setXpBalance(wallet.balance);
```

- [ ] **Step 3: Award XP when completing a habit**

Replace the body of `complete()` in `app/(tabs)/index.tsx` with this flow:

```tsx
async function complete(habit: Habit, value: number | null, shouldCelebrate = false) {
  if (shouldCelebrate) {
    showCelebration(habit.name);
  }

  const checkIn = await completeCheckIn({ habitId: habit.id, date: today, value, note: null });
  const xpResult = await awardXpForCheckIn({ habitId: habit.id, dateKey: today, checkInId: checkIn.id });

  setLastXpResult(xpResult);
  setXpBalance(xpResult.wallet.balance);
  setNumericHabit(null);
  setNumericValue("");
  await load();
}
```

- [ ] **Step 4: Show XP feedback on Today screen**

Add this card after `<ProgressHeader />`:

```tsx
<Card tone="tint">
  <AppText variant="caption" tone="primary">
    XP 余额
  </AppText>
  <AppText variant="title" tone="primary">
    {xpBalance} XP
  </AppText>
  {lastXpResult && lastXpResult.insertedTransactions.length > 0 ? (
    <AppText variant="small" tone="soft">
      本次 +{lastXpResult.insertedTransactions.reduce((sum, item) => sum + Math.max(item.amount, 0), 0)} XP ·{" "}
      {lastXpResult.insertedTransactions.map((item) => item.reason).join(" / ")}
    </AppText>
  ) : null}
</Card>
```

- [ ] **Step 5: Add profile wallet and shop entries**

In `app/(tabs)/profile.tsx`, import:

```tsx
import { router } from "expo-router";
import { hasAdminPin, setAdminPin, verifyAdminPin } from "../../src/admin/adminSettingsRepository";
import { getWallet } from "../../src/xp/xpRepository";
```

Add state:

```tsx
const [xpBalance, setXpBalance] = useState(0);
const [lifetimeEarned, setLifetimeEarned] = useState(0);
const [adminTapCount, setAdminTapCount] = useState(0);
const [showAdminEntry, setShowAdminEntry] = useState(false);
const [adminPin, setAdminPinInput] = useState("");
const [adminMessage, setAdminMessage] = useState<string | null>(null);
```

Extend `useFocusEffect`:

```tsx
getWallet().then((wallet) => {
  setXpBalance(wallet.balance);
  setLifetimeEarned(wallet.lifetimeEarned);
});
```

Add handlers:

```tsx
function revealAdminEntry() {
  const next = adminTapCount + 1;
  setAdminTapCount(next);
  if (next >= 5) {
    setShowAdminEntry(true);
  }
}

async function enterAdminMode() {
  const exists = await hasAdminPin();

  if (!exists) {
    await setAdminPin(adminPin);
    setAdminMessage("管理 PIN 已设置");
    router.push("/admin/rewards");
    return;
  }

  const ok = await verifyAdminPin(adminPin);
  if (!ok) {
    setAdminMessage("管理 PIN 不正确");
    return;
  }

  router.push("/admin/rewards");
}
```

Add this section near the top of Profile screen:

```tsx
<SectionCard title="奖励">
  <Pressable onPress={revealAdminEntry} style={{ gap: spacing.xs }}>
    <AppText variant="caption" tone="primary">
      当前 XP
    </AppText>
    <AppText variant="title" tone="primary">
      {xpBalance} XP
    </AppText>
    <AppText variant="small" tone="muted">
      累计获得 {lifetimeEarned} XP
    </AppText>
  </Pressable>
  <Divider />
  <AppButton title="打开奖励商城" icon="gift-outline" onPress={() => router.push("/shop")} />
  <AppButton title="查看兑换记录" variant="secondary" icon="receipt-outline" onPress={() => router.push("/shop/redemptions")} />
  {showAdminEntry ? (
    <>
      <Divider />
      <TextField label="管理 PIN" value={adminPin} onChangeText={setAdminPinInput} keyboardType="number-pad" placeholder="输入或设置 PIN" />
      {adminMessage ? <HelperText tone={adminMessage.includes("不正确") ? "danger" : "success"}>{adminMessage}</HelperText> : null}
      <AppButton title="进入奖励管理" variant="secondary" onPress={enterAdminMode} disabled={adminPin.length < 4} />
    </>
  ) : null}
</SectionCard>
```

Also add `Pressable` to the existing `react-native` import.

- [ ] **Step 6: Run type and tests**

Run:

```bash
npm test -- src/xp src/rewards src/admin
npm run lint
```

Expected: XP/reward/admin tests pass. Lint may expose import or formatting issues in modified screens; fix those before continuing.

## Task 8: Build User Shop And Redemption History Screens

**Files:**
- Create: `app/shop/index.tsx`
- Create: `app/shop/redemptions.tsx`

- [ ] **Step 1: Build shop screen**

Create `app/shop/index.tsx`:

```tsx
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { getWallet } from "../../src/xp/xpRepository";
import { Reward } from "../../src/rewards/types";
import { listRewards } from "../../src/rewards/rewardRepository";
import { ensureDefaultRewards, redeemReward } from "../../src/rewards/rewardService";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { spacing } from "../../src/ui/theme";

function rewardTypeLabel(reward: Reward): string {
  return reward.type === "virtual" ? "虚拟奖励" : "现实奖励";
}

export default function ShopScreen() {
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    await ensureDefaultRewards();
    const wallet = await getWallet();
    setBalance(wallet.balance);
    setRewards(await listRewards({ includeArchived: false }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function redeem(reward: Reward) {
    setError(null);
    setMessage(null);

    try {
      const redemption = await redeemReward(reward.id);
      setMessage(redemption.status === "fulfilled" ? "已解锁奖励" : "已提交兑换，等待兑现");
      await load();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "兑换失败");
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">奖励商城</AppText>
        <AppText variant="body" tone="muted">
          当前余额 {balance} XP
        </AppText>
      </View>

      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {error ? <HelperText tone="danger">{error}</HelperText> : null}

      <View style={{ gap: spacing.md }}>
        {rewards.map((reward) => {
          const canRedeem = balance >= reward.priceXp;
          return (
            <Card key={reward.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Badge label={rewardTypeLabel(reward)} tone={reward.type === "virtual" ? "primary" : "success"} />
                  <AppText variant="bodyStrong">{reward.title}</AppText>
                  {reward.description ? (
                    <AppText variant="small" tone="muted">
                      {reward.description}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="bodyStrong" tone="primary">
                  {reward.priceXp} XP
                </AppText>
              </View>
              <AppButton
                title={canRedeem ? "兑换" : `还差 ${reward.priceXp - balance} XP`}
                onPress={() => redeem(reward)}
                disabled={!canRedeem}
              />
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Build redemption history screen**

Create `app/shop/redemptions.tsx`:

```tsx
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { getRewardById, listRedemptions } from "../../src/rewards/rewardRepository";
import { Reward, RewardRedemption } from "../../src/rewards/types";
import { AppText, Badge, Card } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { spacing } from "../../src/ui/theme";

const STATUS_LABEL = {
  pending_fulfillment: "待兑现",
  fulfilled: "已兑现",
  cancelled: "已取消"
} as const;

export default function RedemptionsScreen() {
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [rewards, setRewards] = useState<Record<string, Reward>>({});

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const items = await listRedemptions();
        const pairs = await Promise.all(
          items.map(async (item) => [item.rewardId, await getRewardById(item.rewardId)] as const)
        );
        setRedemptions(items);
        setRewards(
          Object.fromEntries(
            pairs.flatMap(([id, reward]) => (reward ? [[id, reward]] : []))
          )
        );
      }

      load();
    }, [])
  );

  const groups = useMemo(() => {
    return {
      pending_fulfillment: redemptions.filter((item) => item.status === "pending_fulfillment"),
      fulfilled: redemptions.filter((item) => item.status === "fulfilled"),
      cancelled: redemptions.filter((item) => item.status === "cancelled")
    };
  }, [redemptions]);

  function renderGroup(status: RewardRedemption["status"], items: RewardRedemption[]) {
    if (items.length === 0) {
      return null;
    }

    return (
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" tone="muted">
          {STATUS_LABEL[status]}
        </AppText>
        {items.map((item) => {
          const reward = rewards[item.rewardId];
          return (
            <Card key={item.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Badge label={STATUS_LABEL[item.status]} tone={item.status === "cancelled" ? "muted" : "primary"} />
                  <AppText variant="bodyStrong">{reward?.title ?? "奖励已不存在"}</AppText>
                  <AppText variant="small" tone="muted">
                    {new Date(item.createdAt).toLocaleString()}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" tone="primary">
                  {item.priceXp} XP
                </AppText>
              </View>
            </Card>
          );
        })}
      </View>
    );
  }

  return (
    <Screen>
      <AppText variant="display">兑换记录</AppText>
      {redemptions.length === 0 ? (
        <EmptyState title="还没有兑换记录" body="攒够 XP 后，可以在奖励商城兑换喜欢的奖励。" />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {renderGroup("pending_fulfillment", groups.pending_fulfillment)}
          {renderGroup("fulfilled", groups.fulfilled)}
          {renderGroup("cancelled", groups.cancelled)}
        </View>
      )}
    </Screen>
  );
}
```

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS after fixing import ordering or JSX formatting issues.

## Task 9: Build Hidden Admin Reward And Fulfillment Screens

**Files:**
- Create: `app/admin/rewards.tsx`
- Create: `app/admin/redemptions.tsx`

- [ ] **Step 1: Build reward management screen**

Create `app/admin/rewards.tsx`:

```tsx
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { createReward, listRewards, updateReward } from "../../src/rewards/rewardRepository";
import { Reward, RewardType, VirtualRewardKind } from "../../src/rewards/types";
import {
  AppButton,
  AppText,
  Badge,
  Card,
  HelperText,
  Label,
  SegmentedControl,
  TextField
} from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { spacing } from "../../src/ui/theme";

export default function AdminRewardsScreen() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<RewardType>("real_world");
  const [priceXp, setPriceXp] = useState("300");
  const [virtualKind, setVirtualKind] = useState<VirtualRewardKind>("none");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    listRewards({ includeArchived: true }).then(setRewards);
  }, []);

  useFocusEffect(load);

  function startEdit(reward: Reward) {
    setEditing(reward);
    setTitle(reward.title);
    setDescription(reward.description ?? "");
    setType(reward.type);
    setPriceXp(String(reward.priceXp));
    setVirtualKind(reward.virtualKind);
    setMessage(null);
  }

  function resetForm() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setType("real_world");
    setPriceXp("300");
    setVirtualKind("none");
  }

  async function save() {
    const input = {
      title,
      description: description || null,
      type,
      priceXp: Number(priceXp),
      status: editing?.status ?? "active",
      virtualKind: type === "virtual" ? virtualKind : "none",
      inventoryLimit: null
    } as const;

    if (editing) {
      await updateReward(editing.id, input);
      setMessage("奖励已更新");
    } else {
      await createReward(input);
      setMessage("奖励已新增");
    }
    resetForm();
    load();
  }

  async function toggleArchived(reward: Reward) {
    await updateReward(reward.id, {
      title: reward.title,
      description: reward.description,
      type: reward.type,
      priceXp: reward.priceXp,
      status: reward.status === "active" ? "archived" : "active",
      virtualKind: reward.virtualKind,
      inventoryLimit: reward.inventoryLimit
    });
    load();
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">奖励管理</AppText>
        <AppText variant="body" tone="muted">
          普通使用者不会看到新增和编辑入口
        </AppText>
      </View>

      <Card>
        <AppText variant="section">{editing ? "编辑奖励" : "新增奖励"}</AppText>
        <TextField label="名称" value={title} onChangeText={setTitle} placeholder="例如：奶茶一杯" />
        <TextField label="描述" value={description} onChangeText={setDescription} placeholder="例如：周末兑现" />
        <View style={{ gap: spacing.sm }}>
          <Label>类型</Label>
          <SegmentedControl<RewardType>
            value={type}
            onChange={setType}
            options={[
              { label: "现实", value: "real_world" },
              { label: "虚拟", value: "virtual" }
            ]}
          />
        </View>
        {type === "virtual" ? (
          <View style={{ gap: spacing.sm }}>
            <Label>虚拟类型</Label>
            <SegmentedControl<VirtualRewardKind>
              value={virtualKind}
              onChange={setVirtualKind}
              options={[
                { label: "主题", value: "theme" },
                { label: "动效", value: "celebration" },
                { label: "称号", value: "title" }
              ]}
            />
          </View>
        ) : null}
        <TextField label="价格 XP" value={priceXp} onChangeText={setPriceXp} keyboardType="numeric" />
        {message ? <HelperText tone="success">{message}</HelperText> : null}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <AppButton title="保存" onPress={save} disabled={!title || Number(priceXp) <= 0} style={{ flex: 1 }} />
          <AppButton title="兑现管理" variant="secondary" onPress={() => router.push("/admin/redemptions")} style={{ flex: 1 }} />
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        {rewards.map((reward) => (
          <Card key={reward.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Badge label={reward.status === "active" ? "上架中" : "已下架"} tone={reward.status === "active" ? "success" : "muted"} />
                <AppText variant="bodyStrong">{reward.title}</AppText>
                <AppText variant="small" tone="muted">
                  {reward.type === "virtual" ? "虚拟奖励" : "现实奖励"} · {reward.priceXp} XP
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <AppButton title="编辑" variant="secondary" compact onPress={() => startEdit(reward)} style={{ flex: 1 }} />
              <AppButton
                title={reward.status === "active" ? "下架" : "重新上架"}
                variant="ghost"
                compact
                onPress={() => toggleArchived(reward)}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Build fulfillment management screen**

Create `app/admin/redemptions.tsx`:

```tsx
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { getRewardById, listRedemptions } from "../../src/rewards/rewardRepository";
import { cancelRedemption, fulfillRedemption } from "../../src/rewards/rewardService";
import { Reward, RewardRedemption } from "../../src/rewards/types";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { spacing } from "../../src/ui/theme";

export default function AdminRedemptionsScreen() {
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [rewards, setRewards] = useState<Record<string, Reward>>({});
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const items = await listRedemptions();
    const pairs = await Promise.all(
      items.map(async (item) => [item.rewardId, await getRewardById(item.rewardId)] as const)
    );
    setRedemptions(items);
    setRewards(Object.fromEntries(pairs.flatMap(([id, reward]) => (reward ? [[id, reward]] : []))));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function fulfill(id: string) {
    await fulfillRedemption(id);
    setMessage("已确认兑现");
    await load();
  }

  async function cancel(id: string) {
    await cancelRedemption(id);
    setMessage("已取消兑换并退回 XP");
    await load();
  }

  const pending = redemptions.filter((item) => item.status === "pending_fulfillment");

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">兑现管理</AppText>
        <AppText variant="body" tone="muted">
          现实奖励兑换后在这里确认
        </AppText>
      </View>
      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {pending.length === 0 ? (
        <EmptyState title="没有待兑现奖励" body="她兑换现实奖励后，会出现在这里。" />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {pending.map((item) => {
            const reward = rewards[item.rewardId];
            return (
              <Card key={item.id}>
                <Badge label="待兑现" tone="primary" />
                <AppText variant="bodyStrong">{reward?.title ?? "奖励已不存在"}</AppText>
                <AppText variant="small" tone="muted">
                  {item.priceXp} XP · {new Date(item.createdAt).toLocaleString()}
                </AppText>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <AppButton title="确认已兑现" compact onPress={() => fulfill(item.id)} style={{ flex: 1 }} />
                  <AppButton title="取消并退回 XP" compact variant="ghost" onPress={() => cancel(item.id)} style={{ flex: 1 }} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
```

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS after fixing import, style, or `as const` typing issues.

## Task 10: Export Data And Final Verification

**Files:**
- Modify: `src/export/exportData.ts`
- Modify: `docs/verification/v1-mvp-checklist.md` if the project wants this feature included in manual QA notes.

- [ ] **Step 1: Inspect current export implementation**

Run:

```bash
sed -n '1,260p' src/export/exportData.ts
```

Expected: Identify whether export currently gathers all tables through repositories or manually lists only habits/check-ins/plans/settings.

- [ ] **Step 2: Add XP and rewards to export**

If `buildExportJson()` manually lists app data, add:

```ts
import { listRewards } from "../rewards/rewardRepository";
import { listRedemptions } from "../rewards/rewardRepository";
import { getWallet, listXpTransactions } from "../xp/xpRepository";
```

Then include:

```ts
const wallet = await getWallet();
const xpTransactions = await listXpTransactions();
const rewards = await listRewards({ includeArchived: true });
const rewardRedemptions = await listRedemptions();
```

And add these fields to the exported object:

```ts
xp: {
  wallet,
  transactions: xpTransactions
},
rewards: {
  items: rewards,
  redemptions: rewardRedemptions
}
```

- [ ] **Step 3: Add focused export test if export has tests**

If `src/export/exportData.test.ts` exists, add an assertion that exported JSON contains `xp.wallet`, `xp.transactions`, `rewards.items`, and `rewards.redemptions`. If no export test exists, skip this step and rely on final full test plus manual export smoke test.

- [ ] **Step 4: Run full automated verification**

Run:

```bash
npm test
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Run app smoke check**

Run:

```bash
npm run web
```

Expected: Expo web starts. Open the local URL and smoke test:

1. Create or use an existing habit.
2. Complete a check-in.
3. Confirm XP balance increases and does not double after reload.
4. Open 我的 -> 奖励商城.
5. Confirm virtual and real rewards are visible.
6. Redeem a reward when enough XP exists.
7. Enter hidden admin mode from 我的 by tapping the XP card 5 times.
8. Confirm pending real reward can be fulfilled or cancelled.

Stop only the Expo process started for this smoke check.

- [ ] **Step 6: Git checkpoint only after explicit approval**

Because local rules require confirmation for git history operations, do not commit automatically. If the user explicitly approves a commit, use:

```bash
git add docs/superpowers/specs/2026-07-06-couple-reward-shop-xp-design.md \
  docs/superpowers/plans/2026-07-06-couple-reward-shop-xp-plan.md \
  src/db/migrations.ts src/db/database.ts test/fakes/expo-sqlite.ts \
  src/xp src/rewards src/admin \
  app/_layout.tsx 'app/(tabs)/index.tsx' 'app/(tabs)/profile.tsx' app/shop app/admin \
  src/export/exportData.ts docs/verification/v1-mvp-checklist.md
git commit -m "feat: 增加情侣奖励商城与 XP 系统"
```

Expected: Commit succeeds only after the user has approved committing.

## Self-Review

Spec coverage:

- XP wallet and transactions: Tasks 1-4.
- XP earning after check-in: Tasks 2, 4, 7.
- Global XP balance: Tasks 3, 7.
- Virtual and real rewards: Tasks 5, 8, 9.
- Ordinary user cannot add rewards: Tasks 8 and 9 separate user shop from hidden admin pages.
- Hidden admin entry and PIN: Tasks 6 and 7.
- Pending fulfillment and confirmation: Tasks 5 and 9.
- Refund on cancellation: Task 5.
- No account, backend, payment, or sync: Scope check and file structure exclude server changes.
- Testing and verification: Tasks 2-6 and 10.

Placeholder scan:

- The plan avoids unfinished implementation markers and unresolved requirement placeholders.
- Every new module has concrete type names, function names, and test commands.

Type consistency:

- XP transaction reason names match `XpReason`.
- Reward status names match `RewardStatus` and redemption status names match `RedemptionStatus`.
- Route names match `app/shop/index.tsx`, `app/shop/redemptions.tsx`, `app/admin/rewards.tsx`, and `app/admin/redemptions.tsx`.
