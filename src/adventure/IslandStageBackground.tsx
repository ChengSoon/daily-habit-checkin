import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { publicUrl } from "../sync/publicUrl";
import { resolveIslandStageTheme } from "./islandStageTheme";
import type { AdventureChapterView } from "./types";

type Props = {
  chapter: AdventureChapterView;
  width: number;
  height: number;
};

/** 单岛舞台背景：自定义图/GIF 优先，否则主题渐变氛围 */
export function IslandStageBackground({ chapter, width, height }: Props) {
  const customBg = chapter.backgroundImageKey ? publicUrl(chapter.backgroundImageKey) : null;
  const theme = resolveIslandStageTheme(chapter.mapThemeKey);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bottom }]}>
      {customBg ? (
        <Image
          source={{ uri: customBg }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={160}
        />
      ) : (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`sky-${chapter.id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.top} stopOpacity="1" />
              <Stop offset="0.55" stopColor={theme.mid} stopOpacity="1" />
              <Stop offset="1" stopColor={theme.bottom} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill={`url(#sky-${chapter.id})`} />
          <Circle cx={width * 0.18} cy={height * 0.18} r={18} fill="#FFFFFF" opacity={0.12} />
          <Circle cx={width * 0.82} cy={height * 0.28} r={28} fill="#FFFFFF" opacity={0.08} />
          <Circle cx={width * 0.7} cy={height * 0.72} r={40} fill={theme.accent} opacity={0.1} />
        </Svg>
      )}

      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`wash-${chapter.id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#061820" stopOpacity={customBg ? 0.26 : theme.washTop} />
            <Stop offset="0.5" stopColor="#0a2430" stopOpacity={customBg ? 0.1 : theme.washMid} />
            <Stop offset="1" stopColor="#071820" stopOpacity={customBg ? 0.3 : theme.washBottom} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#wash-${chapter.id})`} />
      </Svg>
    </View>
  );
}
