# Daily Habit Check-in AI Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile MVP for personal habit reminders, daily check-ins, streak tracking, local persistence, and AI-generated habit starter plans.

**Architecture:** Use an Expo React Native app for the mobile client, local SQLite for offline-first habit/check-in storage, Expo Notifications for device reminders, and a small Node API server for AI plan generation so OpenAI credentials never ship to the mobile app. Keep the app organized by feature modules: habits, check-ins, reminders, and AI plans.

**Tech Stack:** Expo, React Native, TypeScript, Expo Router, expo-sqlite, expo-notifications, Node.js, Express, OpenAI SDK, Zod, Vitest.

---

## Scope Notes

This plan implements the V1 MVP described in `docs/requirements/daily-habit-checkin-ai-plan.md`:

- Mobile app scaffold and navigation.
- Habit CRUD for 3 to 7 active habits.
- Local persistence for habits, check-ins, plans, and reminder settings.
- Today check-in flow with one-tap completion and optional numeric value.
- Streak and monthly completion stats.
- Habit-level daily reminders and optional evening summary.
- AI habit starter plan generation through a backend API.
- AI adjustment suggestion entry point with deterministic local rules for V1.
- Privacy copy and settings surface.

This plan intentionally excludes V1 non-goals: account login, cloud sync, teams, social, subscriptions, calendar integration, health data integration,补卡, and long-running AI chat.

## File Structure

```text
.
├── app/
│   ├── _layout.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── habits.tsx
│   │   └── profile.tsx
│   ├── habit/
│   │   ├── [id].tsx
│   │   └── new.tsx
│   └── plan-preview.tsx
├── src/
│   ├── ai/
│   │   ├── aiClient.ts
│   │   ├── adjustmentRules.ts
│   │   └── types.ts
│   ├── checkins/
│   │   ├── checkinRepository.ts
│   │   ├── stats.ts
│   │   └── types.ts
│   ├── db/
│   │   ├── database.ts
│   │   ├── migrations.ts
│   │   └── schema.ts
│   ├── habits/
│   │   ├── habitRepository.ts
│   │   ├── habitRules.ts
│   │   └── types.ts
│   ├── reminders/
│   │   ├── reminderService.ts
│   │   └── types.ts
│   ├── ui/
│   │   ├── EmptyState.tsx
│   │   ├── HabitRow.tsx
│   │   ├── ProgressHeader.tsx
│   │   └── Screen.tsx
│   └── utils/
│       ├── date.ts
│       └── id.ts
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.ts
│   │   ├── habitPlanSchema.ts
│   │   └── openaiHabitPlanner.ts
│   └── tests/
│       └── habitPlanSchema.test.ts
├── package.json
├── app.json
├── tsconfig.json
└── vitest.config.ts
```

Responsibility boundaries:

- `app/` contains navigation and screen composition only.
- `src/*Repository.ts` files own persistence.
- `src/*Rules.ts` files own deterministic business rules.
- `src/reminders/reminderService.ts` owns notification permissions and scheduling.
- `src/ai/aiClient.ts` calls the backend API; it does not call OpenAI directly.
- `server/` owns all OpenAI credential usage and validates AI output.

## Task 1: Create Expo App Scaffold

**Files:**

- Create: `package.json`
- Create: `app.json`
- Create: `tsconfig.json`
- Create: `app/_layout.tsx`
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx`
- Create: `app/(tabs)/habits.tsx`
- Create: `app/(tabs)/profile.tsx`
- Create: `app/habit/new.tsx`
- Create: `app/habit/[id].tsx`
- Create: `app/plan-preview.tsx`
- Create: `src/db/database.ts`
- Create: `src/reminders/reminderService.ts`

- [ ] **Step 1: Scaffold the Expo app**

Run:

```bash
rm -rf /tmp/daily-habit-expo-scaffold
npx create-expo-app@latest /tmp/daily-habit-expo-scaffold --template default --no-install --no-agents-md
cp /tmp/daily-habit-expo-scaffold/package.json .
cp /tmp/daily-habit-expo-scaffold/app.json .
cp /tmp/daily-habit-expo-scaffold/tsconfig.json .
cp /tmp/daily-habit-expo-scaffold/.gitignore .
cp -R /tmp/daily-habit-expo-scaffold/assets .
npm install
```

Expected: Expo creates a TypeScript app scaffold without deleting `docs/`; dependencies install in the current repository.

- [ ] **Step 2: Install mobile dependencies**

Run:

```bash
npx expo install expo-router expo-sqlite expo-notifications expo-constants
npm install zod
npm install -D vitest
```

Expected: dependencies are added to `package.json` and install without errors.

- [ ] **Step 3: Configure Expo Router**

Modify `package.json` so the entry point is Expo Router:

```json
{
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: Create root layout**

Create `app/_layout.tsx`:

```tsx
import { Stack } from "expo-router";
import { useEffect } from "react";
import { initializeDatabase } from "../src/db/database";
import { configureNotificationHandler } from "../src/reminders/reminderService";

export default function RootLayout() {
  useEffect(() => {
    initializeDatabase();
    configureNotificationHandler();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="habit/new" options={{ title: "新增习惯" }} />
      <Stack.Screen name="habit/[id]" options={{ title: "习惯详情" }} />
      <Stack.Screen name="plan-preview" options={{ title: "AI 计划预览" }} />
    </Stack>
  );
}
```

- [ ] **Step 5: Create tab layout**

Create `app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: "center" }}>
      <Tabs.Screen name="index" options={{ title: "今日" }} />
      <Tabs.Screen name="habits" options={{ title: "习惯" }} />
      <Tabs.Screen name="profile" options={{ title: "我的" }} />
    </Tabs>
  );
}
```

- [ ] **Step 6: Add initial screens**

Create `app/(tabs)/index.tsx`:

```tsx
import { Text } from "react-native";
import { Screen } from "../../src/ui/Screen";

export default function TodayScreen() {
  return (
    <Screen>
      <Text>今日打卡</Text>
    </Screen>
  );
}
```

Create `app/(tabs)/habits.tsx`:

```tsx
import { Link } from "expo-router";
import { Text } from "react-native";
import { Screen } from "../../src/ui/Screen";

export default function HabitsScreen() {
  return (
    <Screen>
      <Text>习惯管理</Text>
      <Link href="/habit/new">新增习惯</Link>
    </Screen>
  );
}
```

Create `app/(tabs)/profile.tsx`:

```tsx
import { Text } from "react-native";
import { Screen } from "../../src/ui/Screen";

export default function ProfileScreen() {
  return (
    <Screen>
      <Text>我的</Text>
    </Screen>
  );
}
```

Create `src/ui/Screen.tsx`:

```tsx
import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet } from "react-native";

export function Screen({ children }: PropsWithChildren) {
  return <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 16,
    padding: 16,
    backgroundColor: "#F7F7F2"
  }
});
```

Create `src/db/database.ts`:

```ts
export function initializeDatabase(): void {
  // Real migrations are added in the persistence task.
}
```

Create `src/reminders/reminderService.ts`:

```ts
export function configureNotificationHandler(): void {
  // Real notification handling is added in the reminder task.
}
```

Create `app/habit/new.tsx`:

```tsx
import { Text } from "react-native";
import { Screen } from "../../src/ui/Screen";

export default function NewHabitScreen() {
  return (
    <Screen>
      <Text>新增习惯</Text>
    </Screen>
  );
}
```

Create `app/habit/[id].tsx`:

```tsx
import { Text } from "react-native";
import { Screen } from "../../src/ui/Screen";

export default function HabitDetailScreen() {
  return (
    <Screen>
      <Text>习惯详情</Text>
    </Screen>
  );
}
```

Create `app/plan-preview.tsx`:

```tsx
import { Text } from "react-native";
import { Screen } from "../src/ui/Screen";

export default function PlanPreviewScreen() {
  return (
    <Screen>
      <Text>AI 计划预览</Text>
    </Screen>
  );
}
```

- [ ] **Step 7: Run the app**

Run:

```bash
npm run ios
```

Expected: Expo starts the mobile app in the iOS simulator and shows three tabs: 今日、习惯、我的. If no simulator is available, run `npm start -- --port 8082`, confirm the Expo Go QR code appears, and verify on a physical device.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json app.json tsconfig.json app src
git commit -m "feat: 初始化 Expo 移动端项目"
```

## Task 2: Add Domain Types and Date Utilities

**Files:**

- Create: `src/habits/types.ts`
- Create: `src/checkins/types.ts`
- Create: `src/ai/types.ts`
- Create: `src/reminders/types.ts`
- Create: `src/utils/date.ts`
- Create: `src/utils/id.ts`
- Create: `src/checkins/stats.test.ts`

- [ ] **Step 1: Write stats test first**

Create `src/checkins/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateCurrentStreak, calculateMonthlyCompletionRate } from "./stats";
import { CheckIn } from "./types";

