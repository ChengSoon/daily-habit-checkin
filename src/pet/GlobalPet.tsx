import { usePathname } from "expo-router";
import { useEffect, useReducer, useRef, useState } from "react";
import { Alert, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createId } from "../utils/id";
import type { CompanionMessage } from "./companionTypes";
import { BreathingSheet } from "./BreathingSheet";
import { createCompanionEvent } from "./companionTypes";
import { FloatingPet } from "./FloatingPet";
import { MoodCheckInSheet } from "./MoodCheckInSheet";
import { PetChatPanel } from "./PetChatPanel";
import { usePet } from "./PetContext";
import {
  animationForQuickAction,
  feedbackForQuickAction,
  initialPetInteractionState,
  petInteractionReducer,
  type PetQuickAction,
  type RequestedQuickAction
} from "./petInteractionState";
import type { PetAnimationState } from "./types";
import { useCompanionEngine } from "./useCompanionEngine";
import { usePetVoiceConversation } from "./usePetVoiceConversation";
import { chatClearConfirmation } from "./companionSettingsModel";

const QUICK_ACTION_PENDING_HOLD_MS = 4200;
const QUICK_ACTION_FALLBACK_HOLD_MS = 3600;
const PETTING_REACTIONS = [
  "嘿嘿，收到你的摸摸啦。",
  "再摸一下，我就要开心得跳起来啦。",
  "嗯，我也在这里陪着你。"
] as const;

