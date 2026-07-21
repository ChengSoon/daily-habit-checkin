import { listAllCheckIns } from "../checkins/checkinRepository";
import { getAppSettings } from "../settings/settingsRepository";
import { companionClient } from "./companionClient";

export async function loadCompanionBootstrap() {
  const [settings, companionState, checkIns] = await Promise.all([
    getAppSettings().catch(() => null),
    companionClient.getState().catch(() => null),
    listAllCheckIns().catch(() => null)
  ]);

  return {
    quietHours: settings
      ? {
          isEnabled: settings.isQuietHoursEnabled,
          start: settings.quietHoursStart,
          end: settings.quietHoursEnd
        }
      : undefined,
    companionState,
    checkIns
  };
}
