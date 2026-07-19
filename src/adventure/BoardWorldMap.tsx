import { Image, Platform, Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { CoupleAvatars, type CouplePerson } from "../ui/Avatar";
import { AppText } from "../ui/Controls";
import { radius, shadow } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import { resolveDefaultIslandSource } from "./mapAssets";
import type { AdventureChapterView } from "./types";

/** board 08 固定群岛位：左右交替的航线布局。 */
const SLOTS: { left?: `${number}%`; right?: `${number}%`; top: `${number}%` }[] = [
  { left: "5%", top: "1%" },
  { right: "6%", top: "12%" },
  { left: "7%", top: "34%" },
  { right: "11%", top: "46%" },
  { left: "9%", top: "66%" },
  { right: "11%", top: "72%" },
  { left: "18%", top: "84%" },
  { right: "16%", top: "88%" }
];

/**
 * board 08 世界地图：静态航线 + 岛屿 thrumb + 当前定位 pin。
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
  const ordered = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  const isDark = scheme === "dark";

  // 当前岛：优先 claimable，否则最高已解锁
  const currentId =
    ordered.find((c) => c.viewStatus === "claimable")?.id ??
    [...ordered].reverse().find((c) => c.viewStatus !== "locked")?.id ??
    null;

  return (
    <View
      style={{
        height: 392,
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: isDark ? colors.line : "#FFFFFF",
        backgroundColor: isDark ? colors.surfaceMuted : "#EAF4FF",
        ...shadow.soft
      }}
    >
      {!isDark ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 120,
              height: 120,
              borderRadius: 999,
              backgroundColor: "rgba(255,200,87,0.28)",
              left: "12%",
              top: -20
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 140,
              height: 140,
              borderRadius: 999,
              backgroundColor: "rgba(155,140,255,0.22)",
              right: -20,
              top: "28%"
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 130,
              height: 130,
              borderRadius: 999,
              backgroundColor: "rgba(63,190,150,0.18)",
              left: "8%",
              bottom: -30
            }}
          />
        </>
      ) : null}

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 60,
          height: 24,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.55)",
          left: "14%",
          top: "10%"
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 74,
          height: 26,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.5)",
          right: "8%",
          top: "30%"
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 56,
          height: 22,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.45)",
          left: "20%",
          bottom: "16%"
        }}
      />

      <Svg width="100%" height="100%" viewBox="0 0 340 392" style={{ position: "absolute" }} pointerEvents="none">
        <Path
          d="M55 52 C150 72 235 62 284 96 C325 126 105 138 60 168 C30 192 238 190 280 218 C318 244 100 268 60 290 C48 305 205 300 284 304"
          fill="none"
          stroke={isDark ? colors.lineStrong : "#B9C4E0"}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="2 10"
        />
      </Svg>

      {ordered.map((chapter, index) => {
        const slot = SLOTS[index] ?? { left: "40%" as const, top: `${Math.min(90, 10 + index * 12)}%` as `${number}%` };
        const locked = chapter.viewStatus === "locked";
        const current = chapter.id === currentId;

        return (
          <Pressable
            key={chapter.id}
            accessibilityRole="button"
            accessibilityLabel={chapter.title}
            onPress={() => onPressChapter(chapter.id)}
            disabled={locked}
            style={{
              position: "absolute",
              width: 84,
              alignItems: "center",
              zIndex: current ? 4 : 2,
              ...slot
            }}
          >
            {current ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: 86,
                  height: 86,
                  borderRadius: 999,
                  borderWidth: 2.5,
                  borderColor: "rgba(255,123,138,0.55)",
                  borderStyle: "dashed",
                  top: 8
                }}
              />
            ) : null}
            {current && people.length > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -15,
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
                <AppText variant="small" style={{ color: colors.primaryInk, fontWeight: "800", fontSize: 10 }}>
                  你们在这
                </AppText>
              </View>
            ) : null}
            <Image
              source={resolveDefaultIslandSource(chapter.mapThemeKey)}
              style={{
                width: 66,
                height: 66,
                opacity: locked ? 0.55 : 1,
                shadowColor: "#283048",
                shadowOpacity: locked ? 0.12 : 0.18,
                shadowRadius: locked ? 10 : 11,
                shadowOffset: { width: 0, height: locked ? 8 : 9 },
                ...(Platform.OS === "web" && locked
                  ? ({ filter: "grayscale(0.72) brightness(1.06)" } as object)
                  : {})
              }}
              resizeMode="contain"
            />
            <AppText
              variant="small"
              numberOfLines={1}
              style={{
                marginTop: -2,
                fontWeight: "800",
                fontSize: 9.5,
                color: current ? colors.primaryInk : locked ? colors.faint : colors.inkSoft
              }}
            >
              {current ? `${chapter.title} · 当前` : chapter.title}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
