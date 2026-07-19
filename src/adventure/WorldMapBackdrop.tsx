import { useEffect, useMemo } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
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
import { useReducedMotion } from "../ui/useReducedMotion";

type Props = {
  width: number;
  height: number;
  dark?: boolean;
};

type CloudSpec = {
  id: string;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  fromX: number;
  travel: number;
};

type SparkSpec = {
  id: string;
  x: number;
  y: number;
  r: number;
  delay: number;
  duration: number;
};

/**
 * 世界地图氛围背景：分层天空/海平线 + 漂浮云 + 微光点。
 * 纯装饰、pointerEvents=none；支持 Reduce Motion。
 */
export function WorldMapBackdrop({ width, height, dark = false }: Props) {
  const reducedMotion = useReducedMotion();
  const drift = useMemo(() => new Animated.Value(0), []);
  const pulse = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (reducedMotion) {
      drift.setValue(0);
      pulse.setValue(0.5);
      return;
    }

    const cloudLoop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );

    cloudLoop.start();
    glowLoop.start();
    return () => {
      cloudLoop.stop();
      glowLoop.stop();
    };
  }, [drift, pulse, reducedMotion]);

  const clouds = useMemo<CloudSpec[]>(() => {
    // 按高度分段铺云，长地图中段也不会空
    const bands = Math.max(4, Math.ceil(height / 160));
    const list: CloudSpec[] = [];
    for (let i = 0; i < bands; i += 1) {
      const y = (i + 0.35) / bands;
      list.push({
        id: `c-${i}-a`,
        y: height * y,
        size: 54 + (i % 3) * 14,
        opacity: dark ? 0.1 + (i % 2) * 0.04 : 0.42 + (i % 3) * 0.08,
        duration: 18000 + (i % 4) * 2500,
        delay: i * 400,
        fromX: -80 - (i % 3) * 20,
        travel: width + 160
      });
      if (i % 2 === 0) {
        list.push({
          id: `c-${i}-b`,
          y: height * (y + 0.08),
          size: 40 + (i % 2) * 10,
          opacity: dark ? 0.08 : 0.32,
          duration: 24000 + i * 800,
          delay: 900 + i * 300,
          fromX: width * 0.15,
          travel: width * 0.55
        });
      }
    }
    return list;
  }, [dark, height, width]);

  const sparks = useMemo<SparkSpec[]>(() => {
    const count = Math.min(14, Math.max(6, Math.floor(height / 90)));
    const list: SparkSpec[] = [];
    for (let i = 0; i < count; i += 1) {
      const seed = (i + 1) * 17.13;
      list.push({
        id: `s-${i}`,
        x: ((Math.sin(seed) * 0.5 + 0.5) * 0.78 + 0.11) * width,
        y: ((Math.cos(seed * 1.3) * 0.5 + 0.5) * 0.86 + 0.06) * height,
        r: 1.6 + (i % 3) * 0.7,
        delay: i * 180,
        duration: 2200 + (i % 4) * 400
      });
    }
    return list;
  }, [height, width]);

  const sunScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const sunOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] });
  const seaOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.85] });

  const skyTop = dark ? "#1A2238" : "#9ED7FF";
  const skyMid = dark ? "#24304A" : "#D7ECFF";
  const skyLow = dark ? "#1E2A3C" : "#F7F0FF";
  const seaTop = dark ? "#1B3348" : "#B8E4F5";
  const seaBottom = dark ? "#142636" : "#8FCFEA";
  const sunCore = dark ? "#F0C35A" : "#FFE08A";
  const sunHalo = dark ? "rgba(240,195,90,0.18)" : "rgba(255,200,100,0.45)";
  const accentLav = dark ? "rgba(155,140,255,0.16)" : "rgba(155,140,255,0.22)";
  const accentMint = dark ? "rgba(63,190,150,0.12)" : "rgba(63,190,150,0.18)";
  const accentCoral = dark ? "rgba(255,123,138,0.12)" : "rgba(255,123,138,0.16)";

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
      {/* 天空 + 海平面分层 */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="wm-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={skyTop} />
            <Stop offset="48%" stopColor={skyMid} />
            <Stop offset="72%" stopColor={skyLow} />
            <Stop offset="100%" stopColor={seaBottom} />
          </SvgLinearGradient>
          <SvgLinearGradient id="wm-sea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={seaTop} stopOpacity={dark ? 0.35 : 0.55} />
            <Stop offset="100%" stopColor={seaBottom} stopOpacity={dark ? 0.7 : 0.85} />
          </SvgLinearGradient>
          <RadialGradient id="wm-sun" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={sunCore} stopOpacity="0.95" />
            <Stop offset="55%" stopColor={sunCore} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={sunCore} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="wm-blob-a" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFC857" stopOpacity={dark ? 0.2 : 0.35} />
            <Stop offset="100%" stopColor="#FFC857" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="wm-blob-b" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#9B8CFF" stopOpacity={dark ? 0.18 : 0.28} />
            <Stop offset="100%" stopColor="#9B8CFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="wm-blob-c" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#3FBE96" stopOpacity={dark ? 0.14 : 0.24} />
            <Stop offset="100%" stopColor="#3FBE96" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="url(#wm-sky)" />

        {/* 远山剪影 */}
        <Path
          d={`M0 ${height * 0.62}
             C ${width * 0.12} ${height * 0.54}, ${width * 0.22} ${height * 0.58}, ${width * 0.34} ${height * 0.52}
             C ${width * 0.48} ${height * 0.45}, ${width * 0.55} ${height * 0.56}, ${width * 0.68} ${height * 0.5}
             C ${width * 0.8} ${height * 0.45}, ${width * 0.9} ${height * 0.55}, ${width} ${height * 0.5}
             L ${width} ${height} L 0 ${height} Z`}
          fill={dark ? "rgba(18,28,42,0.55)" : "rgba(255,255,255,0.35)"}
        />
        <Path
          d={`M0 ${height * 0.72}
             C ${width * 0.18} ${height * 0.66}, ${width * 0.3} ${height * 0.74}, ${width * 0.46} ${height * 0.68}
             C ${width * 0.62} ${height * 0.62}, ${width * 0.78} ${height * 0.74}, ${width} ${height * 0.66}
             L ${width} ${height} L 0 ${height} Z`}
          fill={dark ? "rgba(20,36,52,0.65)" : "rgba(180,220,240,0.45)"}
        />

        {/* 海带 */}
        <Rect x={0} y={height * 0.78} width={width} height={height * 0.22} fill="url(#wm-sea)" />
        <Path
          d={`M0 ${height * 0.82}
             Q ${width * 0.2} ${height * 0.8}, ${width * 0.4} ${height * 0.83}
             T ${width * 0.8} ${height * 0.82}
             T ${width} ${height * 0.84}
             L ${width} ${height} L 0 ${height} Z`}
          fill={dark ? "rgba(90,160,190,0.12)" : "rgba(255,255,255,0.28)"}
        />

        {/* 色晕 blob */}
        <Circle cx={width * 0.18} cy={height * 0.12} r={88} fill="url(#wm-blob-a)" />
        <Circle cx={width * 0.88} cy={height * 0.34} r={100} fill="url(#wm-blob-b)" />
        <Circle cx={width * 0.2} cy={height * 0.7} r={92} fill="url(#wm-blob-c)" />
        <Circle cx={width * 0.75} cy={height * 0.88} r={70} fill={accentCoral} />
        <Circle cx={width * 0.55} cy={height * 0.18} r={50} fill={accentLav} />
        <Circle cx={width * 0.4} cy={height * 0.55} r={60} fill={accentMint} />
      </Svg>

      {/* 太阳光晕（呼吸） */}
      <Animated.View
        style={{
          position: "absolute",
          left: width * 0.62,
          top: Math.max(8, height * 0.04),
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: sunHalo,
          opacity: sunOpacity,
          transform: [{ scale: sunScale }]
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          left: width * 0.62 + 28,
          top: Math.max(8, height * 0.04) + 28,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: sunCore,
          opacity: sunOpacity,
          transform: [{ scale: sunScale }]
        }}
      />

      {/* 海面波光条 */}
      <Animated.View
        style={{
          position: "absolute",
          left: width * 0.1,
          top: height * 0.84,
          width: width * 0.28,
          height: 3,
          borderRadius: 2,
          backgroundColor: dark ? "rgba(180,220,255,0.25)" : "rgba(255,255,255,0.65)",
          opacity: seaOpacity
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          left: width * 0.55,
          top: height * 0.88,
          width: width * 0.22,
          height: 2.5,
          borderRadius: 2,
          backgroundColor: dark ? "rgba(180,220,255,0.2)" : "rgba(255,255,255,0.55)",
          opacity: seaOpacity
        }}
      />

      {/* 漂浮云 */}
      {clouds.map((cloud, index) => {
        const tx = drift.interpolate({
          inputRange: [0, 1],
          outputRange: [cloud.fromX, cloud.fromX + cloud.travel * (index % 2 === 0 ? 1 : 0.65)]
        });
        // 不同云用不同相位：靠 duration 差异 + delay 错开
        return (
          <Animated.View
            key={cloud.id}
            style={{
              position: "absolute",
              top: cloud.y,
              opacity: cloud.opacity,
              transform: reducedMotion ? [{ translateX: cloud.fromX + cloud.travel * 0.25 }] : [{ translateX: tx }]
            }}
          >
            <CloudShape size={cloud.size} dark={dark} />
          </Animated.View>
        );
      })}

      {/* 微光点 */}
      {sparks.map((spark, index) => {
        const o = pulse.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange:
            index % 2 === 0
              ? [0.15, 0.75, 0.2]
              : [0.55, 0.2, 0.65]
        });
        return (
          <Animated.View
            key={spark.id}
            style={{
              position: "absolute",
              left: spark.x,
              top: spark.y,
              width: spark.r * 2,
              height: spark.r * 2,
              borderRadius: spark.r,
              backgroundColor: dark ? "rgba(255,240,200,0.85)" : "rgba(255,255,255,0.95)",
              opacity: reducedMotion ? 0.35 : o
            }}
          />
        );
      })}
    </View>
  );
}

function CloudShape({ size, dark }: { size: number; dark: boolean }) {
  const fill = dark ? "rgba(230,238,255,0.16)" : "rgba(255,255,255,0.88)";
  const w = size * 1.7;
  const h = size * 0.72;
  return (
    <Svg width={w} height={h}>
      <Ellipse cx={w * 0.32} cy={h * 0.58} rx={size * 0.28} ry={size * 0.22} fill={fill} />
      <Ellipse cx={w * 0.52} cy={h * 0.42} rx={size * 0.34} ry={size * 0.28} fill={fill} />
      <Ellipse cx={w * 0.72} cy={h * 0.56} rx={size * 0.26} ry={size * 0.2} fill={fill} />
      <Ellipse cx={w * 0.5} cy={h * 0.68} rx={size * 0.42} ry={size * 0.18} fill={fill} />
    </Svg>
  );
}
