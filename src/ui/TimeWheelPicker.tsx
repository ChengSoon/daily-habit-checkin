import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, AppText, Label } from "./Controls";
import { radius, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

const ITEM_HEIGHT = 44;
// 上下各留两格空白，让选中项能滚到中间高亮框内。
const VISIBLE_ROWS = 5;
const PADDING_ROWS = (VISIBLE_ROWS - 1) / 2;

function pad2(value: number): string {
  return `${value}`.padStart(2, "0");
}

/**
 * 把 "HH:MM" 拆成 [时, 分]；非法输入回退到 00:00。
 */
function parseTime(value: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return { hours: 0, minutes: 0 };
  }
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return { hours, minutes };
}

/**
 * 单列滚轮：ScrollView + snapToInterval，选中项吸附到中间高亮框。
 * 通过上下留白让首尾项也能滚到正中。
 */
function WheelColumn({
  values,
  selectedIndex,
  onSelect
}: {
  values: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  // 打开时把当前值滚到中间（无动画，避免弹出瞬间的跳动）。
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(timer);
    // 只在挂载时对齐一次；后续滚动由用户驱动。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.min(values.length - 1, Math.max(0, index));
    if (clamped !== selectedIndex) {
      onSelect(clamped);
    }
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ height: ITEM_HEIGHT * VISIBLE_ROWS, flex: 1 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      onMomentumScrollEnd={handleMomentumEnd}
      contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * PADDING_ROWS }}
    >
      {values.map((label, index) => {
        const active = index === selectedIndex;
        return (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              onSelect(index);
              scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
            }}
            style={{ height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" }}
          >
            <AppText variant={active ? "title" : "body"} tone={active ? "primary" : "muted"}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

/**
 * 时间滚轮弹层：两列（时 / 分）滚轮，居中冒号，底部取消/确定。
 * 只在确定时回调，取消不改动原值。
 */
function TimeWheelModal({
  visible,
  value,
  onCancel,
  onConfirm
}: {
  visible: boolean;
  value: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const initial = parseTime(value);
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);

  // 每次打开都以外部当前值为准重置滚轮。
  useEffect(() => {
    if (visible) {
      const parsed = parseTime(value);
      setHours(parsed.hours);
      setMinutes(parsed.minutes);
    }
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityLabel="关闭时间选择"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }}
          onPress={onCancel}
        />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.lg,
            paddingBottom: spacing.lg + insets.bottom,
            gap: spacing.md
          }}
        >
          <AppText variant="section">选择时间</AppText>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            {/* 中间高亮框：标出滚轮的选中行。 */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: spacing.xl,
                right: spacing.xl,
                height: ITEM_HEIGHT,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceTint
              }}
            />
            <WheelColumn values={HOURS} selectedIndex={hours} onSelect={setHours} />
            <AppText variant="title" tone="primary" style={{ paddingHorizontal: spacing.sm }}>
              :
            </AppText>
            <WheelColumn values={MINUTES} selectedIndex={minutes} onSelect={setMinutes} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <AppButton title="取消" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
            <AppButton
              title="确定"
              onPress={() => onConfirm(`${pad2(hours)}:${pad2(minutes)}`)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * 时间选择字段：一行可点击的展示（标签 + 当前 HH:MM + 时钟图标），
 * 点击弹出滚轮选择器。取代手输时间的 TextField，产出值恒为合法 "HH:MM"。
 */
export function TimePickerField({
  label,
  value,
  onChange
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: spacing.sm }}>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}：${value}` : value}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          {
            minHeight: 50,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.inputBackground,
            paddingHorizontal: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          },
          pressed ? { opacity: 0.85 } : null
        ]}
      >
        <AppText variant="body" style={{ fontSize: 16 }}>
          {value}
        </AppText>
        <Ionicons name="time-outline" size={20} color={colors.muted} />
      </Pressable>
      <TimeWheelModal
        visible={open}
        value={value}
        onCancel={() => setOpen(false)}
        onConfirm={(next) => {
          setOpen(false);
          onChange(next);
        }}
      />
    </View>
  );
}
