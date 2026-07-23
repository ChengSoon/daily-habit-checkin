import { useEffect, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { AppText } from "./controlText";
import { radius } from "./theme";
import { useTheme } from "./ThemeContext";

type SegmentOption<T> = { label: string; value: T };
type SegmentedControlProps<T> = {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
};

function SegmentThumb({ padding, position, thumbWidth }: {
  padding: number;
  position: Animated.Value;
  thumbWidth: number;
}) {
  const { colors } = useTheme();
  if (thumbWidth <= 0) return null;
  const translateX = position.interpolate({ inputRange: [0, 1], outputRange: [0, thumbWidth] });
  return <Animated.View pointerEvents="none" style={{
    position: "absolute",
    top: padding,
    left: padding,
    bottom: padding,
    width: thumbWidth,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    shadowColor: "#283048",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    transform: [{ translateX }]
  }} />;
}

function Segment<T extends string | number>({ active, onChange, option }: {
  active: boolean;
  onChange: (value: T) => void;
  option: SegmentOption<T>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => onChange(option.value)}
      style={{
        flex: 1,
        minHeight: 36,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8
      }}
    >
      <AppText variant="bodyStrong" style={{
        color: active ? colors.primaryInk : colors.muted,
        fontWeight: "800",
        fontSize: 14
      }}>{option.label}</AppText>
    </Pressable>
  );
}

export function SegmentedControl<T extends string | number>({ value, options, onChange }: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const padding = 4;
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [position] = useState(() => new Animated.Value(activeIndex));
  useEffect(() => {
    Animated.spring(position, {
      toValue: activeIndex,
      friction: 9,
      tension: 90,
      useNativeDriver: true
    }).start();
  }, [activeIndex, position]);
  const count = options.length || 1;
  const thumbWidth = trackWidth > 0 ? (trackWidth - padding * 2) / count : 0;
  return (
    <View
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.pill,
        padding
      }}
    >
      <SegmentThumb padding={padding} position={position} thumbWidth={thumbWidth} />
      {options.map((option) => <Segment
        key={String(option.value)}
        active={option.value === value}
        onChange={onChange}
        option={option}
      />)}
    </View>
  );
}

const WEEKDAY_PICKER_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function WeekdayPicker({ value, onChange }: {
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const { colors } = useTheme();
  const selected = new Set(value);
  function toggle(day: number) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange([...next].sort((left, right) => left - right));
  }
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {WEEKDAY_PICKER_LABELS.map((label, day) => {
        const active = selected.has(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`周${label}`}
            onPress={() => toggle(day)}
            style={({ pressed }) => [
              {
                flex: 1,
                minHeight: 36,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors.primary : colors.surfaceMuted,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.line
              },
              pressed ? { opacity: 0.8 } : null
            ]}
          >
            <AppText variant="bodyStrong" style={{
              color: active ? colors.onPrimary : colors.muted,
              fontSize: 14,
              fontWeight: "800"
            }}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