const completed = (date: string): CheckIn => ({
  id: `checkin-${date}`,
  habitId: "habit-1",
  date,
  status: "completed",
  value: null,
  note: null,
  createdAt: `${date}T10:00:00.000Z`
});

describe("check-in stats", () => {
  it("counts current streak across completed execution days", () => {
    const result = calculateCurrentStreak({
      today: "2026-07-05",
      scheduledDates: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"],
      checkIns: [completed("2026-07-03"), completed("2026-07-04"), completed("2026-07-05")]
    });

    expect(result).toBe(3);
  });

  it("does not break streak on non-execution days", () => {
    const result = calculateCurrentStreak({
      today: "2026-07-05",
      scheduledDates: ["2026-07-01", "2026-07-03", "2026-07-05"],
      checkIns: [completed("2026-07-01"), completed("2026-07-03"), completed("2026-07-05")]
    });

    expect(result).toBe(3);
  });

  it("calculates monthly completion rate", () => {
    const result = calculateMonthlyCompletionRate({
      scheduledDates: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"],
      checkIns: [completed("2026-07-01"), completed("2026-07-04")]
    });

    expect(result).toBe(50);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- src/checkins/stats.test.ts
```

Expected: FAIL because `./stats` and type files do not exist yet.

- [ ] **Step 3: Add domain types**

Create `src/habits/types.ts`:

```ts
export type HabitFrequency =
  | { type: "daily" }
  | { type: "weekdays" }
  | { type: "weekly"; daysOfWeek: number[] };

export type HabitTrackType = "check" | "numeric";

export type Habit = {
  id: string;
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  reminderTime: string | null;
  isReminderEnabled: boolean;
  isPaused: boolean;
  trackType: HabitTrackType;
  numericUnit: string | null;
  createdAt: string;
};
```

Create `src/checkins/types.ts`:

```ts
export type CheckInStatus = "completed" | "skipped" | "missed";

export type CheckIn = {
  id: string;
  habitId: string;
  date: string;
  status: CheckInStatus;
  value: number | null;
  note: string | null;
  createdAt: string;
};
```

Create `src/ai/types.ts`:

```ts
import { HabitFrequency, HabitTrackType } from "../habits/types";

export type AIPlanRequest = {
  goalText: string;
  currentLevel: "beginner" | "some_experience" | "stable";
  dailyAvailableMinutes: number;
  expectedFrequency: HabitFrequency;
  reminderPreference: "morning" | "noon" | "evening" | "custom";
  customReminderTime: string | null;
  preferredTrackType: HabitTrackType;
};

export type AIPlanDay = {
  day: number;
  action: string;
  targetValue: number | null;
};

export type HabitPlan = {
  id: string;
  habitId: string;
  durationDays: 7 | 21;
  goalText: string;
  dailyActions: AIPlanDay[];
  startDate: string;
  endDate: string;
  currentStage: string;
  createdBy: "ai" | "manual";
};

export type AIPlanPreview = {
  habitName: string;
  description: string;
  durationDays: 7 | 21;
  dailyActions: AIPlanDay[];
  recommendedReminderTime: string;
  recommendedTrackType: HabitTrackType;
  numericUnit: string | null;
  fallbackAdvice: string;
  safetyNote: string | null;
};
```

Create `src/reminders/types.ts`:

```ts
export type ReminderSetting = {
  habitId: string;
  habitReminderTime: string | null;
  isHabitReminderEnabled: boolean;
  isEveningSummaryEnabled: boolean;
  eveningSummaryTime: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};
```

Create `src/utils/id.ts`:

```ts
export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
```

Create `src/utils/date.ts`:

```ts
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}
```

- [ ] **Step 4: Add stats implementation**

Create `src/checkins/stats.ts`:

```ts
import { CheckIn } from "./types";

type StreakInput = {
  today: string;
  scheduledDates: string[];
  checkIns: CheckIn[];
};

type CompletionRateInput = {
  scheduledDates: string[];
  checkIns: CheckIn[];
};

export function calculateCurrentStreak({ today, scheduledDates, checkIns }: StreakInput): number {
  const scheduled = scheduledDates.filter((date) => date <= today).sort();
  const completedDates = new Set(
    checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.date)
  );

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

export function calculateMonthlyCompletionRate({ scheduledDates, checkIns }: CompletionRateInput): number {
  if (scheduledDates.length === 0) {
    return 0;
  }

  const completedDates = new Set(
    checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.date)
  );
  const completedCount = scheduledDates.filter((date) => completedDates.has(date)).length;

  return Math.round((completedCount / scheduledDates.length) * 100);
}
```

- [ ] **Step 5: Run test and verify it passes**

Run:

```bash
npm test -- src/checkins/stats.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src package.json package-lock.json vitest.config.ts
git commit -m "feat: 添加习惯领域类型和统计规则"
```

## Task 3: Add SQLite Persistence

**Files:**

- Create: `src/db/schema.ts`
- Create: `src/db/migrations.ts`
- Create: `src/db/database.ts`
- Create: `src/habits/habitRepository.ts`
- Create: `src/checkins/checkinRepository.ts`
- Create: `src/habits/habitRules.ts`
- Create: `src/habits/habitRepository.test.ts`

- [ ] **Step 1: Write repository behavior test**

Create `src/habits/habitRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { initializeDatabase, resetDatabaseForTests } from "../db/database";
import { createHabit, listActiveHabits } from "./habitRepository";

describe("habit repository", () => {
  beforeEach(() => {
    initializeDatabase();
    resetDatabaseForTests();
  });

  it("creates and lists active habits", async () => {
    await createHabit({
      name: "每日阅读",
      description: "睡前阅读 10 分钟",
      frequency: { type: "daily" },
      reminderTime: "21:30",
      isReminderEnabled: true,
      trackType: "numeric",
      numericUnit: "分钟"
    });

    const habits = await listActiveHabits();

    expect(habits).toHaveLength(1);
    expect(habits[0]?.name).toBe("每日阅读");
    expect(habits[0]?.isPaused).toBe(false);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- src/habits/habitRepository.test.ts
```

Expected: FAIL because database and repository modules do not exist.

- [ ] **Step 3: Add schema constants**

Create `src/db/schema.ts`:

```ts
export const TABLES = {
  habits: "habits",
  checkIns: "check_ins",
  habitPlans: "habit_plans",
  reminderSettings: "reminder_settings"
} as const;
```

- [ ] **Step 4: Add migrations**

Create `src/db/migrations.ts`:

```ts
import { SQLiteDatabase } from "expo-sqlite";

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      frequency_json TEXT NOT NULL,
      reminder_time TEXT,
      is_reminder_enabled INTEGER NOT NULL,
      is_paused INTEGER NOT NULL,
      track_type TEXT NOT NULL,
      numeric_unit TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY NOT NULL,
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      value REAL,
      note TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(habit_id, date),
      FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_plans (
      id TEXT PRIMARY KEY NOT NULL,
      habit_id TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      goal_text TEXT NOT NULL,
      daily_actions_json TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      current_stage TEXT NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminder_settings (
      habit_id TEXT PRIMARY KEY NOT NULL,
      habit_reminder_time TEXT,
      is_habit_reminder_enabled INTEGER NOT NULL,
      is_evening_summary_enabled INTEGER NOT NULL,
      evening_summary_time TEXT NOT NULL,
      quiet_hours_start TEXT,
      quiet_hours_end TEXT,
      FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );
  `);
}
```

- [ ] **Step 5: Add database initializer**

Create `src/db/database.ts`:

```ts
import * as SQLite from "expo-sqlite";
import { runMigrations } from "./migrations";

let database: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!database) {
    database = SQLite.openDatabaseSync("daily_habits.db");
  }

  return database;
}

export async function initializeDatabase(): Promise<void> {
  await runMigrations(getDatabase());
}

export async function resetDatabaseForTests(): Promise<void> {
  const db = getDatabase();
  await db.execAsync(`
    DELETE FROM reminder_settings;
    DELETE FROM habit_plans;
    DELETE FROM check_ins;
    DELETE FROM habits;
  `);
}
```

- [ ] **Step 6: Add habit schedule rules**

Create `src/habits/habitRules.ts`:

```ts
import { Habit, HabitFrequency } from "./types";

export function shouldRunOnDate(frequency: HabitFrequency, date: Date): boolean {
  const day = date.getDay();

  if (frequency.type === "daily") {
    return true;
  }

  if (frequency.type === "weekdays") {
    return day >= 1 && day <= 5;
  }

  return frequency.daysOfWeek.includes(day);
}

export function isHabitActive(habit: Habit): boolean {
  return !habit.isPaused;
}
```

- [ ] **Step 7: Add habit repository**

Create `src/habits/habitRepository.ts`:

```ts
import { getDatabase } from "../db/database";
import { createId } from "../utils/id";
import { Habit, HabitFrequency, HabitTrackType } from "./types";

type CreateHabitInput = {
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  reminderTime: string | null;
  isReminderEnabled: boolean;
  trackType: HabitTrackType;
  numericUnit: string | null;
};

type HabitRow = {
  id: string;
  name: string;
  description: string | null;
  frequency_json: string;
  reminder_time: string | null;
  is_reminder_enabled: number;
  is_paused: number;
  track_type: HabitTrackType;
  numeric_unit: string | null;
  created_at: string;
};

function mapRow(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    frequency: JSON.parse(row.frequency_json),
    reminderTime: row.reminder_time,
    isReminderEnabled: row.is_reminder_enabled === 1,
    isPaused: row.is_paused === 1,
    trackType: row.track_type,
    numericUnit: row.numeric_unit,
    createdAt: row.created_at
  };
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const db = getDatabase();
  const habit: Habit = {
    id: createId("habit"),
    name: input.name,
    description: input.description,
    frequency: input.frequency,
    reminderTime: input.reminderTime,
    isReminderEnabled: input.isReminderEnabled,
    isPaused: false,
    trackType: input.trackType,
    numericUnit: input.numericUnit,
    createdAt: new Date().toISOString()
  };

  await db.runAsync(
    `INSERT INTO habits (
      id, name, description, frequency_json, reminder_time, is_reminder_enabled,
      is_paused, track_type, numeric_unit, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      habit.id,
      habit.name,
      habit.description,
      JSON.stringify(habit.frequency),
      habit.reminderTime,
      habit.isReminderEnabled ? 1 : 0,
      habit.isPaused ? 1 : 0,
      habit.trackType,
      habit.numericUnit,
      habit.createdAt
    ]
  );

  return habit;
}

export async function listActiveHabits(): Promise<Habit[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<HabitRow>(
    "SELECT * FROM habits WHERE is_paused = 0 ORDER BY created_at ASC"
  );

  return rows.map(mapRow);
}

export async function getHabitById(id: string): Promise<Habit | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<HabitRow>("SELECT * FROM habits WHERE id = ?", [id]);

  return row ? mapRow(row) : null;
}
```

- [ ] **Step 8: Add check-in repository**

Create `src/checkins/checkinRepository.ts`:

```ts
import { getDatabase } from "../db/database";
import { createId } from "../utils/id";
import { CheckIn } from "./types";

type CheckInRow = {
  id: string;
  habit_id: string;
  date: string;
  status: CheckIn["status"];
  value: number | null;
  note: string | null;
  created_at: string;
};

function mapRow(row: CheckInRow): CheckIn {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    status: row.status,
    value: row.value,
    note: row.note,
    createdAt: row.created_at
  };
}

export async function completeCheckIn(input: {
  habitId: string;
  date: string;
  value: number | null;
  note: string | null;
}): Promise<CheckIn> {
  const db = getDatabase();
  const checkIn: CheckIn = {
    id: createId("checkin"),
    habitId: input.habitId,
    date: input.date,
    status: "completed",
    value: input.value,
    note: input.note,
    createdAt: new Date().toISOString()
  };

  await db.runAsync(
    `INSERT INTO check_ins (id, habit_id, date, status, value, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(habit_id, date) DO UPDATE SET
       status = excluded.status,
       value = excluded.value,
       note = excluded.note,
       created_at = excluded.created_at`,
    [checkIn.id, checkIn.habitId, checkIn.date, checkIn.status, checkIn.value, checkIn.note, checkIn.createdAt]
  );

  return checkIn;
}

export async function listCheckInsForHabit(habitId: string): Promise<CheckIn[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<CheckInRow>(
    "SELECT * FROM check_ins WHERE habit_id = ? ORDER BY date ASC",
    [habitId]
  );

  return rows.map(mapRow);
}
```

- [ ] **Step 9: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: 添加本地数据存储"
```

## Task 4: Implement Reminder Scheduling

**Files:**

- Create: `src/reminders/reminderService.ts`
- Create: `src/reminders/reminderService.test.ts`

- [ ] **Step 1: Write pure scheduling test**

Create `src/reminders/reminderService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseReminderTime } from "./reminderService";

describe("parseReminderTime", () => {
  it("parses HH:mm time", () => {
    expect(parseReminderTime("21:30")).toEqual({ hour: 21, minute: 30 });
  });

  it("rejects invalid time", () => {
    expect(() => parseReminderTime("25:99")).toThrow("Invalid reminder time");
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- src/reminders/reminderService.test.ts
```

Expected: FAIL because `reminderService.ts` does not exist.

- [ ] **Step 3: Add reminder service**

Create `src/reminders/reminderService.ts`:

```ts
import * as Notifications from "expo-notifications";
import { Habit } from "../habits/types";

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  });
}

export function parseReminderTime(time: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);

  if (!match) {
    throw new Error("Invalid reminder time");
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

export async function requestReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();

  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleHabitReminder(habit: Habit): Promise<string | null> {
  if (!habit.isReminderEnabled || !habit.reminderTime || habit.isPaused) {
    return null;
  }

  const hasPermission = await requestReminderPermission();

  if (!hasPermission) {
    return null;
  }

  const { hour, minute } = parseReminderTime(habit.reminderTime);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `该打卡了：${habit.name}`,
      body: "完成后点一下，今天就算坚持住了。"
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute
    }
  });
}

export async function scheduleEveningSummary(input: {
  incompleteCount: number;
  incompleteNames: string[];
  time: string;
}): Promise<string | null> {
  if (input.incompleteCount === 0) {
    return null;
  }

  const hasPermission = await requestReminderPermission();

  if (!hasPermission) {
    return null;
  }

  const { hour, minute } = parseReminderTime(input.time);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `今天还有 ${input.incompleteCount} 个习惯未完成`,
      body: input.incompleteNames.join("、")
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute
    }
  });
}
```

- [ ] **Step 4: Run reminder tests**

Run:

```bash
npm test -- src/reminders/reminderService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Manual notification smoke test**

Run:

```bash
npm run ios
```

Expected on simulator or device: app prompts for notification permission when scheduling a reminder. If simulator notification behavior is limited, record that device verification is still needed.

- [ ] **Step 6: Commit**

```bash
git add src/reminders
git commit -m "feat: 添加本地提醒调度"
```

## Task 5: Implement AI Plan Backend

**Files:**

- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`
- Create: `server/src/habitPlanSchema.ts`
- Create: `server/src/openaiHabitPlanner.ts`
- Create: `server/src/index.ts`
- Create: `server/tests/habitPlanSchema.test.ts`

- [ ] **Step 1: Create backend package**

Create `server/package.json`:

```json
{
  "name": "daily-habit-ai-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

- [ ] **Step 2: Install backend dependencies**

Run:

```bash
cd server
npm install cors dotenv express openai zod
npm install -D @types/cors @types/express @types/node tsx typescript vitest
```

Expected: `server/package-lock.json` is created.

- [ ] **Step 3: Add backend TypeScript config**

Create `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

Create `server/.env.example`:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=
PORT=8787
```

- [ ] **Step 4: Write schema test first**

Create `server/tests/habitPlanSchema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { HabitPlanResponseSchema } from "../src/habitPlanSchema";

describe("HabitPlanResponseSchema", () => {
  it("accepts a valid 7 day plan", () => {
    const result = HabitPlanResponseSchema.parse({
      habitName: "每日阅读",
      description: "每天睡前阅读 10 分钟",
      durationDays: 7,
      dailyActions: Array.from({ length: 7 }, (_, index) => ({
        day: index + 1,
        action: `阅读 ${index + 1}0 分钟`,
        targetValue: 10
      })),
      recommendedReminderTime: "21:30",
      recommendedTrackType: "numeric",
      numericUnit: "分钟",
      fallbackAdvice: "如果太累，先读 5 分钟。",
      safetyNote: null
    });

    expect(result.durationDays).toBe(7);
  });
});
```

- [ ] **Step 5: Run test and verify it fails**

Run:

```bash
cd server && npm test -- tests/habitPlanSchema.test.ts
```

Expected: FAIL because `habitPlanSchema.ts` does not exist.

- [ ] **Step 6: Add AI response schema**

Create `server/src/habitPlanSchema.ts`:

```ts
import { z } from "zod";

export const HabitPlanResponseSchema = z.object({
  habitName: z.string().min(1).max(32),
  description: z.string().min(1).max(120),
  durationDays: z.union([z.literal(7), z.literal(21)]),
  dailyActions: z
    .array(
      z.object({
        day: z.number().int().min(1).max(21),
        action: z.string().min(1).max(120),
        targetValue: z.number().nullable()
      })
    )
    .min(7)
    .max(21),
  recommendedReminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  recommendedTrackType: z.union([z.literal("check"), z.literal("numeric")]),
  numericUnit: z.string().max(12).nullable(),
  fallbackAdvice: z.string().min(1).max(120),
  safetyNote: z.string().max(120).nullable()
});

export type HabitPlanResponse = z.infer<typeof HabitPlanResponseSchema>;

export const HabitPlanRequestSchema = z.object({
  goalText: z.string().min(2).max(120),
  currentLevel: z.union([z.literal("beginner"), z.literal("some_experience"), z.literal("stable")]),
  dailyAvailableMinutes: z.number().int().min(1).max(180),
  expectedFrequency: z.object({
    type: z.union([z.literal("daily"), z.literal("weekdays"), z.literal("weekly")]),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional()
  }),
  reminderPreference: z.union([
    z.literal("morning"),
    z.literal("noon"),
    z.literal("evening"),
    z.literal("custom")
  ]),
  customReminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable(),
  preferredTrackType: z.union([z.literal("check"), z.literal("numeric")])
});
```

- [ ] **Step 7: Add OpenAI planner**

Create `server/src/openaiHabitPlanner.ts`:

```ts
import OpenAI from "openai";
import { HabitPlanRequestSchema, HabitPlanResponse, HabitPlanResponseSchema } from "./habitPlanSchema";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateHabitPlan(rawInput: unknown): Promise<HabitPlanResponse> {
  const input = HabitPlanRequestSchema.parse(rawInput);

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "your-model-name",
    instructions:
      "你是习惯计划助手。只生成温和、可执行、低压力的习惯入门计划。必须输出 JSON，不要输出 Markdown。",
    input: JSON.stringify(input),
    text: {
      format: {
        type: "json_schema",
        name: "habit_plan",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "habitName",
            "description",
            "durationDays",
            "dailyActions",
            "recommendedReminderTime",
            "recommendedTrackType",
            "numericUnit",
            "fallbackAdvice",
            "safetyNote"
          ],
          properties: {
            habitName: { type: "string" },
            description: { type: "string" },
            durationDays: { enum: [7, 21] },
            dailyActions: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["day", "action", "targetValue"],
                properties: {
                  day: { type: "number" },
                  action: { type: "string" },
                  targetValue: { type: ["number", "null"] }
                }
              }
            },
            recommendedReminderTime: { type: "string" },
            recommendedTrackType: { enum: ["check", "numeric"] },
            numericUnit: { type: ["string", "null"] },
            fallbackAdvice: { type: "string" },
            safetyNote: { type: ["string", "null"] }
          }
        }
      }
    }
  });

  const content = response.output_text;

  if (!content) {
    throw new Error("AI returned empty content");
  }

  return HabitPlanResponseSchema.parse(JSON.parse(content));
}
```

- [ ] **Step 8: Add Express API**

Create `server/src/index.ts`:

```ts
import cors from "cors";
import "dotenv/config";
import express from "express";
import { generateHabitPlan } from "./openaiHabitPlanner";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/ai/habit-plan", async (request, response) => {
  try {
    const plan = await generateHabitPlan(request.body);
    response.json(plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    response.status(400).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Habit AI server listening on http://localhost:${port}`);
});
```

- [ ] **Step 9: Run backend tests and build**

Run:

```bash
cd server && npm test && npm run build
```

Expected: tests and TypeScript build pass.

- [ ] **Step 10: Commit**

```bash
git add server
git commit -m "feat: 添加 AI 计划后端服务"
```

## Task 6: Add Mobile AI Client and Plan Preview

**Files:**

- Create: `src/ai/aiClient.ts`
- Create: `src/ai/adjustmentRules.ts`
- Create: `app/habit/new.tsx`
- Create: `app/plan-preview.tsx`

- [ ] **Step 1: Add mobile AI client**

Create `src/ai/aiClient.ts`:

```ts
import Constants from "expo-constants";
import { AIPlanPreview, AIPlanRequest } from "./types";

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Constants.expoConfig?.extra?.apiBaseUrl ??
  "http://localhost:8787";

