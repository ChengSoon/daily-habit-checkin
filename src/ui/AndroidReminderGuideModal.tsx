import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ANDROID_REMINDER_GUIDE_STEPS,
  type AndroidReminderGuideStepId,
  markAndroidReminderGuideCompleted
} from "../reminders/androidReminderGuide";
import {
  openAppDetailsSettings,
  openAppNotificationSettings,
  openExactAlarmSettings,
  requestReminderPermission,
  scheduleTestSystemReminder
} from "../reminders/reminderService";
import { AppButton, AppText, HelperText } from "./Controls";
import { useTheme } from "./ThemeContext";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPermissionChanged?: (granted: boolean) => void;
};

/**
 * Android 后台提醒引导：把「用户不知道要设什么」收成可点的 5 步。
 * 仅 Android 使用；关闭时可选标记已完成。
 */
export function AndroidReminderGuideModal({ visible, onClose, onPermissionChanged }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [busyStep, setBusyStep] = useState<AndroidReminderGuideStepId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<AndroidReminderGuideStepId>>(() => new Set());

  const steps = useMemo(() => ANDROID_REMINDER_GUIDE_STEPS, []);

  async function runStep(stepId: AndroidReminderGuideStepId): Promise<void> {
    setBusyStep(stepId);
    setMessage(null);
    try {
      if (stepId === "permission") {
        const granted = await requestReminderPermission();
        onPermissionChanged?.(granted);
        if (!granted) {
          setMessage("仍未获得通知权限，请在系统设置里手动开启。");
          return;
        }
        setDoneSteps((prev) => new Set(prev).add(stepId));
        setMessage("通知权限已开启。");
        return;
      }

      if (stepId === "battery") {
        await openAppDetailsSettings();
        setDoneSteps((prev) => new Set(prev).add(stepId));
        setMessage("请在打开的页面里把电池/后台设为「无限制」，并关闭智能优化。");
        return;
      }

      if (stepId === "banner") {
        await openAppNotificationSettings();
        setDoneSteps((prev) => new Set(prev).add(stepId));
        setMessage("请打开「打卡提醒」渠道的横幅 / 悬浮通知。");
        return;
      }

      if (stepId === "exactAlarm") {
        await openExactAlarmSettings();
        setDoneSteps((prev) => new Set(prev).add(stepId));
        setMessage("请允许本应用使用闹钟和提醒。");
        return;
      }

      const id = await scheduleTestSystemReminder(8);
      if (!id) {
        setMessage("无法调度测试通知，请先完成第 1 步开启权限。");
        return;
      }
      setDoneSteps((prev) => new Set(prev).add(stepId));
      setMessage("已安排 8 秒后测试。请立刻按 Home 退到桌面等待顶部弹框。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusyStep(null);
    }
  }

  async function finish(markDone: boolean): Promise<void> {
    if (markDone) {
      await markAndroidReminderGuideCompleted().catch(() => undefined);
    }
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => void finish(false)}>
      <View style={[styles.backdrop, { backgroundColor: "rgba(12, 16, 28, 0.45)" }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => void finish(false)} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 16),
              borderColor: colors.line
            }
          ]}
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
          </View>

          <View style={styles.header}>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="section">后台提醒保护</AppText>
              <AppText variant="small" tone="muted">
                安卓手机会限制后台应用。按下面 5 步设置后，到点才能稳定弹出系统通知。
              </AppText>
            </View>
            <Pressable onPress={() => void finish(false)} hitSlop={10} accessibilityLabel="关闭">
              <Ionicons name="close" size={22} color={colors.inkSoft} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
            {steps.map((step) => {
              const done = doneSteps.has(step.id);
              return (
                <View
                  key={step.id}
                  style={[
                    styles.stepCard,
                    {
                      backgroundColor: colors.surfaceTint,
                      borderColor: done ? colors.success : colors.line
                    }
                  ]}
                >
                  <View style={styles.stepTitleRow}>
                    <AppText variant="bodyStrong" style={{ flex: 1 }}>
                      {step.title}
                    </AppText>
                    {done ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
                  </View>
                  <AppText variant="small" tone="muted">
                    {step.detail}
                  </AppText>
                  <AppButton
                    title={step.actionLabel}
                    variant={done ? "secondary" : "primary"}
                    onPress={() => void runStep(step.id)}
                    disabled={busyStep !== null}
                  />
                </View>
              );
            })}
          </ScrollView>

          {message ? <HelperText>{message}</HelperText> : null}

          <View style={{ gap: 8, marginTop: 4 }}>
            <AppButton title="我已设置完成" onPress={() => void finish(true)} />
            <AppButton title="稍后再说" variant="secondary" onPress={() => void finish(false)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
    maxHeight: "92%"
  },
  handleRow: {
    alignItems: "center",
    paddingBottom: 4
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  stepCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8
  },
  stepTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  }
});
