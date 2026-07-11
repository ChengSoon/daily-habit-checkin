import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { AppText, IconButton, SegmentedControl } from "../ui/Controls";
import { radius, spacing } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import { publicUrl } from "../sync/publicUrl";
import { getAdventureCollectionItems } from "./adventureRules";
import { AdventureCampaign, AdventureCollectionItem } from "./types";

type CollectionMode = "badges" | "letters";

export function AdventureCollection({
  campaign,
  claimedStationIds
}: {
  campaign: AdventureCampaign;
  claimedStationIds: ReadonlySet<string>;
}) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<CollectionMode>("badges");
  const [openLetter, setOpenLetter] = useState<AdventureCollectionItem | null>(null);
  const items = useMemo(
    () => getAdventureCollectionItems(campaign, claimedStationIds),
    [campaign, claimedStationIds]
  );
  const modeItems = items.filter((item) => mode === "badges" ? item.badgeEnabled : item.storyEnabled);
  const unlockedCount = modeItems.filter((item) => item.isUnlocked).length;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="section">旅程收藏</AppText>
          <AppText variant="small" tone="muted">
            已收集 {unlockedCount} / {modeItems.length}
          </AppText>
        </View>
        <Ionicons name="albums-outline" size={22} color={colors.primaryInk} />
      </View>

      <SegmentedControl<CollectionMode>
        value={mode}
        options={[
          { label: "勋章册", value: "badges" },
          { label: "来信", value: "letters" }
        ]}
        onChange={setMode}
      />
      <CollectionItems mode={mode} items={modeItems} onOpenLetter={setOpenLetter} />
      <LetterModal item={openLetter} onClose={() => setOpenLetter(null)} />
    </View>
  );
}

function CollectionItems({ mode, items, onOpenLetter }: {
  mode: CollectionMode;
  items: AdventureCollectionItem[];
  onOpenLetter: (item: AdventureCollectionItem) => void;
}) {
  if (items.length === 0) {
    const message = mode === "badges" ? "这条路线还没有勋章奖励。" : "这条路线还没有来信奖励。";
    return <AppText variant="body" tone="muted">{message}</AppText>;
  }
  if (mode === "badges") {
    return <View style={styles.badgeGrid}>{items.map((item) => <BadgeTile key={item.stationId} item={item} />)}</View>;
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((item) => <LetterRow key={item.stationId} item={item} onOpen={() => onOpenLetter(item)} />)}
    </View>
  );
}

function BadgeTile({ item }: { item: AdventureCollectionItem }) {
  const { colors } = useTheme();
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const imageUri = publicUrl(item.badgeImageKey);
  return (
    <View
      style={[
        styles.badgeTile,
        {
          backgroundColor: item.isUnlocked ? colors.surfaceTint : colors.surfaceMuted,
          borderColor: item.isUnlocked ? colors.primary : colors.line
        }
      ]}
    >
      <View
        style={[
          styles.badgeIcon,
          { backgroundColor: item.isUnlocked ? colors.celebration : colors.surface }
        ]}
      >
        {item.isUnlocked && imageUri && failedImageUri !== imageUri ? (
          <Image
            source={{ uri: imageUri }}
            contentFit="cover"
            onError={() => setFailedImageUri(imageUri)}
            style={styles.badgeImage}
          />
        ) : (
          <Ionicons
            name={item.isUnlocked ? badgeIcon(item.badgeIcon) : "lock-closed-outline"}
            size={22}
            color={item.isUnlocked ? item.badgeColor ?? colors.ink : colors.faint}
          />
        )}
      </View>
      <AppText variant="bodyStrong" tone={item.isUnlocked ? "default" : "muted"} numberOfLines={2}>
        {item.badgeTitle}
      </AppText>
      <AppText variant="caption" tone="muted">
        {item.isUnlocked ? item.stationTitle : `累计 ${item.requiredPoints} 点解锁`}
      </AppText>
    </View>
  );
}

function badgeIcon(value: string | null): keyof typeof Ionicons.glyphMap {
  if (value && value in Ionicons.glyphMap) return value as keyof typeof Ionicons.glyphMap;
  return "ribbon";
}

function LetterRow({ item, onOpen }: { item: AdventureCollectionItem; onOpen: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !item.isUnlocked }}
      disabled={!item.isUnlocked}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.letterRow,
        { backgroundColor: colors.surface, borderColor: colors.line },
        pressed ? { opacity: 0.82 } : null
      ]}
    >
      <View style={[styles.letterIcon, { backgroundColor: item.isUnlocked ? colors.partnerSurface : colors.surfaceMuted }]}>
        <Ionicons
          name={item.isUnlocked ? "mail-open-outline" : "lock-closed-outline"}
          size={20}
          color={item.isUnlocked ? colors.partnerInk : colors.faint}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" tone={item.isUnlocked ? "default" : "muted"}>
          {item.storyTitle}
        </AppText>
        <AppText variant="small" tone="muted">
          {item.isUnlocked ? `来自${item.stationTitle}` : `累计 ${item.requiredPoints} 点后送达`}
        </AppText>
      </View>
      {item.isUnlocked ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
    </Pressable>
  );
}

function LetterModal({ item, onClose }: { item: AdventureCollectionItem | null; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.letterSheet, { backgroundColor: colors.surface, borderColor: colors.line }]}
        >
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="caption" tone="primary">来自 {item?.stationTitle}</AppText>
              <AppText variant="title">{item?.storyTitle}</AppText>
            </View>
            <IconButton name="close" accessibilityLabel="关闭来信" onPress={onClose} />
          </View>
          <View style={[styles.letterRule, { backgroundColor: colors.celebration }]} />
          <AppText variant="body" tone="soft" style={{ lineHeight: 28 }}>
            {item?.storyBody}
          </AppText>
          <AppText variant="small" tone="muted" style={{ textAlign: "right" }}>
            星河海岸
          </AppText>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  badgeTile: { borderRadius: radius.sm, borderWidth: 1, flexBasis: "47%", flexGrow: 1, gap: spacing.sm, minHeight: 142, padding: spacing.md },
  badgeIcon: { alignItems: "center", borderRadius: radius.pill, height: 44, justifyContent: "center", width: 44 },
  badgeImage: { height: "100%", width: "100%" },
  letterRow: { alignItems: "center", borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 72, padding: spacing.md },
  letterIcon: { alignItems: "center", borderRadius: radius.pill, height: 42, justifyContent: "center", width: 42 },
  overlay: { flex: 1, justifyContent: "center", padding: spacing.xl },
  letterSheet: { borderRadius: radius.lg, borderWidth: 1, gap: spacing.lg, padding: spacing.xl },
  letterRule: { borderRadius: radius.pill, height: 4, width: 56 }
});