export async function requestAIHabitPlan(input: AIPlanRequest): Promise<AIPlanPreview> {
  const response = await fetch(`${apiBaseUrl}/api/ai/habit-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "AI 计划生成失败");
  }

  return response.json();
}
```

- [ ] **Step 2: Add local adjustment rules**

Create `src/ai/adjustmentRules.ts`:

```ts
export type AdjustmentSuggestion = {
  title: string;
  body: string;
  actionLabel: string;
};

export function getAdjustmentSuggestion(input: {
  completionRate7Days: number;
  currentStreak: number;
  planEnded: boolean;
}): AdjustmentSuggestion | null {
  if (input.completionRate7Days < 40) {
    return {
      title: "把目标调轻一点",
      body: "最近完成率偏低，可以先缩短任务或换一个更容易开始的提醒时间。",
      actionLabel: "调整计划"
    };
  }

  if (input.currentStreak >= 7) {
    return {
      title: "节奏很好，先保持",
      body: "你已经连续完成 7 天，不急着加难度，稳定比冲刺更重要。",
      actionLabel: "继续保持"
    };
  }

  if (input.planEnded) {
    return {
      title: "计划结束了",
      body: "可以基于这段时间的完成情况，生成下一阶段计划。",
      actionLabel: "生成下一阶段"
    };
  }

  return null;
}
```

- [ ] **Step 3: Add new habit screen**

Create `app/habit/new.tsx`:

```tsx
import { router } from "expo-router";
import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { requestAIHabitPlan } from "../../src/ai/aiClient";
import { Screen } from "../../src/ui/Screen";

export default function NewHabitScreen() {
  const [goalText, setGoalText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generatePlan() {
    setIsLoading(true);
    setError(null);

    try {
      const plan = await requestAIHabitPlan({
        goalText,
        currentLevel: "beginner",
        dailyAvailableMinutes: 10,
        expectedFrequency: { type: "daily" },
        reminderPreference: "evening",
        customReminderTime: null,
        preferredTrackType: "check"
      });

      router.push({
        pathname: "/plan-preview",
        params: { plan: JSON.stringify(plan), goalText }
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "生成失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Screen>
      <Text>想培养什么习惯？</Text>
      <TextInput
        value={goalText}
        onChangeText={setGoalText}
        placeholder="例如：我想每天运动"
        style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
      />
      {error ? <Text>{error}</Text> : null}
      <Button title={isLoading ? "生成中..." : "让 AI 制定计划"} onPress={generatePlan} disabled={!goalText || isLoading} />
    </Screen>
  );
}
```

- [ ] **Step 4: Add plan preview screen**

Create `app/plan-preview.tsx`:

```tsx
import { router, useLocalSearchParams } from "expo-router";
import { Button, Text, View } from "react-native";
import { AIPlanPreview } from "../src/ai/types";
import { createHabit } from "../src/habits/habitRepository";
import { Screen } from "../src/ui/Screen";

export default function PlanPreviewScreen() {
  const params = useLocalSearchParams<{ plan: string; goalText: string }>();
  const plan = JSON.parse(params.plan) as AIPlanPreview;

  async function savePlan() {
    await createHabit({
      name: plan.habitName,
      description: plan.description,
      frequency: { type: "daily" },
      reminderTime: plan.recommendedReminderTime,
      isReminderEnabled: true,
      trackType: plan.recommendedTrackType,
      numericUnit: plan.numericUnit
    });

    router.replace("/(tabs)/habits");
  }

  return (
    <Screen>
      <Text>{plan.habitName}</Text>
      <Text>{plan.description}</Text>
      <Text>{plan.durationDays} 天计划</Text>
      {plan.dailyActions.map((item) => (
        <View key={item.day}>
          <Text>第 {item.day} 天：{item.action}</Text>
        </View>
      ))}
      <Text>提醒时间：{plan.recommendedReminderTime}</Text>
      <Text>{plan.fallbackAdvice}</Text>
      {plan.safetyNote ? <Text>{plan.safetyNote}</Text> : null}
      <Button title="保存计划" onPress={savePlan} />
    </Screen>
  );
}
```

- [ ] **Step 5: Run app smoke test**

Run in one terminal:

```bash
cd server && cp .env.example .env && npm run dev
```

Run in another terminal:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787 npm run ios
```

Expected: creating a habit through AI reaches the preview screen in the mobile app. If no API key is configured, the mobile UI shows the backend error instead of crashing. When testing on a physical device, replace `localhost` with the computer's LAN IP.

- [ ] **Step 6: Commit**

```bash
git add app src/ai
git commit -m "feat: 添加 AI 习惯计划流程"
```

## Task 7: Implement Today and Habit Detail Flows

**Files:**

- Create: `src/ui/HabitRow.tsx`
- Create: `src/ui/ProgressHeader.tsx`
- Create: `src/ui/EmptyState.tsx`
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/habits.tsx`
- Create: `app/habit/[id].tsx`

- [ ] **Step 1: Add UI primitives**

Create `src/ui/EmptyState.tsx`:

```tsx
import { Text, View } from "react-native";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 8, paddingVertical: 32 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: "#555" }}>{body}</Text>
    </View>
  );
}
```

Create `src/ui/ProgressHeader.tsx`:

```tsx
import { Text, View } from "react-native";

export function ProgressHeader({ completed, total }: { completed: number; total: number }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>今日</Text>
      <Text style={{ color: "#555" }}>已完成 {completed}/{total}</Text>
    </View>
  );
}
```

Create `src/ui/HabitRow.tsx`:

```tsx
import { Button, Text, View } from "react-native";
import { Habit } from "../habits/types";

export function HabitRow({
  habit,
  isCompleted,
  onComplete,
  onOpen
}: {
  habit: Habit;
  isCompleted: boolean;
  onComplete: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 8, backgroundColor: isCompleted ? "#E9EFE4" : "#FFFFFF" }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>{habit.name}</Text>
      <Text>{habit.reminderTime ? `提醒 ${habit.reminderTime}` : "未设置提醒"}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="详情" onPress={onOpen} />
        <Button title={isCompleted ? "已完成" : "打卡"} onPress={onComplete} disabled={isCompleted} />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Implement Today screen**

Modify `app/(tabs)/index.tsx`:

```tsx
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Button } from "react-native";
import { listCheckInsForHabit, completeCheckIn } from "../../src/checkins/checkinRepository";
import { CheckIn } from "../../src/checkins/types";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { Habit } from "../../src/habits/types";
import { EmptyState } from "../../src/ui/EmptyState";
import { HabitRow } from "../../src/ui/HabitRow";
import { ProgressHeader } from "../../src/ui/ProgressHeader";
import { Screen } from "../../src/ui/Screen";
import { todayKey } from "../../src/utils/date";

export default function TodayScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const today = todayKey();

  const load = useCallback(async () => {
    const loadedHabits = await listActiveHabits();
    const loadedCheckIns = (await Promise.all(loadedHabits.map((habit) => listCheckInsForHabit(habit.id)))).flat();
    setHabits(loadedHabits);
    setCheckIns(loadedCheckIns.filter((checkIn) => checkIn.date === today));
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function complete(habit: Habit) {
    await completeCheckIn({ habitId: habit.id, date: today, value: null, note: null });
    await load();
  }

  const completedIds = new Set(checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.habitId));

  return (
    <Screen>
      <ProgressHeader completed={completedIds.size} total={habits.length} />
      {habits.length === 0 ? (
        <>
          <EmptyState title="还没有习惯" body="先创建一个想坚持的小习惯。" />
          <Button title="新增习惯" onPress={() => router.push("/habit/new")} />
        </>
      ) : (
        habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            isCompleted={completedIds.has(habit.id)}
            onComplete={() => complete(habit)}
            onOpen={() => router.push(`/habit/${habit.id}`)}
          />
        ))
      )}
    </Screen>
  );
}
```

- [ ] **Step 3: Implement habits list**

Modify `app/(tabs)/habits.tsx`:

```tsx
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Button } from "react-native";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { Habit } from "../../src/habits/types";
import { EmptyState } from "../../src/ui/EmptyState";
import { HabitRow } from "../../src/ui/HabitRow";
import { Screen } from "../../src/ui/Screen";

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);

  useFocusEffect(
    useCallback(() => {
      listActiveHabits().then(setHabits);
    }, [])
  );

  return (
    <Screen>
      <Button title="新增习惯" onPress={() => router.push("/habit/new")} />
      {habits.length === 0 ? (
        <EmptyState title="没有习惯" body="用 AI 生成一个入门计划，或者手动创建。" />
      ) : (
        habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            isCompleted={false}
            onComplete={() => router.push("/(tabs)")}
            onOpen={() => router.push(`/habit/${habit.id}`)}
          />
        ))
      )}
    </Screen>
  );
}
```

- [ ] **Step 4: Implement habit detail**

Create `app/habit/[id].tsx`:

```tsx
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { calculateCurrentStreak, calculateMonthlyCompletionRate } from "../../src/checkins/stats";
import { CheckIn } from "../../src/checkins/types";
import { getHabitById } from "../../src/habits/habitRepository";
import { Habit } from "../../src/habits/types";
import { getAdjustmentSuggestion } from "../../src/ai/adjustmentRules";
import { Screen } from "../../src/ui/Screen";
import { todayKey } from "../../src/utils/date";

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  useEffect(() => {
    if (!id) {
      return;
    }

    getHabitById(id).then(setHabit);
    listCheckInsForHabit(id).then(setCheckIns);
  }, [id]);

  if (!habit) {
    return (
      <Screen>
        <Text>加载中...</Text>
      </Screen>
    );
  }

  const scheduledDates = checkIns.map((checkIn) => checkIn.date);
  const currentStreak = calculateCurrentStreak({ today: todayKey(), scheduledDates, checkIns });
  const completionRate = calculateMonthlyCompletionRate({ scheduledDates, checkIns });
  const suggestion = getAdjustmentSuggestion({
    completionRate7Days: completionRate,
    currentStreak,
    planEnded: false
  });

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>{habit.name}</Text>
      <Text>当前连续：{currentStreak} 天</Text>
      <Text>本月完成率：{completionRate}%</Text>
      <Text>提醒时间：{habit.reminderTime ?? "未设置"}</Text>
      {suggestion ? (
        <>
          <Text>{suggestion.title}</Text>
          <Text>{suggestion.body}</Text>
        </>
      ) : null}
    </Screen>
  );
}
```

- [ ] **Step 5: Run app smoke test**

Run:

```bash
npm run ios
```

Expected: user can create a habit in the mobile app, see it on 今日 and 习惯 tabs, complete it, and open detail.

- [ ] **Step 6: Commit**

```bash
git add app src/ui
git commit -m "feat: 添加今日打卡和习惯详情"
```

## Task 8: Complete Plan Persistence, Numeric Check-ins, and Evening Summary

**Files:**

- Modify: `src/db/migrations.ts`
- Create: `src/ai/habitPlanRepository.ts`
- Create: `src/settings/settingsRepository.ts`
- Modify: `app/plan-preview.tsx`
- Modify: `app/(tabs)/index.tsx`
- Modify: `src/reminders/reminderService.ts`

- [ ] **Step 1: Add app settings table**

Modify `src/db/migrations.ts` so the migration also creates `app_settings`:

```ts
import { SQLiteDatabase } from "expo-sqlite";

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      frequency_json TEXT NOT NULL,
      reminder_time TEXT,
      is_reminder_enabled INTEGER NOT NULL,
      is_paused INTEGER NOT NULL,
      track_type TEXT NOT NULL,
      numeric_unit TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY NOT NULL,
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      value REAL,
      note TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(habit_id, date),
      FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_plans (
      id TEXT PRIMARY KEY NOT NULL,
      habit_id TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      goal_text TEXT NOT NULL,
      daily_actions_json TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      current_stage TEXT NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminder_settings (
      habit_id TEXT PRIMARY KEY NOT NULL,
      habit_reminder_time TEXT,
      is_habit_reminder_enabled INTEGER NOT NULL,
      is_evening_summary_enabled INTEGER NOT NULL,
      evening_summary_time TEXT NOT NULL,
      quiet_hours_start TEXT,
      quiet_hours_end TEXT,
      FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}
```

- [ ] **Step 2: Add habit plan repository**

Create `src/ai/habitPlanRepository.ts`:

```ts
import { getDatabase } from "../db/database";
import { createId } from "../utils/id";
import { addDays } from "../utils/date";
import { AIPlanDay, AIPlanPreview, HabitPlan } from "./types";

type HabitPlanRow = {
  id: string;
  habit_id: string;
  duration_days: 7 | 21;
  goal_text: string;
  daily_actions_json: string;
  start_date: string;
  end_date: string;
  current_stage: string;
  created_by: "ai" | "manual";
};

function mapRow(row: HabitPlanRow): HabitPlan {
  return {
    id: row.id,
    habitId: row.habit_id,
    durationDays: row.duration_days,
    goalText: row.goal_text,
    dailyActions: JSON.parse(row.daily_actions_json) as AIPlanDay[],
    startDate: row.start_date,
    endDate: row.end_date,
    currentStage: row.current_stage,
    createdBy: row.created_by
  };
}

export async function saveAIHabitPlan(input: {
  habitId: string;
  goalText: string;
  startDate: string;
  preview: AIPlanPreview;
}): Promise<HabitPlan> {
  const db = getDatabase();
  const plan: HabitPlan = {
    id: createId("plan"),
    habitId: input.habitId,
    durationDays: input.preview.durationDays,
    goalText: input.goalText,
    dailyActions: input.preview.dailyActions,
    startDate: input.startDate,
    endDate: addDays(input.startDate, input.preview.durationDays - 1),
    currentStage: "starter",
    createdBy: "ai"
  };

  await db.runAsync(
    `INSERT INTO habit_plans (
      id, habit_id, duration_days, goal_text, daily_actions_json,
      start_date, end_date, current_stage, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      plan.id,
      plan.habitId,
      plan.durationDays,
      plan.goalText,
      JSON.stringify(plan.dailyActions),
      plan.startDate,
      plan.endDate,
      plan.currentStage,
      plan.createdBy
    ]
  );

  return plan;
}

export async function getPlanForHabit(habitId: string): Promise<HabitPlan | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<HabitPlanRow>(
    "SELECT * FROM habit_plans WHERE habit_id = ? ORDER BY start_date DESC LIMIT 1",
    [habitId]
  );

  return row ? mapRow(row) : null;
}
```

- [ ] **Step 3: Add settings repository**

Create `src/settings/settingsRepository.ts`:

```ts
import { getDatabase } from "../db/database";

export type AppSettings = {
  isEveningSummaryEnabled: boolean;
  eveningSummaryTime: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  isEveningSummaryEnabled: false,
  eveningSummaryTime: "21:30"
};

export async function getAppSettings(): Promise<AppSettings> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM app_settings");
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    isEveningSummaryEnabled: values.get("isEveningSummaryEnabled") === "true",
    eveningSummaryTime: values.get("eveningSummaryTime") ?? DEFAULT_SETTINGS.eveningSummaryTime
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["isEveningSummaryEnabled", String(settings.isEveningSummaryEnabled)]
  );
  await db.runAsync(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["eveningSummaryTime", settings.eveningSummaryTime]
  );
}
```

- [ ] **Step 4: Persist the AI plan after preview confirmation**

Modify `app/plan-preview.tsx`:

```tsx
import { router, useLocalSearchParams } from "expo-router";
import { Button, Text, View } from "react-native";
import { saveAIHabitPlan } from "../src/ai/habitPlanRepository";
import { AIPlanPreview } from "../src/ai/types";
import { createHabit } from "../src/habits/habitRepository";
import { Screen } from "../src/ui/Screen";
import { todayKey } from "../src/utils/date";

export default function PlanPreviewScreen() {
  const params = useLocalSearchParams<{ plan: string; goalText: string }>();
  const plan = JSON.parse(params.plan) as AIPlanPreview;

  async function savePlan() {
    const habit = await createHabit({
      name: plan.habitName,
      description: plan.description,
      frequency: { type: "daily" },
      reminderTime: plan.recommendedReminderTime,
      isReminderEnabled: true,
      trackType: plan.recommendedTrackType,
      numericUnit: plan.numericUnit
    });

    await saveAIHabitPlan({
      habitId: habit.id,
      goalText: params.goalText,
      startDate: todayKey(),
      preview: plan
    });

    router.replace("/(tabs)/habits");
  }

  return (
    <Screen>
      <Text>{plan.habitName}</Text>
      <Text>{plan.description}</Text>
      <Text>{plan.durationDays} 天计划</Text>
      {plan.dailyActions.map((item) => (
        <View key={item.day}>
          <Text>第 {item.day} 天：{item.action}</Text>
        </View>
      ))}
      <Text>提醒时间：{plan.recommendedReminderTime}</Text>
      <Text>{plan.fallbackAdvice}</Text>
      {plan.safetyNote ? <Text>{plan.safetyNote}</Text> : null}
      <Button title="保存计划" onPress={savePlan} />
    </Screen>
  );
}
```

- [ ] **Step 5: Add numeric check-in input to Today screen**

Modify `app/(tabs)/index.tsx`:

```tsx
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { completeCheckIn, listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { CheckIn } from "../../src/checkins/types";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { Habit } from "../../src/habits/types";
import { EmptyState } from "../../src/ui/EmptyState";
import { HabitRow } from "../../src/ui/HabitRow";
import { ProgressHeader } from "../../src/ui/ProgressHeader";
import { Screen } from "../../src/ui/Screen";
import { todayKey } from "../../src/utils/date";

export default function TodayScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [numericHabit, setNumericHabit] = useState<Habit | null>(null);
  const [numericValue, setNumericValue] = useState("");
  const today = todayKey();

  const load = useCallback(async () => {
    const loadedHabits = await listActiveHabits();
    const loadedCheckIns = (await Promise.all(loadedHabits.map((habit) => listCheckInsForHabit(habit.id)))).flat();
    setHabits(loadedHabits);
    setCheckIns(loadedCheckIns.filter((checkIn) => checkIn.date === today));
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function complete(habit: Habit, value: number | null) {
    await completeCheckIn({ habitId: habit.id, date: today, value, note: null });
    setNumericHabit(null);
    setNumericValue("");
    await load();
  }

  function startComplete(habit: Habit) {
    if (habit.trackType === "numeric") {
      setNumericHabit(habit);
      return;
    }

    complete(habit, null);
  }

  const completedIds = new Set(checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.habitId));

  return (
    <Screen>
      <ProgressHeader completed={completedIds.size} total={habits.length} />
      {numericHabit ? (
        <View style={{ gap: 8, padding: 12, borderRadius: 8, backgroundColor: "#FFFFFF" }}>
          <Text>{numericHabit.name} 完成了多少{numericHabit.numericUnit ?? ""}？</Text>
          <TextInput
            value={numericValue}
            onChangeText={setNumericValue}
            keyboardType="numeric"
            style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
          />
          <Button title="确认打卡" onPress={() => complete(numericHabit, Number(numericValue))} disabled={!numericValue} />
          <Button title="取消" onPress={() => setNumericHabit(null)} />
        </View>
      ) : null}
      {habits.length === 0 ? (
        <>
          <EmptyState title="还没有习惯" body="先创建一个想坚持的小习惯。" />
          <Button title="新增习惯" onPress={() => router.push("/habit/new")} />
        </>
      ) : (
        habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            isCompleted={completedIds.has(habit.id)}
            onComplete={() => startComplete(habit)}
            onOpen={() => router.push(`/habit/${habit.id}`)}
          />
        ))
      )}
    </Screen>
  );
}
```

- [ ] **Step 6: Add cancellable evening summary scheduling**

Modify `src/reminders/reminderService.ts` by adding this function:

```ts
let eveningSummaryNotificationId: string | null = null;

export async function rescheduleTodayEveningSummary(input: {
  isEnabled: boolean;
  incompleteNames: string[];
  time: string;
}): Promise<string | null> {
  if (eveningSummaryNotificationId) {
    await Notifications.cancelScheduledNotificationAsync(eveningSummaryNotificationId);
    eveningSummaryNotificationId = null;
  }

  if (!input.isEnabled || input.incompleteNames.length === 0) {
    return null;
  }

  eveningSummaryNotificationId = await scheduleEveningSummary({
    incompleteCount: input.incompleteNames.length,
    incompleteNames: input.incompleteNames,
    time: input.time
  });

  return eveningSummaryNotificationId;
}
```

- [ ] **Step 7: Wire profile settings**

Modify `app/(tabs)/profile.tsx`:

```tsx
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Button, Switch, Text, TextInput, View } from "react-native";
import { AppSettings, getAppSettings, saveAppSettings } from "../../src/settings/settingsRepository";
import { Screen } from "../../src/ui/Screen";

export default function ProfileScreen() {
  const [settings, setSettings] = useState<AppSettings>({
    isEveningSummaryEnabled: false,
    eveningSummaryTime: "21:30"
  });

  useFocusEffect(
    useCallback(() => {
      getAppSettings().then(setSettings);
    }, [])
  );

  async function save(next: AppSettings) {
    setSettings(next);
    await saveAppSettings(next);
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>我的</Text>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>提醒设置</Text>
        <Text>晚间未完成汇总提醒</Text>
        <Switch
          value={settings.isEveningSummaryEnabled}
          onValueChange={(value) => save({ ...settings, isEveningSummaryEnabled: value })}
        />
        <TextInput
          value={settings.eveningSummaryTime}
          onChangeText={(value) => setSettings({ ...settings, eveningSummaryTime: value })}
          style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
        />
        <Button title="保存提醒时间" onPress={() => save(settings)} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>AI 数据使用说明</Text>
        <Text>AI 只接收你输入的目标、基础情况、可投入时间、频率偏好和必要完成统计。</Text>
        <Text>本地完整打卡日志不会发送给 AI。AI 建议不会自动修改你的习惯设置。</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>隐私策略</Text>
        <Text>首版数据优先保存在本机，不强制登录，也不做多设备同步。</Text>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 8: Run tests and smoke test**

Run:

```bash
npm test
npm run ios
```

Expected: tests pass, the mobile app launches, settings screen saves evening summary preferences, numeric habits ask for a value before completion, and AI-created plans are persisted.

- [ ] **Step 9: Commit**

```bash
git add app src
git commit -m "feat: 补齐 V1 打卡和提醒闭环"
```

## Task 9: Add Verification Checklist and Final Verification

**Files:**

- Create: `docs/verification/v1-mvp-checklist.md`

- [ ] **Step 1: Add verification checklist**

Create `docs/verification/v1-mvp-checklist.md`:

```md
# V1 MVP Verification Checklist

- [ ] App launches on iOS simulator or Android emulator through Expo.
- [ ] App launches on a physical device through Expo Go.
- [ ] User can create a habit from AI plan preview.
- [ ] AI failure is shown as an error message and does not crash the app.
- [ ] Today tab lists active habits.
- [ ] User can complete a check-in with one tap.
- [ ] Completed check-in persists after app reload.
- [ ] Habit detail shows current streak and completion rate.
- [ ] Habit reminder permission can be requested.
- [ ] Habit reminder can be scheduled on a real device.
- [ ] Profile tab explains AI data use and local-first privacy.
```

- [ ] **Step 2: Run automated verification**

Run:

```bash
npm test
cd server && npm test && npm run build
```

Expected: all tests and server build pass.

- [ ] **Step 3: Run mobile smoke verification**

Run:

```bash
npm run ios
```

Expected: app launches in the iOS simulator and core navigation works.

Run on a mobile target:

```bash
npm run ios
```

Expected: app launches on simulator or device. Record if local notification behavior requires a physical device.

- [ ] **Step 4: Commit**

```bash
git add docs/verification
git commit -m "docs: 添加 V1 验收清单"
```

## Final Verification Gate

Before claiming V1 implementation complete, run:

```bash
git status --short
npm test
npm run ios
cd server && npm test && npm run build
```

Expected:

- Git status only contains intentional uncommitted changes, or is clean.
- Mobile tests pass.
- Expo mobile app launches in simulator or on a physical device.
- Backend tests pass.
- Backend TypeScript build passes.

Manual verification still required:

- Local notifications should be checked on a real mobile device.
- AI generation should be checked with a real `OPENAI_API_KEY` in `server/.env`.
- Expo mobile networking may require replacing `localhost` with the machine LAN IP when testing on a physical device.

## Plan Self-Review

Spec coverage:

- Multi-habit management is covered by Tasks 2, 3, and 7.
- AI starter plan generation is covered by Tasks 5, 6, and 8.
- AI light adjustment suggestions are covered by Tasks 6 and 7.
- Per-habit fixed reminders and evening summary are covered by Tasks 4 and 8.
- One-tap check-in and numeric check-in input are covered by Tasks 2, 3, 7, and 8.
- Streak and monthly stats are covered by Tasks 2 and 7.
- Local-first persistence is covered by Tasks 3 and 8.
- Privacy copy is covered by Task 8.

Execution notes:

- The initial UI is intentionally functional and plain; visual polish should be handled after the core flows work.
- Evening summary notifications are rescheduled from current app state; real-device verification is required because local notification behavior differs across simulator and physical devices.
- Visual polish is intentionally outside the first implementation pass and should be handled after V1 behavior passes verification.
