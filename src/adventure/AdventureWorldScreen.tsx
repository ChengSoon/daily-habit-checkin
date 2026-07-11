import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { CoupleAvatars } from "../ui/Avatar";
import { AppText, Card, IconButton } from "../ui/Controls";
import { publicUrl } from "../sync/publicUrl";
import { radius, spacing } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import { useReducedMotion } from "../ui/useReducedMotion";
import { AdventureCollection } from "./AdventureCollection";
import type { QualityTier } from "./cameraMath";
import { RewardChip, StationInfoCard } from "./StationInfoCard";
import type {
  AdventureCampaign,
  AdventureProgress,
  AdventureStation,
  AdventureUnlockSummary
} from "./types";
import { useMapCamera } from "./useMapCamera";
import { useUnlockCeremony } from "./useUnlockCeremony";
import type { MapCameraApi, VoxelWorldCanvasProps } from "./VoxelWorldCanvas";
import { createVoxelWorldLayout } from "./voxelWorldLayout";

// web 不打包 GL 相关模块
const VoxelWorldCanvasImpl: ((props: VoxelWorldCanvasProps) => ReactNode) | null =
  Platform.OS === "web"
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports -- 条件加载避免 web 打包 expo-gl
      (require("./VoxelWorldCanvas") as typeof import("./VoxelWorldCanvas")).VoxelWorldCanvas;

class GLErrorBoundary extends Component<{ onError: () => void; children: ReactNode }> {
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.props.children;
  }
}

