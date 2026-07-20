import { useMemo } from "react";
import { StyleSheet } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop
} from "react-native-svg";
import type { ColorScheme, Palette } from "./theme";

type AppSplashBackdropProps = {
  width: number;
  height: number;
  colors: Palette;
  scheme: ColorScheme;
};

/** 满屏岛景背景：天幕 / 海面 / 岛影，供品牌开屏铺满视口。 */
export function AppSplashBackdrop({ width, height, colors, scheme }: AppSplashBackdropProps) {
  const skyStops = useMemo(() => {
    if (scheme === "dark") {
      return [
        { offset: "0%", color: "#1B1630" },
        { offset: "42%", color: colors.surfaceTint },
        { offset: "100%", color: colors.background }
      ];
    }
    return [
      { offset: "0%", color: "#FFE8EE" },
      { offset: "38%", color: colors.partnerSurface },
      { offset: "72%", color: colors.surfaceTint },
      { offset: "100%", color: colors.background }
    ];
  }, [colors.background, colors.partnerSurface, colors.surfaceTint, scheme]);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id="splash-sky" x1="0" y1="0" x2="0" y2="1">
          {skyStops.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </SvgLinearGradient>
        <RadialGradient id="splash-bloom" cx="50%" cy="28%" rx="58%" ry="36%">
          <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.22" />
          <Stop offset="55%" stopColor={colors.partner} stopOpacity="0.10" />
          <Stop offset="100%" stopColor={colors.background} stopOpacity="0" />
        </RadialGradient>
        <SvgLinearGradient id="splash-sea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.candySky} stopOpacity={scheme === "dark" ? "0.18" : "0.28"} />
          <Stop offset="100%" stopColor={colors.partner} stopOpacity={scheme === "dark" ? "0.12" : "0.16"} />
        </SvgLinearGradient>
        <SvgLinearGradient id="splash-land" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.88" />
          <Stop offset="100%" stopColor={colors.partner} stopOpacity="0.82" />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#splash-sky)" />
      <Rect x="0" y="0" width={width} height={height} fill="url(#splash-bloom)" />
      <Ellipse cx={width * 0.5} cy={height * 0.78} rx={width * 0.72} ry={height * 0.16} fill="url(#splash-sea)" />
      <Path
        d={`M0 ${height * 0.72}
            C ${width * 0.18} ${height * 0.66}, ${width * 0.32} ${height * 0.78}, ${width * 0.5} ${height * 0.7}
            C ${width * 0.68} ${height * 0.62}, ${width * 0.82} ${height * 0.74}, ${width} ${height * 0.68}
            L ${width} ${height} L 0 ${height} Z`}
        fill={scheme === "dark" ? colors.surface : "#FFFFFF"}
        opacity={0.55}
      />
      <Path
        d={`M ${width * 0.18} ${height * 0.7}
            C ${width * 0.28} ${height * 0.58}, ${width * 0.38} ${height * 0.56}, ${width * 0.5} ${height * 0.6}
            C ${width * 0.64} ${height * 0.54}, ${width * 0.74} ${height * 0.6}, ${width * 0.84} ${height * 0.68}
            C ${width * 0.7} ${height * 0.74}, ${width * 0.58} ${height * 0.76}, ${width * 0.5} ${height * 0.76}
            C ${width * 0.38} ${height * 0.76}, ${width * 0.26} ${height * 0.74}, ${width * 0.18} ${height * 0.7} Z`}
        fill="url(#splash-land)"
      />
      <Circle cx={width * 0.5} cy={height * 0.58} r={18} fill={colors.celebration} opacity={0.95} />
      <Circle cx={width * 0.5} cy={height * 0.58} r={8} fill="#FFF8E8" opacity={0.9} />
    </Svg>
  );
}
