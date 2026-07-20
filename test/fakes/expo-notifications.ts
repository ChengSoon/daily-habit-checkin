type NotificationHandler = {
  handleNotification(notification: {
    request: {
      content: NotificationRequestInput["content"];
    };
  }): Promise<{
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
    sound?: boolean | string | null;
    priority?: string | null;
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
  HIGH: 6,
  MAX: 7
} as const;

export const AndroidNotificationPriority = {
  MIN: "min",
  LOW: "low",
  DEFAULT: "default",
  HIGH: "high",
  MAX: "max"
} as const;

export const AndroidNotificationVisibility = {
  UNKNOWN: 0,
  PUBLIC: 1,
  PRIVATE: 2,
  SECRET: 3
} as const;

export const AndroidAudioUsage = {
  ALARM: 4,
  NOTIFICATION: 5
} as const;

export const AndroidAudioContentType = {
  SONIFICATION: 4
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
