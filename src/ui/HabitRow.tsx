import { Pressable, View } from "react-native";
import { Habit } from "../habits/types";
import { CheckButton } from "./CheckButton";
import { AppText, Badge } from "./Controls";
import { radius, spacing } from "./theme";
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

export function HabitRow({
  habit,
  isCompleted,
  onComplete,
  onCelebrate,
  onOpen,
  streak,
  showCheck = true
}: {
  habit: Habit;
  isCompleted: boolean;
  onComplete: () => void;
  onCelebrate?: () => void;
  onOpen: () => void;
  streak?: number;
  showCheck?: boolean;
}) {
  const { colors } = useTheme();
  const dimmed = isCompleted || habit.isPaused;

  const meta: string[] = [frequencyLabel(habit)];
  meta.push(habit.reminderTime ? `提醒 ${habit.reminderTime}` : "无提醒");
  if (habit.trackType === "numeric" && habit.numericUnit) {
    meta.push(habit.numericUnit);
  }

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: dimmed ? colors.surfaceMuted : colors.surface,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md
        },
        pressed ? { opacity: 0.85 } : null
      ]}
    >
      {showCheck ? (
        <CheckButton
          checked={isCompleted}
          disabled={habit.isPaused}
          accessibilityLabel={isCompleted ? "已完成" : `完成 ${habit.name}`}
          onComplete={onComplete}
          onCelebrate={onCelebrate}
          optimistic={habit.trackType !== "numeric"}
        />
      ) : null}

      <View style={{ flex: 1, gap: 3 }}>
        <AppText
          variant="bodyStrong"
          tone={dimmed ? "muted" : "default"}
          numberOfLines={1}
          style={isCompleted ? { textDecorationLine: "line-through" } : null}
        >
          {habit.name}
        </AppText>
        <AppText variant="small" tone="faint" numberOfLines={1}>
          {meta.join(" · ")}
        </AppText>
      </View>

      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {habit.isPaused ? (
          <Badge label="已暂停" tone="muted" />
        ) : typeof streak === "number" && streak > 0 ? (
          <Badge label={`连续 ${streak} 天`} tone="success" />
        ) : null}
      </View>
    </Pressable>
  );
}
