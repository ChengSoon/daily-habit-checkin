import { listResource, upsertResource } from "../sync/dataClient";
import { addDays } from "../utils/date";
import { createId } from "../utils/id";
import { AIPlanDay, AIPlanPreview, HabitPlan } from "./types";

type HabitPlanDto = {
  id: string;
  habitId: string;
  durationDays: number;
  goalText: string;
  dailyActionsJson: string;
  startDate: string;
  endDate: string;
  currentStage: string;
  createdBy: "ai" | "manual";
};

function mapDto(dto: HabitPlanDto): HabitPlan {
  return {
    id: dto.id,
    habitId: dto.habitId,
    durationDays: dto.durationDays as HabitPlan["durationDays"],
    goalText: dto.goalText,
    dailyActions: JSON.parse(dto.dailyActionsJson) as AIPlanDay[],
    startDate: dto.startDate,
    endDate: dto.endDate,
    currentStage: dto.currentStage,
    createdBy: dto.createdBy
  };
}

export async function saveAIHabitPlan(input: {
  habitId: string;
  goalText: string;
  startDate: string;
  preview: AIPlanPreview;
}): Promise<HabitPlan> {
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

  await upsertResource<HabitPlanDto>("habit_plans", plan.id, {
    habitId: plan.habitId,
    durationDays: plan.durationDays,
    goalText: plan.goalText,
    dailyActionsJson: JSON.stringify(plan.dailyActions),
    startDate: plan.startDate,
    endDate: plan.endDate,
    currentStage: plan.currentStage,
    createdBy: plan.createdBy
  });

  return plan;
}

export async function getPlanForHabit(habitId: string): Promise<HabitPlan | null> {
  const rows = await listResource<HabitPlanDto>("habit_plans");
  const plans = rows
    .filter((row) => row.habitId === habitId)
    .sort((left, right) => right.startDate.localeCompare(left.startDate));

  return plans[0] ? mapDto(plans[0]) : null;
}
