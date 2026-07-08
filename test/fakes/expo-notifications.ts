type NotificationHandler = {
  handleNotification(): Promise<{
    shouldShowBanner: boolean;
    shouldShowList: boolean;
    shouldPlaySound: boolean;
    shouldSetBadge: boolean;
  }>;
};

type NotificationRequestInput = {
  identifier?: string;
  content: {
    title?: string | null;
    body?: string | null;
    data?: Record<string, unknown>;
  };
  trigger: Record<string, unknown>;
};

export const SchedulableTriggerInputTypes = {
  CALENDAR: "calendar",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
  DATE: "date",
  TIME_INTERVAL: "timeInterval"
} as const;

export const AndroidImportance = {
  DEFAULT: 5,
  HIGH: 6
} as const;

let handler: NotificationHandler | null = null;
let scheduledCount = 0;
let scheduledRequests: Array<{
  identifier: string;
  content: NotificationRequestInput["content"];
  trigger: NotificationRequestInput["trigger"];
}> = [];

export function setNotificationHandler(nextHandler: NotificationHandler): void {
  handler = nextHandler;
}

export async function setNotificationChannelAsync(): Promise<null> {
  return null;
}

export async function getPermissionsAsync(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  return { granted: true, canAskAgain: true };
}

export async function requestPermissionsAsync(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  return { granted: true, canAskAgain: true };
}

export async function scheduleNotificationAsync(request: NotificationRequestInput): Promise<string> {
  scheduledCount += 1;
  const identifier = request.identifier ?? `notification-${scheduledCount}`;
  scheduledRequests.push({
    identifier,
    content: request.content,
    trigger: request.trigger
  });
  return identifier;
}

export async function getAllScheduledNotificationsAsync(): Promise<typeof scheduledRequests> {
  return [...scheduledRequests];
}

export async function cancelScheduledNotificationAsync(identifier: string): Promise<void> {
  scheduledRequests = scheduledRequests.filter((request) => request.identifier !== identifier);
}

export function getConfiguredHandlerForTests(): NotificationHandler | null {
  return handler;
}

export function getScheduledNotificationsForTests(): typeof scheduledRequests {
  return [...scheduledRequests];
}

export function resetNotificationsForTests(): void {
  handler = null;
  scheduledCount = 0;
  scheduledRequests = [];
}
