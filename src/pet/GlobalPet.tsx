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
  feedbackForQuickAction,
  initialPetInteractionState,
  petInteractionReducer,
  type PetQuickAction,
  type RequestedQuickAction
} from "./petInteractionState";
import { usePetActionPlayer } from "./petActions";
import { usePetRest } from "./petRestState";
import { useCompanionEngine } from "./useCompanionEngine";
import { usePetVoiceConversation } from "./usePetVoiceConversation";
import { usePetVoiceWake } from "./usePetVoiceWake";
import { wakeAcknowledgePhrase } from "./voiceWakeState";
import { chatClearConfirmation } from "./companionSettingsModel";
import { getVoiceWakeEnabled, saveVoiceWakeEnabled } from "../sync/localSettings";

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
  const clearPetBubble = pet.clearBubble;
  const [interaction, interactionDispatch] = useReducer(
    petInteractionReducer,
    initialPetInteractionState
  );
  const [moodBusy, setMoodBusy] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const pettingIndex = useRef(0);
  const wakeErrorRef = useRef<string | null>(null);
  const {
    animation: actionAnimation,
    play: playAction,
    stop: stopAction
  } = usePetActionPlayer();
  const {
    state: restState,
    animation: restAnimation,
    markActivity: markPetActivity
  } = usePetRest();
  const onAiTab = pathname === "/ai" || pathname?.endsWith("/ai");
  const engine = useCompanionEngine({
    panelOpen: pet.panelOpen,
    bubbleDismissedAt: pet.bubbleDismissedAt,
    say: pet.say,
    notifyThinking: pet.notifyThinking,
    setVisible: pet.setVisible
  });
  const voice = usePetVoiceConversation({
    // 历史消息加载中不应禁用语音，否则唤醒开面板后 start 会半路静默退出。
    disabled: engine.busy || engine.clearing,
    sendMessage: engine.sendChat
  });
  const voiceWake = usePetVoiceWake({
    enabled:
      wakeEnabled &&
      pet.visible &&
      !onAiTab &&
      !pet.panelOpen &&
      !engine.busy &&
      !engine.clearing,
    onWake: (command) => {
      interactionDispatch({ type: "dismissed" });
      pet.openPanel();
      const trimmed = command.trim();
      if (trimmed) {
        void voice.start({ initialTranscript: trimmed });
        return;
      }
      const greeting = wakeAcknowledgePhrase();
      pet.say(greeting, "wave", 2800);
      void voice.start({ wakeGreeting: greeting });
    }
  });
  const emitCompanionEvent = engine.emit;
  const subscribeCompanionEvents = pet.subscribeCompanionEvents;
  const listRef = useRef<FlatList<CompanionMessage>>(null);

  useEffect(() => {
    if (!pet.panelOpen) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [engine.messages.length, engine.streamText, pet.panelOpen]);

  useEffect(() => {
    if (!pet.panelOpen) return;
    stopAction();
    interactionDispatch({ type: "dismissed" });
  }, [pet.panelOpen, stopAction]);

  useEffect(() => {
    if (restState === "awake") return;
    stopAction();
    clearPetBubble();
    interactionDispatch({ type: "dismissed" });
  }, [clearPetBubble, restState, stopAction]);

  useEffect(
    () => subscribeCompanionEvents((event) => void emitCompanionEvent(event)),
    [emitCompanionEvent, subscribeCompanionEvents]
  );

  useEffect(() => {
    void getVoiceWakeEnabled().then(setWakeEnabled).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!voiceWake.errorMessage) {
      wakeErrorRef.current = null;
      return;
    }
    if (voiceWake.errorMessage === wakeErrorRef.current) return;
    wakeErrorRef.current = voiceWake.errorMessage;
    pet.say(voiceWake.errorMessage, "waiting", 4600);
  }, [pet, voiceWake.errorMessage]);

  function pulse(action: RequestedQuickAction) {
    playAction(action === "reflection" ? "curious" : "celebrate");
  }

  function selectQuickAction(action: PetQuickAction) {
    if (markPetActivity()) return;
    if (action === "voice_wake") {
      interactionDispatch({ type: "request_selected" });
      const nextEnabled = !wakeEnabled;
      setWakeEnabled(nextEnabled);
      void saveVoiceWakeEnabled(nextEnabled).catch(() => {
        setWakeEnabled(!nextEnabled);
        pet.say("语音唤醒设置没有保存，请稍后再试。", "waiting", 4200);
      });
      pet.say(
        nextEnabled ? "语音唤醒已开启，说“卡卡”就能叫我。" : "语音唤醒已关闭。",
        nextEnabled ? "happy" : "waiting",
        4200
      );
      return;
    }
    if (action === "chat") {
      interactionDispatch({ type: "chat_selected" });
      pet.openPanel();
      return;
    }
    if (action === "mood") {
      interactionDispatch({ type: "mood_selected" });
      return;
    }
    if (action === "play") {
      interactionDispatch({ type: "request_selected" });
      playAction("playful");
      pet.say("来，和我动一动。", "happy", 3000);
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
    if (wakeSleepingPet()) return;
    interactionDispatch({ type: "pet_long_pressed" });
    playAction("petting");
    const message = PETTING_REACTIONS[pettingIndex.current % PETTING_REACTIONS.length];
    pettingIndex.current += 1;
    pet.say(message, "happy", 3800);
  }

  function wakeSleepingPet(): boolean {
    if (!markPetActivity()) return false;
    stopAction();
    interactionDispatch({ type: "dismissed" });
    return true;
  }

  function tapKaka() {
    if (wakeSleepingPet()) return;
    interactionDispatch({ type: "pet_tapped" });
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
          onPress={tapKaka}
          onLongPress={petKaka}
          wakeEnabled={wakeEnabled}
          wakeActive={voiceWake.active}
          quickActionsOpen={interaction.quickActionsOpen}
          actionAnimation={actionAnimation}
          restAnimation={restAnimation}
          onQuickAction={selectQuickAction}
          onDragStart={() => {
            stopAction();
            markPetActivity();
            interactionDispatch({ type: "drag_started" });
          }}
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
        currentAccountId={engine.account?.id ?? null}
        executingActionId={engine.executingActionId}
        onConfirmAction={(message) => void engine.confirmAction(message)}
        onCancelAction={(message) => void engine.cancelAction(message)}
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
