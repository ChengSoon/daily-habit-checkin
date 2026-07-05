type NotificationHandler = {
  handleNotification(): Promise<{
    shouldShowBanner: boolean;
    shouldShowList: boolean;
    shouldPlaySound: boolean;
    shouldSetBadge: boolean;
  }>;
};

export const SchedulableTriggerInputTypes = {
  DAILY: "daily",
  DATE: "date"
} as const;

let handler: NotificationHandler | null = null;
let scheduledCount = 0;

export function setNotificationHandler(nextHandler: NotificationHandler): void {
  handler = nextHandler;
}

export async function getPermissionsAsync(): Promise<{ granted: boolean }> {
  return { granted: true };
}

export async function requestPermissionsAsync(): Promise<{ granted: boolean }> {
  return { granted: true };
}

export async function scheduleNotificationAsync(): Promise<string> {
  scheduledCount += 1;
  return `notification-${scheduledCount}`;
}

export async function cancelScheduledNotificationAsync(): Promise<void> {
  scheduledCount = Math.max(0, scheduledCount - 1);
}

export function getConfiguredHandlerForTests(): NotificationHandler | null {
  return handler;
}
