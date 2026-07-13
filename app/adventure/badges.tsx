import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import {
  buildBadgeWallItems,
  fulfillmentLabel,
  fulfillmentTone,
  selectPendingClaims
} from "../../src/adventure/badgeWall";
import { loadAdventureState } from "../../src/adventure/adventureService";
import type { AdventureState } from "../../src/adventure/types";
import { publicUrl } from "../../src/sync/publicUrl";
import { AppButton, AppText, Badge, Card } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { RewardThumb } from "../../src/ui/RewardImage";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { radius, spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";

export default function AdventureBadgesScreen() {
  const { colors } = useTheme();
  const [state, setState] = useState<AdventureState | null>(null);

  const load = useCallback(async () => {
    setState(await loadAdventureState());
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);

  const items = useMemo(() => (state ? buildBadgeWallItems(state) : []), [state]);
  const pending = useMemo(() => (state ? selectPendingClaims(state) : []), [state]);
  const claimedCount = items.filter((item) => item.kind === "claimed").length;

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  if (!state) {
    return <SyncFallback status="loading" errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
        <AppText variant="display">徽章收藏</AppText>
        <AppText variant="caption" tone="muted" style={{ textTransform: "none", letterSpacing: 0 }}>
          已获 {claimedCount} / {items.length} · 累计 {state.lifetimeEarned} XP
        </AppText>
      </View>

      {pending.length > 0 ? (
        <Card style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
          <AppText variant="section">待兑现惊喜</AppText>
          {pending.map((claim) => (
            <Pressable
              key={claim.id}
              onPress={() =>
                router.push({ pathname: "/adventure/[chapterId]", params: { chapterId: claim.chapterId } })
              }
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.sm,
                opacity: pressed ? 0.88 : 1
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">
                  {claim.badgeEmoji ?? "🎁"} {claim.badgeName}
                </AppText>
                <AppText variant="caption" tone="muted" style={{ textTransform: "none" }}>
                  {claim.chapterTitle}
                </AppText>
              </View>
              <Badge label="待兑现" tone="primary" />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {claimedCount === 0 ? (
        <Card>
          <EmptyState title="还没有徽章" body="去地图点亮第一座岛，读完故事就能领取。" icon="ribbon-outline" />
          <AppButton title="打开世界地图" onPress={() => router.push("/adventure/map")} />
        </Card>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: spacing.sm,
          marginTop: claimedCount === 0 ? spacing.sm : 0
        }}
      >
        {items.map((item) => {
          const claimed = item.kind === "claimed";
          const label = fulfillmentLabel(item.fulfillmentStatus);
          const tone = fulfillmentTone(item.fulfillmentStatus);
          return (
            <Pressable
              key={item.chapterId}
              onPress={() =>
                router.push({
                  pathname: "/adventure/[chapterId]",
                  params: { chapterId: item.chapterId }
                })
              }
              style={({ pressed }) => ({
                width: "48%",
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor:
                  item.viewStatus === "claimable"
                    ? colors.primary
                    : claimed
                      ? colors.line
                      : colors.line,
                backgroundColor: claimed ? colors.surface : colors.surfaceMuted,
                padding: spacing.sm,
                gap: 6,
                opacity: pressed ? 0.9 : claimed ? 1 : 0.72,
                minHeight: 148
              })}
            >
              <View style={{ alignItems: "center", gap: 6 }}>
                {item.badgeImageKey ? (
                  <RewardThumb
                    uri={publicUrl(item.badgeImageKey)}
                    type={item.rewardType === "real_pending" ? "real_world" : "virtual"}
                    size={56}
                  />
                ) : (
                  <AppText style={{ fontSize: claimed ? 36 : 30, lineHeight: 42, opacity: claimed ? 1 : 0.55 }}>
                    {claimed ? item.badgeEmoji?.trim() || "🏅" : item.viewStatus === "claimable" ? "✨" : "🔒"}
                  </AppText>
                )}
                <AppText variant="small" numberOfLines={1} style={{ fontWeight: "700", textAlign: "center" }}>
                  {item.badgeName}
                </AppText>
                <AppText
                  variant="caption"
                  tone="muted"
                  numberOfLines={1}
                  style={{ textTransform: "none", letterSpacing: 0, textAlign: "center" }}
                >
                  {item.chapterTitle}
                </AppText>
                {label ? <Badge label={label} tone={tone} /> : null}
                {!claimed && item.viewStatus === "claimable" ? (
                  <Badge label="可领取" tone="primary" />
                ) : null}
                {!claimed && item.viewStatus === "locked" ? (
                  <AppText variant="caption" tone="muted" style={{ textAlign: "center", textTransform: "none" }}>
                    未解锁
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
