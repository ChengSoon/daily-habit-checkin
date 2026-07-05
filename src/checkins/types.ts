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
