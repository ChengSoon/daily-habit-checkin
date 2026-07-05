export type ReminderSetting = {
  habitId: string;
  habitReminderTime: string | null;
  isHabitReminderEnabled: boolean;
  isEveningSummaryEnabled: boolean;
  eveningSummaryTime: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};
