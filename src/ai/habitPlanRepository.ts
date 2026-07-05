import { getDatabase } from "../db/database";
import { addDays } from "../utils/date";
import { createId } from "../utils/id";
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
