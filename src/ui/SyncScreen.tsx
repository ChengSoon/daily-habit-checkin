import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, AppState, Easing, StyleSheet, View } from "react-native";
import { UnauthorizedError } from "../sync/apiClient";
import { subscribeSyncInvalidations } from "../sync/syncInvalidation";
import { AppButton } from "./Controls";
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
const LOADING_REVEAL_DELAY_MS = 320;
const LOADING_FADE_MS = 180;

/**
 * 数据页统一的四态加载：把云端 load 包起来，区分「未登录 / 加载失败 / 加载中 / 就绪」。
 * 未登录会引导去登录，加载失败可重试——避免未处理的 UnauthorizedError 直接崩掉页面。
 *
 * 首次进入才显示「加载中」，refocus 时静默刷新，不闪 loading。
 */
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
  const [loop] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAnimation(true);
      Animated.timing(fade, {
        toValue: 1,
        duration: LOADING_FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }).start();
    }, LOADING_REVEAL_DELAY_MS);

    return () => {
      clearTimeout(timer);
      fade.stopAnimation();
    };
  }, [fade]);

  useEffect(() => {
    if (!showAnimation) {
      return;
    }

    const orbit = Animated.loop(
      Animated.timing(loop, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    const heartbeat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    orbit.start();
    heartbeat.start();

    return () => {
      orbit.stop();
      heartbeat.stop();
    };
  }, [loop, pulse, showAnimation]);

  const firstOrbit = loop.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const secondOrbit = loop.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "540deg"] });
  const stampScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.16] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.34] });

  return (
    <Screen scroll={false}>
      <View style={styles.loadingScene}>
        {showAnimation ? (
          <Animated.View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="正在连接小岛"
            style={[styles.loadingMark, { opacity: fade }]}
          >
            <View style={styles.orbitStage}>
              <Animated.View
                style={[
                  styles.glow,
                  {
                    backgroundColor: colors.surfaceTint,
                    opacity: glowOpacity,
                    transform: [{ scale: glowScale }]
                  }
                ]}
              />
              <Animated.View style={[styles.stamp, { transform: [{ scale: stampScale }] }]}>
                <View style={[styles.stampPlate, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                  <Ionicons name="calendar" size={34} color={colors.onPrimary} />
                </View>
                <View style={[styles.stampBadge, { backgroundColor: colors.celebration }]}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
              </Animated.View>
              <Animated.View style={[styles.orbit, { transform: [{ rotate: firstOrbit }] }]}>
                <View style={[styles.planet, { backgroundColor: colors.primary }]} />
              </Animated.View>
              <Animated.View style={[styles.orbit, { transform: [{ rotate: secondOrbit }] }]}>
                <View style={[styles.planet, styles.partnerPlanet, { backgroundColor: colors.partner }]} />
              </Animated.View>
            </View>
          </Animated.View>
        ) : null}
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
          icon="lock-closed-outline"
          title="先登录小岛"
          body="登录后，你和另一半的习惯、积分与奖励会实时同步。"
        />
        <AppButton title="登录 / 注册" icon="log-in-outline" onPress={() => router.push("/account")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <EmptyState
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
    width: 176,
    height: 176,
    alignItems: "center",
    justifyContent: "center"
  },
  orbitStage: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
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
