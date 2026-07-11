import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { publicUrl } from "../sync/publicUrl";
import { AppText, Card, IconButton } from "../ui/Controls";
import { radius, spacing } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import type { AdventureStation } from "./types";
import type { NodeState } from "./voxelWorldLayout";

export function RewardChip({
  background,
  color,
  icon,
  imageUri,
  label
}: {
  background: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  imageUri?: string | null;
  label: string;
}) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  return (
    <View style={[styles.rewardChip, { backgroundColor: background }]}>
      {imageUri && failedImageUri !== imageUri ? (
        <Image
          source={{ uri: imageUri }}
          contentFit="cover"
          onError={() => setFailedImageUri(imageUri)}
          style={styles.rewardImage}
        />
      ) : (
        <Ionicons name={icon} size={15} color={color} />
      )}
      <AppText variant="small" style={{ color, fontWeight: "700" }}>{label}</AppText>
    </View>
  );
}

const STATE_META: Record<NodeState, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  done: { icon: "checkmark-circle", label: "已解锁" },
  current: { icon: "star", label: "当前站点" },
  future: { icon: "lock-closed", label: "未解锁" }
};

export function StationInfoCard({
  station,
  state,
  unlockAt,
  onClose
}: {
  station: AdventureStation;
  state: NodeState;
  unlockAt: number;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const meta = STATE_META[state];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        accessibilityLabel="关闭站点信息"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardWrap} pointerEvents="box-none">
        <Card>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="section">{station.title}</AppText>
              <View style={styles.stateRow}>
                <Ionicons
                  name={meta.icon}
                  size={15}
                  color={state === "current" ? colors.celebration : colors.inkSoft}
                />
                <AppText variant="small" tone="soft">
                  {meta.label}
                  {state === "future" ? ` · 累计 ${unlockAt} 点解锁` : ""}
                </AppText>
              </View>
            </View>
            <IconButton name="close" accessibilityLabel="关闭" onPress={onClose} />
          </View>
          <View style={styles.rewardRow}>
            {station.reward.badgeEnabled ? (
              <RewardChip
                icon="ribbon-outline"
                imageUri={publicUrl(station.reward.badgeImageKey)}
                label={station.reward.badgeTitle ?? "站点徽章"}
                color={colors.primaryInk}
                background={colors.surfaceTint}
              />
            ) : null}
            {station.reward.xpEnabled ? (
              <RewardChip
                icon="sparkles"
                label={`+${station.reward.xp} XP`}
                color={colors.partnerInk}
                background={colors.partnerSurface}
              />
            ) : null}
            {station.reward.storyEnabled ? (
              <RewardChip
                icon="book-outline"
                label={station.reward.storyTitle ?? "新剧情"}
                color={colors.inkSoft}
                background={colors.surfaceMuted}
              />
            ) : null}
            {!station.reward.badgeEnabled && !station.reward.xpEnabled && !station.reward.storyEnabled ? (
              <AppText variant="body" tone="muted">该站点暂无奖励。</AppText>
            ) : null}
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    bottom: spacing.xl,
    left: spacing.lg,
    position: "absolute",
    right: spacing.lg
  },
  headerRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  stateRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  rewardRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  rewardChip: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  rewardImage: { borderRadius: radius.pill, height: 20, width: 20 }
});