/** 全局浮层：右下角宠物 + 气泡 + 对话面板。 */
export function GlobalPet() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pet = usePet();
  const [interaction, interactionDispatch] = useReducer(
    petInteractionReducer,
    initialPetInteractionState
  );
  const [actionAnimation, setActionAnimation] = useState<PetAnimationState | null>(null);
  const [moodBusy, setMoodBusy] = useState(false);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pettingIndex = useRef(0);
  const engine = useCompanionEngine({
    panelOpen: pet.panelOpen,
    bubbleDismissedAt: pet.bubbleDismissedAt,
    say: pet.say,
    notifyThinking: pet.notifyThinking,
    setVisible: pet.setVisible
  });
  const voice = usePetVoiceConversation({
    disabled: engine.busy || engine.clearing || engine.loading,
    sendMessage: engine.sendChat
  });
  const emitCompanionEvent = engine.emit;
  const subscribeCompanionEvents = pet.subscribeCompanionEvents;
  const listRef = useRef<FlatList<CompanionMessage>>(null);

  useEffect(
    () => () => {
      if (actionTimer.current) clearTimeout(actionTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!pet.panelOpen) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [engine.messages.length, engine.streamText, pet.panelOpen]);

  useEffect(() => {
    if (pet.panelOpen) interactionDispatch({ type: "dismissed" });
  }, [pet.panelOpen]);

  useEffect(
    () => subscribeCompanionEvents((event) => void emitCompanionEvent(event)),
    [emitCompanionEvent, subscribeCompanionEvents]
  );

  function pulse(action: RequestedQuickAction) {
    if (actionTimer.current) clearTimeout(actionTimer.current);
    setActionAnimation(animationForQuickAction(action));
    actionTimer.current = setTimeout(() => setActionAnimation(null), 1800);
  }

  function selectQuickAction(action: PetQuickAction) {
    if (action === "chat") {
      interactionDispatch({ type: "chat_selected" });
      pet.openPanel();
      return;
    }
    if (action === "mood") {
      interactionDispatch({ type: "mood_selected" });
      return;
    }
    if (action === "breathing") {
      interactionDispatch({ type: "breathing_selected" });
      pet.say("跟着我的节奏，慢一点就好。", "waiting", 3200);
      return;
    }
    interactionDispatch({ type: "request_selected" });
    pulse(action);
    const feedback = feedbackForQuickAction(action);
    pet.say(feedback.pending, "waiting", QUICK_ACTION_PENDING_HOLD_MS);
    const type = action === "reflection" ? "daily_reflection" : "quick_encouragement";
    void engine
      .emit(createCompanionEvent(createId(`pet-${type}`), type, {}))
      .then((reply) => {
        if (!reply || reply.decision === "silent" || !reply.message) {
          pet.say(feedback.quiet, "waiting", QUICK_ACTION_FALLBACK_HOLD_MS);
        }
      })
      .catch(() => {
        pet.say(feedback.quiet, "waiting", QUICK_ACTION_FALLBACK_HOLD_MS);
      });
  }

  function petKaka() {
    interactionDispatch({ type: "pet_long_pressed" });
    if (actionTimer.current) clearTimeout(actionTimer.current);
    setActionAnimation("waving");
    actionTimer.current = setTimeout(() => setActionAnimation(null), 1800);
    const message = PETTING_REACTIONS[pettingIndex.current % PETTING_REACTIONS.length];
    pettingIndex.current += 1;
    pet.say(message, "happy", 3800);
  }

  async function submitMood(score: 1 | 2 | 3 | 4 | 5, note: string) {
    setMoodBusy(true);
    try {
      await engine.emit(
        createCompanionEvent(createId("pet-mood"), "mood_checkin", { score, note })
      );
      interactionDispatch({ type: "dismissed" });
    } finally {
      setMoodBusy(false);
    }
  }

  function confirmNewConversation() {
    Alert.alert("开启新对话？", chatClearConfirmation(), [
      { text: "取消", style: "cancel" },
      {
        text: "开启新对话",
        style: "destructive",
        onPress: () => {
          void engine.startNewConversation().then((cleared) => {
            if (!cleared) {
              Alert.alert("新对话未开启", "共同对话没有清空，请稍后再试。", [{ text: "知道了" }]);
            }
          });
        }
      }
    ]);
  }

  function closeChatPanel() {
    voice.stop();
    pet.closePanel();
  }

  // AI 页已有完整对话，隐藏浮宠避免双入口；面板打开时仍显示
  const onAiTab = pathname === "/ai" || pathname?.endsWith("/ai");
  if (!pet.visible || (onAiTab && !pet.panelOpen)) {
    return null;
  }

  const bottom = Math.max(insets.bottom, 8) + 62;

  return (
    <>
      {!onAiTab ? (
        <FloatingPet
          mood={pet.mood}
          bubble={pet.bubble}
          bottomInset={bottom}
          topInset={insets.top}
          onClearBubble={pet.clearBubble}
          onPress={() => interactionDispatch({ type: "pet_tapped" })}
          onLongPress={petKaka}
          quickActionsOpen={interaction.quickActionsOpen}
          actionAnimation={actionAnimation}
          onQuickAction={selectQuickAction}
          onDragStart={() => interactionDispatch({ type: "drag_started" })}
        />
      ) : null}

      <PetChatPanel
        visible={pet.panelOpen}
        onClose={closeChatPanel}
        messages={engine.messages}
        listRef={listRef}
        input={engine.input}
        onChangeInput={engine.setInput}
        onSend={() => void engine.sendChat()}
        onNewConversation={confirmNewConversation}
        busy={engine.busy}
        clearing={engine.clearing}
        loading={engine.loading}
        streamText={engine.streamText}
        savingMemoryId={engine.savingMemoryId}
        onConfirmMemory={(message) => void engine.confirmMemory(message)}
        voiceActive={voice.active}
        voicePhase={voice.phase}
        voiceTranscript={voice.transcript}
        voiceErrorMessage={voice.errorMessage}
        voiceVolume={voice.volume}
        onStartVoice={() => void voice.start()}
        onInterruptVoice={voice.interrupt}
        onStopVoice={voice.stop}
      />
      {interaction.moodSheetOpen ? (
        <MoodCheckInSheet
          visible
          busy={moodBusy}
          onClose={() => interactionDispatch({ type: "dismissed" })}
          onSubmit={(score, note) => void submitMood(score, note)}
        />
      ) : null}
      {interaction.breathingOpen ? (
        <BreathingSheet
          visible
          onClose={() => interactionDispatch({ type: "dismissed" })}
          onComplete={() => pet.say("做得很好，呼吸慢下来了。", "happy", 4200)}
        />
      ) : null}
    </>
  );
}
