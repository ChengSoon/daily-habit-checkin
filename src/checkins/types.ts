export type CheckInStatus = "completed" | "skipped" | "missed";

export type CheckIn = {
  id: string;
  habitId: string;
  date: string;
  status: CheckInStatus;
  value: number | null;
  note: string | null;
  createdAt: string;
  /** 完成这条打卡的账号 ID，由服务端盖章。旧数据或单人时可能为 null。 */
  createdBy: string | null;
};
