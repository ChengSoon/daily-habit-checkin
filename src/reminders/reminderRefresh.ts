import { getAuthToken } from "../sync/localSettings";
import { refreshScheduledReminders } from "./reminderService";

/** App 生命周期触发的刷新仅在已登录时访问云端数据。 */
export async function refreshAuthenticatedReminders(now?: Date): Promise<void> {
  if (!(await getAuthToken())) return;
  try {
    await refreshScheduledReminders(now);
  } catch (error) {
    if (isUnauthorizedError(error)) return;
    throw error;
  }
}

function isUnauthorizedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 401
  );
}