function StaticProgressFallback({ campaign, progress, summary }: {
  campaign: AdventureCampaign;
  progress: AdventureProgress;
  summary: { title: string; subtitle: string };
}) {
  const { colors } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.fallbackContent}>
      <AppText variant="display">{summary.title}</AppText>
      <AppText variant="body" tone="soft">{summary.subtitle}</AppText>
      <Card>
        {campaign.stations.map((station, index) => {
          const icon = index < progress.stationIndex
            ? "checkmark-circle"
            : index === progress.stationIndex ? "star" : "lock-closed";
          const color = index < progress.stationIndex
            ? colors.primary
            : index === progress.stationIndex ? colors.celebration : colors.inkSoft;
          return (
            <View key={station.id} style={styles.fallbackRow}>
              <Ionicons name={icon} size={16} color={color} />
              <AppText variant="body" style={{ flex: 1 }}>{station.title}</AppText>
              <AppText variant="small" tone="muted">{station.unlockAt} 点</AppText>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

export type AdventureWorldScreenProps = {
  campaign: AdventureCampaign;
  progress: AdventureProgress;
  summary: { title: string; subtitle: string; actionPointLabel: string; chapterProgressLabel: string };
  unlockSummary: AdventureUnlockSummary;
  campaignRatio: number;
  claimedStationSet: Set<string>;
  people: { name: string; tone: "you" | "partner"; imageUri?: string | null }[];
  isOwner: boolean;
  pendingUnlockStationIds: string[];
  onCeremonyComplete: () => void;
};

export function AdventureWorldScreen(props: AdventureWorldScreenProps) {
  const {
    campaign, progress, summary, unlockSummary, campaignRatio,
    claimedStationSet, people, isOwner, pendingUnlockStationIds, onCeremonyComplete
  } = props;
  const { colors, scheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const { height: viewportHeight } = useWindowDimensions();
  const [glFailed, setGlFailed] = useState(false);
  const [qualityTier] = useState<QualityTier>(0);
  const [selectedStationIndex, setSelectedStationIndex] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const layout = useMemo(
    () => createVoxelWorldLayout(campaign.stations, progress),
    [campaign.stations, progress]
  );

  const cameraApiRef = useRef<MapCameraApi | null>(null);
  const { gesture, stateRef, api } = useMapCamera({
    bounds: layout.cameraBounds,
    initialTarget: layout.currentNodePosition,
    viewportHeightPx: viewportHeight
  });
  useEffect(() => {
    cameraApiRef.current = api;
  }, [api]);

  const { ceremony, showRewardFor, skip } = useUnlockCeremony({
    layout,
    stations: campaign.stations,
    pendingUnlockStationIds,
    cameraApi: cameraApiRef,
    reducedMotion,
    onComplete: onCeremonyComplete
  });

  const drawerHeight = useSharedValue(0);
  const drawerStyle = useAnimatedStyle(() => ({ height: drawerHeight.value }));
  const toggleDrawer = () => {
    const next = !drawerOpen;
    setDrawerOpen(next);
    // eslint-disable-next-line react-hooks/immutability -- Reanimated sharedValue 官方写法
    drawerHeight.value = withSpring(next ? Math.round(viewportHeight * 0.55) : 0, {
      damping: 18,
      stiffness: 160
    });
  };

  const selectedStation: AdventureStation | null =
    selectedStationIndex !== null ? campaign.stations[selectedStationIndex] ?? null : null;
  const selectedNode = selectedStationIndex !== null
    ? layout.nodes[selectedStationIndex] ?? null
    : null;

  const useFallback = Platform.OS === "web" || glFailed || VoxelWorldCanvasImpl === null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {useFallback ? (
        <StaticProgressFallback campaign={campaign} progress={progress} summary={summary} />
      ) : (
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill}>
            <GLErrorBoundary onError={() => setGlFailed(true)}>
              <VoxelWorldCanvasImpl
                layout={layout}
                people={people.map((p) => ({ name: p.name, tone: p.tone }))}
                avatarColors={{ you: colors.primary, partner: colors.partner }}
                dark={scheme === "dark"}
                reducedMotion={reducedMotion}
                qualityTier={qualityTier}
                cameraApi={cameraApiRef}
                cameraStateRef={stateRef}
                onNodePress={setSelectedStationIndex}
                ceremony={ceremony}
              />
            </GLErrorBoundary>
          </View>
        </GestureDetector>
      )}

      {/* 顶部悬浮条 */}
      <View style={[styles.topBar, { backgroundColor: `${colors.surface}E6` }]} pointerEvents="box-none">
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="muted">双人冒险</AppText>
          <AppText variant="section">{summary.title}</AppText>
        </View>
        {people.length > 0 ? <CoupleAvatars people={people} size={34} showRibbon={false} /> : null}
        <View style={[styles.pointPill, { backgroundColor: colors.surfaceTint }]}>
          <AppText variant="bodyStrong" tone="primary">{summary.actionPointLabel}</AppText>
        </View>
        {isOwner ? (
          <IconButton
            name="construct-outline"
            accessibilityLabel="设计冒险关卡"
            onPress={() => router.push("/adventure/manage")}
          />
        ) : null}
        <IconButton name="settings-outline" accessibilityLabel="打开设置" onPress={() => router.push("/profile")} />
      </View>

      {/* 回到当前 */}
      {!useFallback ? (
        <Pressable
          accessibilityLabel="回到当前站点"
          onPress={() => cameraApiRef.current?.flyTo(layout.currentNodePosition, 600)}
          style={[styles.recenterButton, { backgroundColor: colors.surfaceTint }]}
        >
          <Ionicons name="locate" size={20} color={colors.primaryInk} />
        </Pressable>
      ) : null}

      {/* 底部抽屉 */}
      <View style={styles.drawerWrap} pointerEvents="box-none">
        <Pressable
          accessibilityLabel={drawerOpen ? "收起冒险详情" : "展开冒险详情"}
          onPress={toggleDrawer}
          style={[styles.drawerHandle, { backgroundColor: colors.surface }]}
        >
          <Ionicons name={drawerOpen ? "chevron-down" : "chevron-up"} size={18} color={colors.inkSoft} />
          <AppText variant="small" tone="soft">{summary.chapterProgressLabel}</AppText>
        </Pressable>
        <Animated.View style={[styles.drawerBody, { backgroundColor: colors.surface }, drawerStyle]}>
          <ScrollView contentContainerStyle={styles.drawerContent}>
            <Card>
              <AppText variant="section">下一站奖励</AppText>
              {unlockSummary.nextUnlockAt ? (
                <AppText variant="small" tone="soft">
                  累计 {unlockSummary.nextUnlockAt} 点解锁{unlockSummary.nextStationTitle}
                </AppText>
              ) : (
                <AppText variant="body" tone="muted">所有站点奖励都已解锁。</AppText>
              )}
            </Card>
            <View style={[styles.chapterCard, { backgroundColor: colors.ink }]}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="section" style={{ color: colors.surface }}>章节进度</AppText>
                <AppText variant="small" style={{ color: colors.surface, opacity: 0.72 }}>
                  {summary.chapterProgressLabel}
                </AppText>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.faint }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.celebration, width: `${campaignRatio * 100}%` }
                  ]}
                />
              </View>
            </View>
            <AdventureCollection campaign={campaign} claimedStationIds={claimedStationSet} />
          </ScrollView>
        </Animated.View>
      </View>

      {/* 节点信息卡 */}
      {selectedStation && selectedNode ? (
        <StationInfoCard
          station={selectedStation}
          state={selectedNode.state}
          unlockAt={selectedStation.unlockAt}
          onClose={() => setSelectedStationIndex(null)}
        />
      ) : null}

      {/* 解锁奖励摘要卡（celebrate 阶段） */}
      {showRewardFor ? (
        <View style={styles.rewardOverlay} pointerEvents="box-none">
          <Card>
            <AppText variant="section">解锁「{showRewardFor.title}」！</AppText>
            <View style={styles.rewardRow}>
              {showRewardFor.reward.badgeEnabled ? (
                <RewardChip
                  icon="ribbon-outline"
                  imageUri={publicUrl(showRewardFor.reward.badgeImageKey)}
                  label={showRewardFor.reward.badgeTitle ?? "站点徽章"}
                  color={colors.primaryInk}
                  background={colors.surfaceTint}
                />
              ) : null}
              {showRewardFor.reward.xpEnabled ? (
                <RewardChip
                  icon="sparkles"
                  label={`+${showRewardFor.reward.xp} XP`}
                  color={colors.partnerInk}
                  background={colors.partnerSurface}
                />
              ) : null}
              {showRewardFor.reward.storyEnabled ? (
                <RewardChip
                  icon="book-outline"
                  label={showRewardFor.reward.storyTitle ?? "新剧情"}
                  color={colors.inkSoft}
                  background={colors.surfaceMuted}
                />
              ) : null}
            </View>
          </Card>
        </View>
      ) : null}

      {/* 仪式播放中：任意点按跳过 */}
      {ceremony ? (
        <Pressable accessibilityLabel="跳过解锁动画" onPress={skip} style={styles.skipLayer}>
          <View style={[styles.skipHint, { backgroundColor: `${colors.ink}B3` }]}>
            <AppText variant="small" style={{ color: colors.surface }}>点按任意处跳过</AppText>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: "center",
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.sm,
    left: spacing.md,
    padding: spacing.md,
    position: "absolute",
    right: spacing.md,
    top: spacing.xl
  },
  pointPill: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  recenterButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    bottom: 132,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: spacing.lg,
    width: 44
  },
  drawerWrap: { bottom: 0, left: 0, position: "absolute", right: 0 },
  drawerHandle: {
    alignItems: "center",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    paddingVertical: spacing.md
  },
  drawerBody: { overflow: "hidden" },
  drawerContent: { gap: spacing.md, padding: spacing.lg },
  chapterCard: { alignItems: "center", borderRadius: radius.lg, flexDirection: "row", gap: spacing.lg, padding: spacing.lg },
  progressTrack: { borderRadius: radius.pill, height: 10, overflow: "hidden", width: 96 },
  progressFill: { borderRadius: radius.pill, height: "100%" },
  rewardOverlay: { left: spacing.lg, position: "absolute", right: spacing.lg, top: "30%" },
  rewardRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  skipLayer: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0, alignItems: "center", justifyContent: "flex-end", paddingBottom: 90 },
  skipHint: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  fallbackContent: { gap: spacing.md, padding: spacing.lg },
  fallbackRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs }
});
