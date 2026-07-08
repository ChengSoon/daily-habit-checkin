import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { UnauthorizedError } from "../sync/apiClient";
import { subscribeSyncInvalidations } from "../sync/syncInvalidation";
import { AppButton, AppText } from "./Controls";
import { EmptyState } from "./EmptyState";
import { Screen } from "./Screen";
import { normalizeSyncScreenOptions, shouldRunSyncRefresh, SyncScreenOptions } from "./syncScreenRefresh";

export type SyncStatus = "loading" | "ready" | "unauthenticated" | "error";

/**
 * 数据页统一的四态加载：把云端 load 包起来，区分「未登录 / 加载失败 / 加载中 / 就绪」。
 * 未登录会引导去登录，加载失败可重试——避免未处理的 UnauthorizedError 直接崩掉页面。
 *
 * 首次进入才显示「加载中」，refocus 时静默刷新，不闪 loading。
 */
export function useSyncScreen(loader: () => Promise<void>, options: SyncScreenOptions = {}) {
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const { refreshOnForeground, refreshOnRemoteChange } = normalizeSyncScreenOptions(options);

  const run = useCallback(async () => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const task = (async () => {
      try {
        await loader();
        setErrorMessage(null);
        setStatus("ready");
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          setStatus("unauthenticated");
        } else {
          setErrorMessage(error instanceof Error ? error.message : "加载失败");
          setStatus("error");
        }
      }
    })();

    inFlightRef.current = task;
    void task.finally(() => {
      if (inFlightRef.current === task) {
        inFlightRef.current = null;
      }
    });

    return task;
  }, [loader]);

  useFocusEffect(
    useCallback(() => {
      void run();

      const subscription = refreshOnForeground
        ? AppState.addEventListener("change", (nextState) => {
            if (shouldRunSyncRefresh(nextState)) {
              void run();
            }
          })
        : null;
      const unsubscribeInvalidations = refreshOnRemoteChange
        ? subscribeSyncInvalidations(() => {
            if (shouldRunSyncRefresh(AppState.currentState)) {
              void run();
            }
          })
        : null;

      return () => {
        subscription?.remove();
        unsubscribeInvalidations?.();
      };
    }, [refreshOnForeground, refreshOnRemoteChange, run])
  );

  return { status, errorMessage, reload: run };
}

/** 非 ready 状态时渲染的占位屏：登录引导 / 加载失败重试 / 加载中。 */
export function SyncFallback({
  status,
  errorMessage,
  onRetry
}: {
  status: Exclude<SyncStatus, "ready">;
  errorMessage?: string | null;
  onRetry: () => void;
}) {
  if (status === "loading") {
    return (
      <Screen>
        <AppText variant="body" tone="muted">
          加载中…
        </AppText>
      </Screen>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="请先登录"
          body="登录后同步你和另一半的习惯、积分和奖励。"
        />
        <AppButton title="登录 / 注册" icon="log-in-outline" onPress={() => router.push("/account")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <EmptyState
        icon="cloud-offline-outline"
        title="加载失败"
        body={errorMessage ?? "无法连接服务器，请检查网络后重试。"}
      />
      <AppButton title="重试" onPress={onRetry} />
    </Screen>
  );
}
