import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, AppState, Easing, StyleSheet, View } from "react-native";
import { UnauthorizedError } from "../sync/apiClient";
import { subscribeSyncInvalidations } from "../sync/syncInvalidation";
import { AppButton, AppText } from "./Controls";
import { EmptyState } from "./EmptyState";
import { Screen } from "./Screen";
import { useTheme } from "./ThemeContext";
import {
  createQueuedAsyncRunner,
  normalizeSyncScreenOptions,
  shouldRunSyncRefresh,
  SyncScreenOptions
} from "./syncScreenRefresh";

export type SyncStatus = "loading" | "ready" | "unauthenticated" | "error";
const LOADING_FADE_MS = 220;
const UNAUTHENTICATED_ACTION_BOTTOM_GAP = 64;

function useLoadingAnimation() {
  const [loop] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: LOADING_FADE_MS,
      easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const orbit = Animated.loop(Animated.timing(loop, {
      toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true
    }));
    const heartbeat = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700,
        easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900,
        easing: Easing.inOut(Easing.quad), useNativeDriver: true })
    ]));
    orbit.start();
    heartbeat.start();
    return () => {
      fade.stopAnimation();
      orbit.stop();
      heartbeat.stop();
    };
  }, [fade, loop, pulse]);
  return {
    fade,
    firstOrbit: loop.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }),
    secondOrbit: loop.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "540deg"] }),
    stampScale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
    glowScale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.16] }),
    glowOpacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.34] })
  };
}

/** 数据页统一四态加载；首次进入显示加载中，refocus 时静默刷新。 */
export function useSyncScreen(loader: () => Promise<void>, options: SyncScreenOptions = {}) {
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { refreshOnForeground, refreshOnRemoteChange } = normalizeSyncScreenOptions(options);

  const runOnce = useCallback(async () => {
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
  }, [loader]);
  const run = useMemo(() => createQueuedAsyncRunner(runOnce), [runOnce]);

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

function LoadingFallback() {
  const { colors } = useTheme();
  const animation = useLoadingAnimation();
  return (
    <Screen scroll={false}>
      <View style={styles.loadingScene}>
        <Animated.View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="正在连接小岛"
          style={[styles.loadingMark, { opacity: animation.fade }]}
        >
          <View style={styles.orbitStage}>
            <Animated.View
              style={[
                styles.glow,
                {
                  backgroundColor: colors.surfaceTint,
                  opacity: animation.glowOpacity,
                  transform: [{ scale: animation.glowScale }]
                }
              ]}
            />
            <Animated.View style={[styles.stamp, { transform: [{ scale: animation.stampScale }] }]}>
              <View style={[styles.stampPlate, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                <Ionicons name="leaf" size={36} color={colors.onPrimary} />
              </View>
              <View style={[styles.stampBadge, { backgroundColor: colors.celebration }]}>
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              </View>
            </Animated.View>
            <Animated.View style={[styles.orbit, { transform: [{ rotate: animation.firstOrbit }] }]}>
              <View style={[styles.planet, { backgroundColor: colors.primary }]} />
            </Animated.View>
            <Animated.View style={[styles.orbit, { transform: [{ rotate: animation.secondOrbit }] }]}>
              <View style={[styles.planet, styles.partnerPlanet, { backgroundColor: colors.partner }]} />
            </Animated.View>
          </View>
          <View style={styles.loadingCopy}>
            <AppText variant="section" style={{ textAlign: "center" }}>正在连接小岛</AppText>
            <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
              同步习惯、积分与奖励中
            </AppText>
          </View>
        </Animated.View>
      </View>
    </Screen>
  );
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
    return <LoadingFallback />;
  }

  if (status === "unauthenticated") {
    return (
      <Screen>
        <EmptyState
          fill
          icon="lock-closed-outline"
          title="先登录小岛"
          body="登录后，你和另一半的习惯、积分与奖励会实时同步。"
        />
        <AppButton title="登录 / 注册" icon="log-in-outline" style={{ marginBottom: UNAUTHENTICATED_ACTION_BOTTOM_GAP }} onPress={() => router.push("/account")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <EmptyState
        fill
        icon="cloud-offline-outline"
        title="小岛暂时失联"
        body={errorMessage ?? "无法连接服务器，请检查网络后重试。"}
      />
      <AppButton title="重新连接" icon="refresh-outline" onPress={onRetry} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingScene: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32
  },
  loadingMark: {
    width: "100%",
    maxWidth: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: 18
  },
  loadingCopy: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16
  },
  orbitStage: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center"
  },
  glow: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59
  },
  stamp: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center"
  },
  stampPlate: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  },
  stampBadge: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 3,
    borderColor: "#FFFFFF"
  },
  orbit: {
    position: "absolute",
    width: 134,
    height: 134,
    borderRadius: 67
  },
  planet: {
    position: "absolute",
    top: 7,
    left: 59,
    width: 16,
    height: 16,
    borderRadius: 8
  },
  partnerPlanet: {
    width: 13,
    height: 13,
    borderRadius: 7,
    top: 8,
    left: 60
  }
});
