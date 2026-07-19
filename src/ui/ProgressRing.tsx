import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { AppText } from "./Controls";
import { useTheme } from "./ThemeContext";

/** 今日进度环：珊瑚→阳光渐变，对齐设计稿。 */
export function ProgressRing({
  ratio,
  size = 92,
  strokeWidth = 8
}: {
  ratio: number;
  size?: number;
  strokeWidth?: number;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, ratio));
  const percent = Math.round(clamped * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const center = size / 2;
  const gradientId = "progressRingGrad";

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={colors.primary} />
            <Stop offset="100%" stopColor={colors.candySun} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.surfaceMuted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ alignItems: "center" }}>
        <AppText variant="title" style={{ fontSize: 24, lineHeight: 28, color: colors.ink }}>
          {percent}%
        </AppText>
        <AppText variant="caption" tone="muted" style={{ textTransform: "none", letterSpacing: 0 }}>
          done
        </AppText>
      </View>
    </View>
  );
}
