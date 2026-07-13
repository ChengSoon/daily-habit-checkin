import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewToken
} from "react-native";
import { AppText } from "../ui/Controls";
import { radius, spacing } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import { IslandMarker } from "./IslandMarker";
import { IslandStageBackground } from "./IslandStageBackground";
import type { AdventureChapterView } from "./types";

type Props = {
  chapters: AdventureChapterView[];
  highestUnlockedOrder: number;
  onPressChapter: (chapterId: string) => void;
  onFocusChange?: (chapter: AdventureChapterView, index: number) => void;
  /** 对该 sortOrder 的岛播一次解锁强调 */
  pulseSortOrder?: number | null;
};

function resolveFocusIndex(chapters: AdventureChapterView[], highestUnlockedOrder: number): number {
  const ordered = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  if (ordered.length === 0) return 0;
  const claimable = ordered.findIndex((c) => c.viewStatus === "claimable");
  if (claimable >= 0) return claimable;
  const unlocked = ordered
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.sortOrder <= highestUnlockedOrder)
    .pop();
  if (unlocked) return unlocked.i;
  return 0;
}

export function WorldMapCanvas({
  chapters,
  highestUnlockedOrder,
  onPressChapter,
  onFocusChange,
  pulseSortOrder = null
}: Props) {
  const { colors } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const listRef = useRef<FlatList<AdventureChapterView>>(null);

  const ordered = useMemo(
    () => [...chapters].sort((a, b) => a.sortOrder - b.sortOrder),
    [chapters]
  );

  const initialIndex = useMemo(
    () => resolveFocusIndex(ordered, highestUnlockedOrder),
    [ordered, highestUnlockedOrder]
  );

  const [focusIndex, setFocusIndex] = useState(initialIndex);

  useEffect(() => {
    setFocusIndex(initialIndex);
  }, [initialIndex]);

  const frameW = Math.min(screenWidth - spacing.lg * 2, 420);
  const stageH = Math.min(Math.max(screenHeight * 0.58, 420), 560);
  const islandSize = Math.min(frameW * 0.74, 288);

  const goToIndex = useCallback(
    (index: number, animated = true) => {
      const clamped = Math.max(0, Math.min(ordered.length - 1, index));
      listRef.current?.scrollToIndex({ index: clamped, animated });
      setFocusIndex(clamped);
      const chapter = ordered[clamped];
      if (chapter) onFocusChange?.(chapter, clamped);
    },
    [onFocusChange, ordered]
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable && typeof v.index === "number");
      if (!first || first.index == null) return;
      const index = first.index;
      setFocusIndex(index);
      const chapter = ordered[index];
      if (chapter) onFocusChange?.(chapter, index);
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.round(y / stageH);
      const clamped = Math.max(0, Math.min(ordered.length - 1, index));
      if (clamped !== focusIndex) {
        setFocusIndex(clamped);
        const chapter = ordered[clamped];
        if (chapter) onFocusChange?.(chapter, clamped);
      }
    },
    [focusIndex, onFocusChange, ordered, stageH]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: AdventureChapterView; index: number }) => {
      const isActive = index === focusIndex;
      const prev = ordered[index - 1];
      const next = ordered[index + 1];

      return (
        <View style={{ width: frameW, height: stageH }}>
          <IslandStageBackground chapter={item} width={frameW} height={stageH} />

          {prev ? (
            <Pressable
              onPress={() => goToIndex(index - 1)}
              style={[styles.edgeHit, { top: 8 }]}
              hitSlop={8}
            >
              <AppText style={styles.edgeHint} numberOfLines={1}>
                ↑ {prev.title}
              </AppText>
            </Pressable>
          ) : (
            <AppText style={[styles.edgeHint, styles.edgeStatic, { top: 14, opacity: 0.4 }]}>
              旅程起点
            </AppText>
          )}

          {next ? (
            <Pressable
              onPress={() => goToIndex(index + 1)}
              style={[styles.edgeHit, { bottom: 8 }]}
              hitSlop={8}
            >
              <AppText style={styles.edgeHint} numberOfLines={1}>
                ↓ {next.title}
              </AppText>
            </Pressable>
          ) : (
            <AppText style={[styles.edgeHint, styles.edgeStatic, { bottom: 14, opacity: 0.4 }]}>
              旅程尽头
            </AppText>
          )}

          <View style={styles.stageCenter}>
            <IslandMarker
              chapter={item}
              islandSize={islandSize}
              scale={islandSize / 124}
              active={isActive}
              emphasizeOnce={pulseSortOrder != null && item.sortOrder === pulseSortOrder}
              onPress={() => onPressChapter(item.id)}
            />
          </View>
        </View>
      );
    },
    [focusIndex, frameW, goToIndex, islandSize, onPressChapter, ordered, pulseSortOrder, stageH]
  );

  if (ordered.length === 0) {
    return (
      <View style={[styles.frame, { width: frameW, height: 220, borderColor: colors.line }]}>
        <AppText tone="muted" style={{ textAlign: "center", marginTop: 80 }}>
          暂无岛屿章节
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.frame, { width: frameW, borderColor: colors.line }]}>
      <FlatList
        ref={listRef}
        data={ordered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={stageH}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces
        initialScrollIndex={Math.min(initialIndex, ordered.length - 1)}
        onScrollToIndexFailed={(info) => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: false });
          });
        }}
        getItemLayout={(_, index) => ({
          length: stageH,
          offset: stageH * index,
          index
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onMomentumScrollEnd={onMomentumEnd}
        style={{ height: stageH }}
      />

      <View style={styles.pagerBar}>
        <AppText style={styles.pagerText}>
          {focusIndex + 1} / {ordered.length}
        </AppText>
      </View>

      <View style={styles.dots}>
        {ordered.map((chapter, index) => {
          const active = index === focusIndex;
          const claimable = chapter.viewStatus === "claimable";
          const claimed = chapter.viewStatus === "claimed";
          return (
            <Pressable
              key={chapter.id}
              onPress={() => goToIndex(index)}
              hitSlop={6}
              style={[
                styles.dot,
                active ? styles.dotActive : null,
                claimable ? { backgroundColor: colors.celebration } : null,
                claimed && !active ? { backgroundColor: "rgba(255,255,255,0.55)" } : null
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "#0d2a36"
  },
  stageCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8
  },
  edgeHit: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 3,
    alignItems: "center",
    paddingVertical: 6
  },
  edgeHint: {
    textAlign: "center",
    color: "rgba(240,248,252,0.78)",
    fontSize: 12,
    fontWeight: "700"
  },
  edgeStatic: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 3
  },
  pagerBar: {
    position: "absolute",
    left: 10,
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(8,20,28,0.55)",
    zIndex: 4
  },
  pagerText: {
    color: "rgba(245,250,255,0.9)",
    fontSize: 12,
    fontWeight: "700"
  },
  dots: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    gap: 7,
    zIndex: 4
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.28)"
  },
  dotActive: {
    height: 16,
    backgroundColor: "rgba(255,255,255,0.95)"
  }
});
