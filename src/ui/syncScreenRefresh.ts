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

export function createQueuedAsyncRunner(runOnce: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  let needsRerun = false;

  async function runLoop(): Promise<void> {
    do {
      needsRerun = false;
      await runOnce();
    } while (needsRerun);
  }

  return () => {
    if (inFlight) {
      needsRerun = true;
      return inFlight;
    }

    inFlight = runLoop().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
