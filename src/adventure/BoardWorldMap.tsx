import { useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View
} from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from "react-native-svg";
import { CoupleAvatars, type CouplePerson } from "../ui/Avatar";
import { AppText } from "../ui/Controls";
import { radius, shadow } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import { resolveChapterIslandSource } from "./mapAssets";
import { buildPathD, layoutChapters, MAP_LAYOUT } from "./mapLayout";
import type { AdventureChapterView } from "./types";
import { WorldMapBackdrop } from "./WorldMapBackdrop";

const ISLAND_SIZE = 72;
const PIN_EXTRA = 36;
/** 外框视口固定高度；内容在框内滑动延伸。 */
const VIEWPORT_HEIGHT = 392;

/**
 * board 08 世界地图：固定视口 + 程序化航线 + 动态氛围背景。
 */
export function BoardWorldMap({
  chapters,
  people = [],
  onPressChapter
}: {
  chapters: AdventureChapterView[];
  people?: CouplePerson[];
  onPressChapter: (chapterId: string) => void;
}) {
  const { colors, scheme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isDark = scheme === "dark";

  const canvasWidth = Math.min(Math.max(screenWidth - 32, 300), 420);

  const { layout, items } = useMemo(
    () =>
      layoutChapters(chapters, {
        width: canvasWidth,
        seed: chapters.length
      }),
    [canvasWidth, chapters]
  );

  const ordered = useMemo(
    () => [...chapters].sort((a, b) => a.sortOrder - b.sortOrder),
    [chapters]
  );

  const currentId =
    ordered.find((c) => c.viewStatus === "claimable")?.id ??
    [...ordered].reverse().find((c) => c.viewStatus !== "locked")?.id ??
    null;

  const contentHeight = Math.max(layout.height + PIN_EXTRA, VIEWPORT_HEIGHT);
  const needsScroll = contentHeight > VIEWPORT_HEIGHT + 4;

  const pathPoints = useMemo(
    () =>
      items.map((item) => ({
        cx: item.cx,
        cy: item.cy + PIN_EXTRA
      })),
    [items]
  );

  const pathD = useMemo(() => buildPathD(pathPoints), [pathPoints]);

  const currentItem = items.find((item) => item.id === currentId);
  const initialOffset = currentItem
    ? Math.max(
        0,
        Math.min(contentHeight - VIEWPORT_HEIGHT, currentItem.cy + PIN_EXTRA - VIEWPORT_HEIGHT * 0.45)
      )
    : Math.max(0, contentHeight - VIEWPORT_HEIGHT);

  if (ordered.length === 0) {
    return (
      <View
        style={{
          height: VIEWPORT_HEIGHT,
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: isDark ? colors.line : "#FFFFFF",
          ...shadow.soft
        }}
      >
        <WorldMapBackdrop width={canvasWidth} height={VIEWPORT_HEIGHT} dark={isDark} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
            暂无岛屿章节
          </AppText>
          <AppText variant="small" tone="faint" style={{ marginTop: 6, textAlign: "center" }}>
            在管理后台添加章节后，地图会自动延伸
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        height: VIEWPORT_HEIGHT,
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: isDark ? colors.line : "#FFFFFF",
        ...shadow.soft
      }}
    >
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={needsScroll}
        bounces={needsScroll}
        contentOffset={needsScroll ? { x: 0, y: initialOffset } : undefined}
        contentContainerStyle={{
          width: "100%",
          minHeight: VIEWPORT_HEIGHT
        }}
        style={{ flex: 1 }}
      >
        <View style={{ width: canvasWidth, height: contentHeight, alignSelf: "center" }}>
          <WorldMapBackdrop width={canvasWidth} height={contentHeight} dark={isDark} />

          {/* 航线：底层柔光 + 上层虚线 */}
          <Svg
            width={canvasWidth}
            height={contentHeight}
            style={{ position: "absolute", top: 0, left: 0 }}
            pointerEvents="none"
          >
            <Defs>
              <SvgLinearGradient id="wm-path" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={isDark ? "#9B8CFF" : "#6CB8FF"} stopOpacity="0.9" />
                <Stop offset="55%" stopColor={isDark ? "#FF8FA0" : "#FF7B8A"} stopOpacity="0.85" />
                <Stop offset="100%" stopColor={isDark ? "#5FCBAA" : "#3FBE96"} stopOpacity="0.9" />
              </SvgLinearGradient>
            </Defs>
            {pathD ? (
              <>
                <Path
                  d={pathD}
                  fill="none"
                  stroke={isDark ? "rgba(155,140,255,0.28)" : "rgba(108,184,255,0.35)"}
                  strokeWidth={MAP_LAYOUT.pathWidth + 6}
                  strokeLinecap="round"
                />
                <Path
                  d={pathD}
                  fill="none"
                  stroke="url(#wm-path)"
                  strokeWidth={MAP_LAYOUT.pathWidth}
                  strokeLinecap="round"
                  strokeDasharray="3 9"
                />
              </>
            ) : null}
          </Svg>

          {items.map((chapter) => {
            const locked = chapter.viewStatus === "locked";
            const current = chapter.id === currentId;
            const left = chapter.cx - ISLAND_SIZE / 2;
            const top = chapter.cy + PIN_EXTRA - ISLAND_SIZE / 2;

            return (
              <Pressable
                key={chapter.id}
                accessibilityRole="button"
                accessibilityLabel={`${chapter.title}，第 ${chapter.sortOrder} 章`}
                onPress={() => onPressChapter(chapter.id)}
                disabled={locked}
                style={{
                  position: "absolute",
                  left,
                  top,
                  width: ISLAND_SIZE + 12,
                  marginLeft: -6,
                  alignItems: "center",
                  zIndex: current ? 4 : 2
                }}
              >
                {current ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      width: ISLAND_SIZE + 22,
                      height: ISLAND_SIZE + 22,
                      borderRadius: 999,
                      borderWidth: 2.5,
                      borderColor: "rgba(255,123,138,0.6)",
                      borderStyle: "dashed",
                      top: -4,
                      backgroundColor: "rgba(255,255,255,0.12)"
                    }}
                  />
                ) : null}

                {current && people.length > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -28,
                      zIndex: 5,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      backgroundColor: colors.surface,
                      borderRadius: radius.pill,
                      paddingVertical: 4,
                      paddingLeft: 5,
                      paddingRight: 9,
                      ...shadow.float
                    }}
                  >
                    <CoupleAvatars people={people} size={22} showRibbon={false} />
                    <AppText variant="small" style={{ color: colors.primaryInk, fontWeight: "800", fontSize: 11 }}>
                      你们在这
                    </AppText>
                  </View>
                ) : null}

                {/* 岛底阴影，增强立体感 */}
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    bottom: 22,
                    width: ISLAND_SIZE * 0.55,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: isDark ? "rgba(0,0,0,0.28)" : "rgba(40,48,72,0.14)"
                  }}
                />

                <Image
                  source={resolveChapterIslandSource(chapter)}
                  style={{
                    width: ISLAND_SIZE,
                    height: ISLAND_SIZE,
                    opacity: locked ? 0.55 : 1,
                    shadowColor: "#283048",
                    shadowOpacity: locked ? 0.12 : 0.2,
                    shadowRadius: locked ? 10 : 12,
                    shadowOffset: { width: 0, height: locked ? 8 : 10 },
                    ...(Platform.OS === "web" && locked
                      ? ({ filter: "grayscale(0.72) brightness(1.06)" } as object)
                      : {})
                  }}
                  resizeMode="contain"
                />

                <View
                  style={{
                    marginTop: -2,
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: current
                      ? isDark
                        ? "rgba(255,143,160,0.22)"
                        : "rgba(255,255,255,0.82)"
                      : isDark
                        ? "rgba(0,0,0,0.28)"
                        : "rgba(255,255,255,0.72)"
                  }}
                >
                  <AppText
                    variant="small"
                    numberOfLines={1}
                    style={{
                      fontWeight: "800",
                      fontSize: 11,
                      maxWidth: ISLAND_SIZE + 20,
                      textAlign: "center",
                      color: current ? colors.primaryInk : locked ? colors.faint : colors.inkSoft
                    }}
                  >
                    {current ? `${chapter.title} · 当前` : chapter.title}
                  </AppText>
                </View>

                <AppText
                  variant="caption"
                  style={{
                    marginTop: 2,
                    fontSize: 10,
                    color: locked ? colors.faint : colors.muted,
                    textTransform: "none",
                    letterSpacing: 0,
                    textShadowColor: isDark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.8)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2
                  }}
                >
                  第 {chapter.sortOrder} 站
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {needsScroll ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: 10,
            bottom: 10,
            backgroundColor: isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.86)",
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderWidth: 1,
            borderColor: colors.line
          }}
        >
          <AppText variant="small" tone="soft" style={{ fontSize: 11 }}>
            框内滑动 · {ordered.length} 站
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
