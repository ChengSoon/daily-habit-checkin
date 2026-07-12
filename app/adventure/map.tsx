import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { loadAdventureState } from "../../src/adventure/adventureService";
import type { AdventureChapterView, AdventureState } from "../../src/adventure/types";
import { AppText, Card } from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { radius, spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";

function statusLabel(chapter: AdventureChapterView): string {
  if (chapter.viewStatus === "claimed") return "已领取";
  if (chapter.viewStatus === "claimable") return "可领取";
  return `锁定 · ${chapter.thresholdLifetimeXp} XP`;
}

export default function AdventureMapScreen() {
  const { colors } = useTheme();
  const [state, setState] = useState<AdventureState | null>(null);

  const load = useCallback(async () => {
    setState(await loadAdventureState());
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  if (!state) {
    return <SyncFallback status="loading" errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen scroll>
      <Card style={{ marginBottom: spacing.md, gap: 4 }}>
        <AppText variant="section">世界地图</AppText>
        <AppText variant="caption" tone="muted">
          累计 {state.lifetimeEarned} XP · 可领取 {state.claimableCount}
        </AppText>
      </Card>

      <View style={{ alignItems: "center", gap: 0 }}>
        {state.chapters.map((chapter, index) => {
          const unlocked = chapter.viewStatus !== "locked";
          const claimable = chapter.viewStatus === "claimable";
          const claimed = chapter.viewStatus === "claimed";
          const nodeColor = claimed
            ? colors.primary
            : claimable
              ? colors.celebration
              : colors.line;
          const textOpacity = unlocked ? 1 : 0.55;

          return (
            <View key={chapter.id} style={{ width: "100%", alignItems: "center" }}>
              {index > 0 ? (
                <View
                  style={{
                    width: 3,
                    height: 28,
                    backgroundColor: unlocked ? colors.primary : colors.line
                  }}
                />
              ) : null}
              <Pressable
                onPress={() => router.push(`/adventure/${chapter.id}`)}
                style={{
                  width: "100%",
                  borderRadius: radius.lg,
                  borderWidth: claimable ? 2 : 1,
                  borderColor: claimable ? colors.primary : colors.line,
                  backgroundColor: colors.surface,
                  padding: spacing.md,
                  opacity: textOpacity
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: nodeColor
                    }}
                  >
                    <AppText variant="title">
                      {chapter.badgeEmoji ?? String(chapter.sortOrder)}
                    </AppText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong">
                      第 {chapter.sortOrder} 章 · {chapter.title}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {chapter.subtitle ?? statusLabel(chapter)}
                    </AppText>
                    <AppText variant="caption" tone={claimable ? "primary" : "muted"}>
                      {statusLabel(chapter)}
                    </AppText>
                  </View>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
