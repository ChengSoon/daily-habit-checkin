type EventSubscription = { remove(): void };

export type GetuiNativeModule = {
  initialize(): Promise<void>;
  getClientId(): Promise<string | null>;
  addListener(
    eventName: "onClientId",
    listener: (event: { clientId?: string }) => void
  ): EventSubscription;
};

function normalizeClientId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length >= 10 ? normalized : null;
}

function loadGetuiModule(): GetuiNativeModule {
  // 动态加载，避免 Web 和 Vitest 在模块初始化阶段访问原生运行时。
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { requireNativeModule } = require("expo-modules-core") as {
    requireNativeModule<T>(name: string): T;
  };
  return requireNativeModule<GetuiNativeModule>("Getui");
}

export function waitForGetuiClientId(
  nativeModule: GetuiNativeModule,
  timeoutMs = 15_000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (clientId: string | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription.remove();
      if (clientId) resolve(clientId);
      else reject(error ?? new Error("个推 CID 获取失败"));
    };
    const subscription = nativeModule.addListener("onClientId", (event) => {
      const clientId = normalizeClientId(event.clientId);
      if (clientId) finish(clientId);
    });
    const timeout = setTimeout(() => finish(null, new Error("个推 CID 获取超时")), timeoutMs);
    void nativeModule.getClientId()
      .then((value) => {
        const clientId = normalizeClientId(value);
        if (clientId) finish(clientId);
      })
      .catch((error) => finish(null, error instanceof Error ? error : new Error(String(error))));
  });
}

export async function getGetuiClientId(): Promise<string> {
  const nativeModule = loadGetuiModule();
  await nativeModule.initialize();
  return waitForGetuiClientId(nativeModule);
}
