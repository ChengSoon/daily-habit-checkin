import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { companionClient } from "../src/pet/companionClient";
import { CompanionMemoryPanel } from "../src/pet/CompanionMemoryPanel";
import {
  bondPresentation,
  chatClearConfirmation,
  memoryDeleteConfirmation,
  normalizeMemberPreferences
} from "../src/pet/companionSettingsModel";
import type {
  CompanionMemory,
  CompanionState,
  MemberPreferences
} from "../src/pet/companionTypes";
import { PetSprite } from "../src/pet/PetSprite";
import { usePetOptional } from "../src/pet/PetContext";
import { getAppSettings } from "../src/settings/settingsRepository";
import {
  AppButton,
  AppText,
  Divider,
  HelperText,
  SegmentedControl,
  SwitchRow
} from "../src/ui/Controls";
import { Screen } from "../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../src/ui/SyncScreen";
import { useTheme } from "../src/ui/ThemeContext";

export default function CompanionSettingsScreen() {
  const { colors } = useTheme();
  const pet = usePetOptional();
  const [state, setState] = useState<CompanionState | null>(null);
  const [memories, setMemories] = useState<CompanionMemory[]>([]);
  const [quietHours, setQuietHours] = useState<string>("未开启");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextState, nextMemories, settings] = await Promise.all([
      companionClient.getState(),
      companionClient.listMemories(),
      getAppSettings()
    ]);
    setState(nextState);
    setMemories(nextMemories);
    setQuietHours(
      settings.isQuietHoursEnabled
        ? `${settings.quietHoursStart} - ${settings.quietHoursEnd}`
        : "未开启"
    );
  }, []);
  const { status, errorMessage, reload } = useSyncScreen(load);
  const bond = useMemo(() => (state ? bondPresentation(state.bond) : null), [state]);

  async function savePreferences(preferences: MemberPreferences) {
    if (!state) return;
    const previous = state;
    setError(null);
    setState({ ...state, member: { ...state.member, ...preferences } });
    pet?.setVisible(preferences.petVisible);
    try {
      setState(await companionClient.updateState(preferences));
    } catch {
      setState(previous);
      pet?.setVisible(previous.member.petVisible);
      setError("陪伴设置暂时没保存好");
    }
  }

  function confirmDelete(memory: CompanionMemory) {
    Alert.alert("删除共同记忆？", memoryDeleteConfirmation(memory.content), [
      { text: "取消", style: "cancel" },
      {
        text: "确认删除",
        style: "destructive",
        onPress: () => {
          setBusyId(memory.id);
          void companionClient
            .deleteMemory(memory.id)
            .then(() => reload())
            .catch(() => setError("这条共同记忆暂时没删除"))
            .finally(() => setBusyId(null));
        }
      }
    ]);
  }

  function confirmClearChat() {
    Alert.alert("清空共同对话？", chatClearConfirmation(), [
      { text: "取消", style: "cancel" },
      {
        text: "确认清空",
        style: "destructive",
        onPress: () => {
          setBusyId("chat");
          void companionClient
            .clearMessages()
            .then(() => reload())
            .catch(() => setError("共同对话暂时没清空"))
            .finally(() => setBusyId(null));
        }
      }
    ]);
  }

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }
  if (!state || !bond) {
    return <SyncFallback status="loading" errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="返回"
        style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
      >
        <Ionicons name="chevron-back" size={17} color={colors.inkSoft} />
        <AppText variant="small" tone="soft">返回</AppText>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}>
        <PetSprite mood="happy" stateOverride={state.bond.stage === "in_sync" ? "review" : null} size={72} />
        <View style={{ flex: 1, gap: 5 }}>
          <AppText variant="title">卡卡陪伴</AppText>
          <AppText variant="bodyStrong" tone="primary">{bond.label}</AppText>
          <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.surfaceMuted }}>
            <View
              style={{
                width: `${Math.round(bond.progress * 100)}%`,
                height: 7,
                borderRadius: 4,
                backgroundColor: colors.success
              }}
            />
          </View>
          <AppText variant="caption" tone="muted">
            {bond.nextAt === null ? "已经走过很长一段路" : `${state.bond.points} / ${bond.nextAt}`}
          </AppText>
        </View>
      </View>

      <Divider />
      <View style={{ gap: 10 }}>
        <AppText variant="section">陪伴方式</AppText>
        <SwitchRow
          label="显示浮动卡卡"
          description="只影响你看到的浮动宠物"
          value={state.member.petVisible}
          onValueChange={(petVisible) =>
            void savePreferences(
              normalizeMemberPreferences(petVisible, state.member.proactiveMode)
            )
          }
        />
        <AppText variant="caption" tone="muted">主动程度</AppText>
        <SegmentedControl<MemberPreferences["proactiveMode"]>
          value={state.member.proactiveMode}
          onChange={(proactiveMode) =>
            void savePreferences(normalizeMemberPreferences(state.member.petVisible, proactiveMode))
          }
          options={[
            { label: "关闭", value: "off" },
            { label: "克制", value: "restrained" },
            { label: "平衡", value: "balanced" }
          ]}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="moon-outline" size={15} color={colors.muted} />
          <AppText variant="small" tone="muted">免打扰 {quietHours}</AppText>
        </View>
      </View>

      <Divider />
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText variant="section">共同记忆</AppText>
          <AppText variant="caption" tone="muted">双方可见 · {memories.length}</AppText>
        </View>
        <CompanionMemoryPanel memories={memories} busyId={busyId} onDelete={confirmDelete} />
      </View>

      <Divider />
      <View style={{ gap: 8 }}>
        <AppText variant="section">数据管理</AppText>
        <AppButton
          title={busyId === "chat" ? "正在清空…" : "清空共同对话"}
          icon="trash-outline"
          variant="danger"
          fullWidth
          disabled={busyId !== null}
          onPress={confirmClearChat}
        />
        {error ? <HelperText tone="danger">{error}</HelperText> : null}
      </View>
    </Screen>
  );
}
