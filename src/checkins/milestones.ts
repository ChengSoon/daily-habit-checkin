/**
 * 连续打卡的里程碑天数。从 7 天起步：太早的全屏庆祝反而廉价，
 * 前几天靠打卡按钮的轻量动画维持反馈。
 */
export const STREAK_MILESTONES = [7, 14, 21, 30, 60, 100, 180, 365] as const;

export function getStreakMilestone(streak: number): number | null {
  return (STREAK_MILESTONES as readonly number[]).includes(streak) ? streak : null;
}
