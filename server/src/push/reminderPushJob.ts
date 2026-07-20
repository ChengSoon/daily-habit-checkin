import { randomUUID } from "node:crypto";
import { query, queryOne } from "../db/pool.js";
import { deleteTokens, listTokensForSpace } from "./pushTokenRepository.js";
import { isGetuiConfigured, sendGetuiToCids } from "./getuiClient.js";

type HabitRow = {
  id: string;
  space_id: string;
  name: string;
  reminder_time: string | null;
  is_reminder_enabled: boolean;
  is_paused: boolean;
  frequency_json: string;
};

function shanghaiNowParts(now = new Date()): { dateKey: string; hhmm: string; dayOfWeek: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short"
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const hhmm = `${hour}:${parts.minute}`;
  // weekday: Mon..Sun -> 1..0 matching JS getDay for Shanghai is easier via dateKey
  const local = new Date(`${dateKey}T12:00:00+08:00`);
  return { dateKey, hhmm, dayOfWeek: local.getDay() };
}

function shouldRunToday(frequencyJson: string, dayOfWeek: number): boolean {
  try {
    const frequency = JSON.parse(frequencyJson) as {
      type?: string;
      daysOfWeek?: number[];
    };
    if (!frequency || frequency.type === "daily") {
      return true;
    }
    if (frequency.type === "weekdays") {
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    }
    if (frequency.type === "weekly" && Array.isArray(frequency.daysOfWeek)) {
      return frequency.daysOfWeek.includes(dayOfWeek);
    }
    return true;
  } catch {
    return true;
  }
}

async function alreadySent(input: {
  accountId: string;
  habitId: string;
  dateKey: string;
  kind: string;
}): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM push_send_log
     WHERE account_id = $1 AND habit_id = $2 AND date_key = $3 AND kind = $4`,
    [input.accountId, input.habitId, input.dateKey, input.kind]
  );
  return Boolean(row);
}

async function markSent(input: {
  accountId: string;
  habitId: string;
  dateKey: string;
  kind: string;
}): Promise<void> {
  const id = `psl_${randomUUID().replaceAll("-", "")}`;
  await query(
    `INSERT INTO push_send_log (id, account_id, habit_id, date_key, kind)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (account_id, habit_id, date_key, kind) DO NOTHING`,
    [id, input.accountId, input.habitId, input.dateKey, input.kind]
  );
}

async function isCompletedToday(habitId: string, spaceId: string, dateKey: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM check_ins
     WHERE habit_id = $1 AND space_id = $2 AND date = $3 AND status = 'completed'
     LIMIT 1`,
    [habitId, spaceId, dateKey]
  );
  return Boolean(row);
}

/**
 * 每分钟扫一次：当前上海时间 HH:mm 命中的习惯，给同空间已登记设备走个推。
 */
export async function runHabitReminderPushTick(now = new Date()): Promise<{
  matchedHabits: number;
  sent: number;
  failed: number;
}> {
  if (!isGetuiConfigured()) {
    return { matchedHabits: 0, sent: 0, failed: 0 };
  }

  const { dateKey, hhmm, dayOfWeek } = shanghaiNowParts(now);
  const habits = await query<HabitRow>(
    `SELECT id, space_id, name, reminder_time, is_reminder_enabled, is_paused, frequency_json
     FROM habits
     WHERE is_reminder_enabled = true
       AND is_paused = false
       AND reminder_time = $1`,
    [hhmm]
  );

  let sent = 0;
  let failed = 0;
  let matchedHabits = 0;

  for (const habit of habits) {
    if (!shouldRunToday(habit.frequency_json, dayOfWeek)) {
      continue;
    }
    if (await isCompletedToday(habit.id, habit.space_id, dateKey)) {
      continue;
    }

    matchedHabits += 1;
    const devices = await listTokensForSpace(habit.space_id);
    if (devices.length === 0) {
      continue;
    }

    // 按账号去重发送，避免同一账号多设备重复记 log 出问题；设备仍全部推
    const accountIds = [...new Set(devices.map((d) => d.accountId))];
    const accountsToNotify: string[] = [];
    for (const accountId of accountIds) {
      const done = await alreadySent({
        accountId,
        habitId: habit.id,
        dateKey,
        kind: "habit"
      });
      if (!done) {
        accountsToNotify.push(accountId);
      }
    }
    if (accountsToNotify.length === 0) {
      continue;
    }

    const tokens = devices.filter((d) => accountsToNotify.includes(d.accountId)).map((d) => d.token);
    const result = await sendGetuiToCids(tokens, {
      title: `该打卡了：${habit.name}`,
      body: "完成后点一下，今天就算坚持住了。",
      data: {
        habitId: habit.id,
        dateKey,
        kind: "habit"
      }
    });

    sent += result.successCount;
    failed += result.failureCount;
    if (result.invalidTokens.length > 0) {
      await deleteTokens(result.invalidTokens);
    }

    for (const accountId of accountsToNotify) {
      await markSent({
        accountId,
        habitId: habit.id,
        dateKey,
        kind: "habit"
      });
    }
  }

  return { matchedHabits, sent, failed };
}

export function startHabitReminderPushScheduler(): void {
  if (process.env.GETUI_PUSH_SCHEDULER === "0") {
    console.log("个推提醒调度已关闭（GETUI_PUSH_SCHEDULER=0）");
    return;
  }
  if (!isGetuiConfigured()) {
    console.warn("个推未配置，跳过习惯提醒推送调度");
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL 未设置，跳过习惯提醒推送调度（先起 Postgres）");
    return;
  }

  const tickMs = Number(process.env.GETUI_PUSH_TICK_MS ?? 30_000);
  console.log(`个推习惯提醒调度已启动（每 ${tickMs}ms）`);

  let lastDbErrorLogAt = 0;

  const run = () => {
    void runHabitReminderPushTick()
      .then((summary) => {
        if (summary.matchedHabits > 0 || summary.sent > 0) {
          console.log(
            `Getui tick: habits=${summary.matchedHabits} sent=${summary.sent} failed=${summary.failed}`
          );
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        const isDbDown =
          message.includes("ECONNREFUSED") ||
          (typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === "ECONNREFUSED");
        const now = Date.now();
        // 数据库未启动时不要每 30 秒刷整段 stack
        if (isDbDown) {
          if (now - lastDbErrorLogAt > 60_000) {
            lastDbErrorLogAt = now;
            console.warn("Getui tick 跳过：Postgres 连不上（请先 docker 起 db，或检查 DATABASE_URL）");
          }
          return;
        }
        console.warn("Getui tick 失败", error);
      });
  };

  // 启动后稍晚跑一次，再按间隔
  setTimeout(run, 5_000);
  setInterval(run, Math.max(15_000, tickMs));
}
