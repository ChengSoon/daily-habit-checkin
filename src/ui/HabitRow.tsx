import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Habit } from "../habits/types";
import { Avatar, AvatarTone } from "./Avatar";
import { CheckButton } from "./CheckButton";
import { AppText } from "./Controls";
import { radius, shadow, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

function frequencyLabel(habit: Habit): string {
  if (habit.frequency.type === "daily") {
    return "每天";
  }
  if (habit.frequency.type === "weekdays") {
    return "工作日";
  }
  return "每周";
}

export type HabitCompleter = {
  name: string;
  tone: AvatarTone;
  imageUri?: string | null;
};

/** 设计稿风格习惯行：白卡片 + 薄荷绿勾选 + 右侧糖果色标签 */
export function HabitRow({
  habit,
  isCompleted,
  onComplete,
  onUndo,
  onCelebrate,
  onOpen,
  streak,
  showCheck = true,
  completedBy,
  canUndo = false,
  isUndoing = false,
  xpLabel = "+10 XP",
  icon,
  iconBg,
  iconColor
}: {
  habit: Habit;
  isCompleted: boolean;
  onComplete: () => void;
  onUndo?: () => void;
  onCelebrate?: () => void;
  onOpen: () => void;
  streak?: number;
  showCheck?: boolean;
  completedBy?: HabitCompleter;
  canUndo?: boolean;
  isUndoing?: boolean;
  xpLabel?: string;
  /** 不显示打卡按钮时（如习惯管理页），左侧改用 icon-chip。 */
  icon?: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconColor?: string;
}) {
  const { colors } = useTheme();

  let subtitle = `${frequencyLabel(habit)}`;
  if (isCompleted && completedBy) {
    subtitle = `${completedBy.name} 已完成`;
  } else if (habit.isPaused) {
    subtitle = "已暂停";
  } else if (typeof streak === "number" && streak > 0) {
    subtitle = `连续 ${streak} 天 · ${habit.reminderTime ? `提醒 ${habit.reminderTime}` : "无提醒"}`;
  } else {
    subtitle = `${frequencyLabel(habit)} · ${habit.reminderTime ? `提醒 ${habit.reminderTime}` : "无提醒"}`;
  }

  const hasStreak = typeof streak === "number" && streak > 0;
  const tagBg = isCompleted
    ? colors.successSurface
    : habit.trackType === "numeric"
      ? colors.candySkySurface
      : hasStreak
        ? colors.partnerSurface
        : colors.candySunSurface;
  const tagFg = isCompleted
    ? colors.success
    : habit.trackType === "numeric"
      ? colors.candySky
      : hasStreak
        ? colors.partnerInk
        : colors.candyOrange;
  const tagText = isCompleted
    ? xpLabel
    : habit.trackType === "numeric"
      ? habit.numericUnit
        ? `目标 · ${habit.numericUnit}`
        : "数值"
      : hasStreak
        ? `🔥 ${streak}`
        : "待完成";

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          paddingVertical: 14,
          paddingHorizontal: spacing.md,
          ...shadow.soft
        },
        pressed ? { opacity: 0.92, transform: [{ scale: 0.99 }] } : null
      ]}
    >
      {showCheck ? (
        <CheckButton
          checked={isCompleted}
          disabled={habit.isPaused || isUndoing}
          accessibilityLabel={isCompleted && canUndo ? `撤销 ${habit.name}` : isCompleted ? "已完成" : `完成 ${habit.name}`}
          onComplete={onComplete}
          onUndo={onUndo}
          onCelebrate={onCelebrate}
          optimistic={habit.trackType !== "numeric"}
          canUndo={isCompleted && canUndo}
        />
      ) : icon ? (
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconBg ?? colors.surfaceMuted
          }}
        >
          <Ionicons name={icon} size={21} color={iconColor ?? colors.primaryInk} />
        </View>
      ) : null}

      <View style={{ flex: 1, gap: 4 }}>
        <AppText
          variant="bodyStrong"
          tone={isCompleted || habit.isPaused ? "muted" : "default"}
          numberOfLines={1}
          style={isCompleted ? { textDecorationLine: "line-through" } : null}
        >
          {habit.name}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isCompleted && completedBy ? (
            <Avatar name={completedBy.name} tone={completedBy.tone} size={16} imageUri={completedBy.imageUri} />
          ) : null}
          <AppText variant="small" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
            {subtitle}
          </AppText>
        </View>
      </View>

      <View
        style={{
          borderRadius: radius.pill,
          backgroundColor: tagBg,
          paddingHorizontal: 10,
          paddingVertical: 5
        }}
      >
        <AppText variant="small" style={{ color: tagFg, fontWeight: "800" }} numberOfLines={1}>
          {tagText}
        </AppText>
      </View>
    </Pressable>
  );
}
