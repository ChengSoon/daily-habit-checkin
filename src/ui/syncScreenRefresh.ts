export type SyncScreenOptions = {
  refreshOnForeground?: boolean;
  refreshOnRemoteChange?: boolean;
};

export type NormalizedSyncScreenOptions = {
  refreshOnForeground: boolean;
  refreshOnRemoteChange: boolean;
};

export function normalizeSyncScreenOptions(options: SyncScreenOptions = {}): NormalizedSyncScreenOptions {
  return {
    refreshOnForeground: options.refreshOnForeground ?? true,
    refreshOnRemoteChange: options.refreshOnRemoteChange ?? true
  };
}

export function shouldRunSyncRefresh(appState: string): boolean {
  return appState === "active";
}
