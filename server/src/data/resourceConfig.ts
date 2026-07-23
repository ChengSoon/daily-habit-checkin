import type { UploadKind } from "../r2/r2Client.js";
import type { OwnerWritePolicy } from "./ownerWrite.js";

type ColumnKind = "text" | "int" | "real" | "bool" | "json";

export type Column = {
  column: string;
  field: string;
  kind: ColumnKind;
  nullable?: boolean;
  stampAccount?: boolean;
};

export type ResourceConfig = {
  table: string;
  columns: Column[];
  ownerWrite?: OwnerWritePolicy;
  imageKeyColumn?: string;
  imageKind?: UploadKind;
};

export type DataRouterOptions = {
  onChange?: (spaceId: string, resource: string) => void;
};

export const RESOURCES: Record<string, ResourceConfig> = {
  habits: {
    table: "habits",
    columns: [
      { column: "name", field: "name", kind: "text" },
      { column: "description", field: "description", kind: "text", nullable: true },
      { column: "frequency_json", field: "frequencyJson", kind: "text" },
      { column: "reminder_time", field: "reminderTime", kind: "text", nullable: true },
      { column: "is_reminder_enabled", field: "isReminderEnabled", kind: "bool" },
      { column: "is_paused", field: "isPaused", kind: "bool" },
      { column: "track_type", field: "trackType", kind: "text" },
      { column: "numeric_unit", field: "numericUnit", kind: "text", nullable: true },
      { column: "sort_order", field: "sortOrder", kind: "int" },
      { column: "created_at", field: "createdAt", kind: "text" }
    ]
  },
  check_ins: {
    table: "check_ins",
    columns: [
      { column: "habit_id", field: "habitId", kind: "text" },
      { column: "date", field: "date", kind: "text" },
      { column: "status", field: "status", kind: "text" },
      { column: "value", field: "value", kind: "real", nullable: true },
      { column: "note", field: "note", kind: "text", nullable: true },
      { column: "created_by", field: "createdBy", kind: "text", nullable: true, stampAccount: true },
      { column: "created_at", field: "createdAt", kind: "text" }
    ]
  },
  habit_plans: {
    table: "habit_plans",
    columns: [
      { column: "habit_id", field: "habitId", kind: "text" },
      { column: "duration_days", field: "durationDays", kind: "int" },
      { column: "goal_text", field: "goalText", kind: "text" },
      { column: "daily_actions_json", field: "dailyActionsJson", kind: "text" },
      { column: "start_date", field: "startDate", kind: "text" },
      { column: "end_date", field: "endDate", kind: "text" },
      { column: "current_stage", field: "currentStage", kind: "text" },
      { column: "created_by", field: "createdBy", kind: "text" }
    ]
  },
  rewards: {
    table: "rewards",
    ownerWrite: "always",
    imageKeyColumn: "image_key",
    imageKind: "reward",
    columns: [
      { column: "title", field: "title", kind: "text" },
      { column: "description", field: "description", kind: "text", nullable: true },
      { column: "type", field: "type", kind: "text" },
      { column: "price_xp", field: "priceXp", kind: "int" },
      { column: "status", field: "status", kind: "text" },
      { column: "virtual_kind", field: "virtualKind", kind: "text" },
      { column: "inventory_limit", field: "inventoryLimit", kind: "int", nullable: true },
      { column: "image_key", field: "imageKey", kind: "text", nullable: true },
      { column: "created_at", field: "createdAt", kind: "text" },
      { column: "updated_at", field: "updatedAt", kind: "text" }
    ]
  },
  reward_redemptions: {
    table: "reward_redemptions",
    ownerWrite: "onUpdate",
    columns: [
      { column: "reward_id", field: "rewardId", kind: "text" },
      { column: "price_xp", field: "priceXp", kind: "int" },
      { column: "status", field: "status", kind: "text" },
      { column: "created_at", field: "createdAt", kind: "text" },
      { column: "fulfilled_at", field: "fulfilledAt", kind: "text", nullable: true },
      { column: "cancelled_at", field: "cancelledAt", kind: "text", nullable: true },
      { column: "note", field: "note", kind: "text", nullable: true }
    ]
  },
  xp_transactions: {
    table: "xp_transactions",
    columns: [
      { column: "unique_key", field: "uniqueKey", kind: "text" },
      { column: "amount", field: "amount", kind: "int" },
      { column: "type", field: "type", kind: "text" },
      { column: "reason", field: "reason", kind: "text" },
      { column: "habit_id", field: "habitId", kind: "text", nullable: true },
      { column: "check_in_id", field: "checkInId", kind: "text", nullable: true },
      { column: "reward_id", field: "rewardId", kind: "text", nullable: true },
      { column: "redemption_id", field: "redemptionId", kind: "text", nullable: true },
      { column: "date_key", field: "dateKey", kind: "text", nullable: true },
      { column: "created_at", field: "createdAt", kind: "text" }
    ]
  }
};

export const READ_ONLY_RESOURCES = new Set(["check_ins", "reward_redemptions", "xp_transactions"]);

export function toDbValue(kind: ColumnKind, raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (kind === "bool") return raw === true || raw === 1 || raw === "true";
  if (kind === "int") return Math.trunc(Number(raw));
  if (kind === "real") return Number(raw);
  if (kind === "json") return typeof raw === "string" ? raw : JSON.stringify(raw);
  return String(raw);
}

export function fromDbRow(config: ResourceConfig, row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { id: row.id };
  for (const column of config.columns) {
    result[column.field] = row[column.column] === undefined ? null : row[column.column];
  }
  return result;
}
