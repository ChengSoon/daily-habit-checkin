import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Habit } from "../habits/types";
import { Avatar, AvatarTone } from "./Avatar";
import { CheckButton } from "./CheckButton";
import { AppText } from "./Controls";
import { radius, shadow } from "./theme";
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

/**
 * board 01/02 习惯行：
 * - 勾选圆（薄荷绿 on）
 * - 标题 Outfit 14
 * - 完成态：小头像 + 文案；右侧薄荷 +XP
 * - 数值未完成：天空进度条 + n/target 标签
 */
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
  xpLabel = "+10",
  numericValue,
  numericTarget,
  dualLabel,
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
  /** 数值习惯当前值（今日页） */
  numericValue?: number | null;
  numericTarget?: number | null;
  /** board「双人」标签 */
  dualLabel?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconColor?: string;
}) {
  const { colors } = useTheme();

  let subtitle = `${frequencyLabel(habit)}`;
  if (isCompleted && completedBy) {
    subtitle = `${completedBy.name} 已完成`;
  } else if (isCompleted) {
    subtitle = "已完成";
  } else if (habit.isPaused) {
    subtitle = "已暂停";
  } else if (typeof streak === "number" && streak > 0) {
    subtitle = `连续 ${streak} 天${habit.reminderTime ? `，里程碑将至` : ""}`;
  } else {
    subtitle = `${frequencyLabel(habit)}${habit.reminderTime ? ` · 提醒 ${habit.reminderTime}` : ""}`;
  }

  const shortXp = xpLabel.replace(/\s*XP$/i, "").replace(/^\+?/, "+");
  const hasNumericProgress =
    !isCompleted &&
    habit.trackType === "numeric" &&
    typeof numericTarget === "number" &&
    numericTarget > 0;
  const progressRatio = hasNumericProgress
    ? Math.max(0, Math.min(1, (typeof numericValue === "number" ? numericValue : 0) / (numericTarget as number)))
    : 0;

  let tagBg = colors.surfaceTint;
  let tagFg = colors.primaryInk;
  let tagText = shortXp;
  if (isCompleted) {
    tagBg = colors.successSurface;
    tagFg = colors.candyMintInk;
    tagText = shortXp;
  } else if (dualLabel) {
    tagBg = colors.partnerSurface;
    tagFg = colors.partnerInk;
    tagText = "双人";
  } else if (hasNumericProgress) {
    tagBg = colors.candySkySurface;
    tagFg = colors.candySkyInk;
    const current = typeof numericValue === "number" ? numericValue : 0;
    tagText = `${current} / ${numericTarget}`;
  } else if (habit.trackType === "numeric") {
    tagBg = colors.candySkySurface;
    tagFg = colors.candySkyInk;
    tagText = habit.numericUnit ? `目标 · ${habit.numericUnit}` : "数值";
  }

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          paddingVertical: 11,
          paddingHorizontal: 13,
          ...shadow.soft
        },
        pressed ? { opacity: 0.92, transform: [{ scale: 0.99 }] } : null
      ]}
    >
      {showCheck ? (
        <CheckButton
          checked={isCompleted}
          disabled={habit.isPaused || isUndoing}
          accessibilityLabel={
            isCompleted && canUndo ? `撤销 ${habit.name}` : isCompleted ? "已完成" : `完成 ${habit.name}`
          }
          onComplete={onComplete}
          onUndo={onUndo}
          onCelebrate={onCelebrate}
          optimistic={habit.trackType !== "numeric"}
          canUndo={isCompleted && canUndo}
        />
      ) : icon ? (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconBg ?? colors.surfaceMuted
          }}
        >
          <Ionicons name={icon} size={22} color={iconColor ?? colors.primaryInk} />
        </View>
      ) : null}

      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <AppText
            variant="bodyStrong"
            tone={habit.isPaused ? "muted" : "default"}
            numberOfLines={1}
            style={{ fontFamily: "Outfit_700Bold", fontSize: 16, flex: 1, letterSpacing: 0 }}
          >
            {habit.name}
          </AppText>
          <View
            style={{
              borderRadius: radius.pill,
              backgroundColor: tagBg,
              paddingHorizontal: 9,
              paddingVertical: 4
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              {dualLabel && !isCompleted ? <Ionicons name="people-outline" size={11} color={tagFg} /> : null}
              <AppText
                variant="small"
                style={{ color: tagFg, fontWeight: "800", fontSize: 12, lineHeight: 16 }}
                numberOfLines={1}
              >
                {tagText}
              </AppText>
            </View>
          </View>
        </View>

        {hasNumericProgress ? (
          <View style={{ gap: 6, marginTop: 2 }}>
            <View
              style={{
                height: 9,
                borderRadius: 999,
                backgroundColor: "#EEF1F7",
                overflow: "hidden"
              }}
            >
              <View style={{ height: "100%", width: `${Math.round(progressRatio * 100)}%`, borderRadius: 999, overflow: "hidden" }}>
                <Svg width="200" height="9" viewBox="0 0 100 9" preserveAspectRatio="none" style={{ width: "100%", height: 9 }}>
                  <Defs>
                    <LinearGradient id="numProg" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0%" stopColor={colors.candySky} />
                      <Stop offset="100%" stopColor={colors.partner} />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100" height="9" fill="url(#numProg)" />
                </Svg>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {isCompleted && completedBy ? (
              <Avatar name={completedBy.name} tone={completedBy.tone} size={22} imageUri={completedBy.imageUri} />
            ) : null}
            <AppText variant="small" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
              {subtitle}
            </AppText>
          </View>
        )}
      </View>
    </Pressable>
  );
}
