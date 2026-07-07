import { Pressable, View } from "react-native";
import { Habit } from "../habits/types";
import { Avatar, AvatarTone } from "./Avatar";
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

export type HabitCompleter = {
  /** 完成者昵称。 */
  name: string;
  /** 完成者分色（you=粉 / partner=紫）。 */
  tone: AvatarTone;
  /** 完成者头像图片 URL（R2 公开域名直读）；没上传则回退字母头像。 */
  imageUri?: string | null;
};

export function HabitRow({
  habit,
  isCompleted,
  onComplete,
  onCelebrate,
  onOpen,
  streak,
  showCheck = true,
  completedBy
}: {
  habit: Habit;
  isCompleted: boolean;
  onComplete: () => void;
  onCelebrate?: () => void;
  onOpen: () => void;
  streak?: number;
  showCheck?: boolean;
  /** 完成者信息，用于已完成项标注是谁打的卡。 */
  completedBy?: HabitCompleter;
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
        {isCompleted && completedBy ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Avatar
              name={completedBy.name}
              tone={completedBy.tone}
              size={20}
              imageUri={completedBy.imageUri}
            />
            <AppText variant="small" tone="muted" numberOfLines={1}>
              {completedBy.name}
            </AppText>
          </View>
        ) : null}
        {habit.isPaused ? (
          <Badge label="已暂停" tone="muted" />
        ) : typeof streak === "number" && streak > 0 ? (
          <Badge label={`连续 ${streak} 天`} tone="primary" />
        ) : null}
      </View>
    </Pressable>
  );
}
