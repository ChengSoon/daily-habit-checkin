import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { publicUrl } from "../sync/publicUrl";
import { AppText } from "../ui/Controls";
import { radius, spacing } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import { IslandStageBackground } from "./IslandStageBackground";
import { resolveDefaultIslandSource } from "./mapAssets";
import type { AdventureChapterView } from "./types";

type Props = {
  chapter: AdventureChapterView;
  height?: number;
};

function statusLabel(status: AdventureChapterView["viewStatus"]): string {
  if (status === "claimed") return "已探索";
  if (status === "claimable") return "可领取";
  return "未解锁";
}

/**
 * 章节详情顶部：该章岛屿舞台预览（背景 + 岛图 + 轻浮动）。
 */
export function ChapterIslandHero({ chapter, height = 280 }: Props) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.max(0, screenWidth - spacing.lg * 2);
  const locked = chapter.viewStatus === "locked";
  const claimable = chapter.viewStatus === "claimable";
  const claimed = chapter.viewStatus === "claimed";

  const customUri = chapter.nodeImageKey ? publicUrl(chapter.nodeImageKey) : null;
  const themeSource = resolveDefaultIslandSource(chapter.mapThemeKey);
  const isGif = Boolean(customUri && customUri.toLowerCase().includes(".gif"));
  const islandSize = Math.min(width * 0.72, height * 0.78, 240);

  const floatY = useSharedValue(0);

  useEffect(() => {
    const amp = locked ? 3 : claimable ? 8 : 5;
    const halfMs = locked ? 2000 : claimable ? 1400 : 1700;
    cancelAnimation(floatY);
    floatY.value = 0;
    floatY.value = withRepeat(
      withTiming(-amp, { duration: halfMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => cancelAnimation(floatY);
  }, [locked, claimable, floatY]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }]
  }));

  const badgeBg = claimable
    ? colors.celebration
    : claimed
      ? colors.primary
      : "rgba(30, 36, 42, 0.82)";
  // celebration 偏亮黄，用深色字；claimed 用 onPrimary；locked 用浅色
  const badgeFg = claimable ? "#2A1B24" : claimed ? colors.onPrimary : "#EEF2F4";

  return (
    <View style={[styles.wrap, { width, height, borderRadius: radius.xl }]}>
      <IslandStageBackground chapter={chapter} width={width} height={height} />

      <View style={styles.topRow}>
        <View style={[styles.chip, { backgroundColor: "rgba(8,16,22,0.55)" }]}>
          <AppText style={styles.chipText}>第 {chapter.sortOrder} 章</AppText>
        </View>
        <View style={[styles.chip, { backgroundColor: badgeBg }]}>
          <AppText style={[styles.chipText, { color: badgeFg }]}>{statusLabel(chapter.viewStatus)}</AppText>
        </View>
      </View>

      <View style={styles.stage}>
        <Animated.View style={[{ width: islandSize, height: islandSize, alignItems: "center" }, floatStyle]}>
          <View
            style={[
              styles.softShadow,
              {
                width: islandSize * 0.58,
                height: islandSize * 0.1,
                bottom: islandSize * 0.06
              }
            ]}
          />
          <Image
            source={customUri ? { uri: customUri } : themeSource}
            style={{
              width: islandSize,
              height: islandSize,
              opacity: locked ? 0.52 : 1
            }}
            contentFit="contain"
            transition={isGif ? 0 : 180}
          />
          {locked ? (
            <View style={[styles.lockVeil, { width: islandSize * 0.86, height: islandSize * 0.7 }]} />
          ) : null}
        </Animated.View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    alignSelf: "center"
  },
  topRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#F5FBFF",
    textTransform: "none"
  },
  stage: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12
  },
  softShadow: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(8, 20, 28, 0.32)"
  },
  lockVeil: {
    position: "absolute",
    backgroundColor: "rgba(18, 28, 38, 0.4)",
    borderRadius: 28
  },
});
