import { usePathname } from "expo-router";
import { useEffect, useReducer, useRef, useState } from "react";
import { FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createId } from "../utils/id";
import type { CompanionMessage } from "./companionTypes";
import { createCompanionEvent } from "./companionTypes";
import { FloatingPet } from "./FloatingPet";
import { MoodCheckInSheet } from "./MoodCheckInSheet";
import { PetChatPanel } from "./PetChatPanel";
import { usePet } from "./PetContext";
import {
  animationForQuickAction,
  initialPetInteractionState,
  petInteractionReducer,
  type PetQuickAction
} from "./petInteractionState";
import type { PetAnimationState } from "./types";
import { useCompanionEngine } from "./useCompanionEngine";

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
  const engine = useCompanionEngine({
    panelOpen: pet.panelOpen,
    bubbleDismissedAt: pet.bubbleDismissedAt,
    say: pet.say,
    notifyThinking: pet.notifyThinking,
    setVisible: pet.setVisible
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

  function pulse(action: Extract<PetQuickAction, "encouragement" | "reflection">) {
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
    interactionDispatch({ type: "request_selected" });
    pulse(action);
    const type = action === "reflection" ? "daily_reflection" : "quick_encouragement";
    void engine.emit(createCompanionEvent(createId(`pet-${type}`), type, {}));
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
          quickActionsOpen={interaction.quickActionsOpen}
          actionAnimation={actionAnimation}
          onQuickAction={selectQuickAction}
          onDragStart={() => interactionDispatch({ type: "drag_started" })}
        />
      ) : null}

      <PetChatPanel
        visible={pet.panelOpen}
        onClose={pet.closePanel}
        messages={engine.messages}
        listRef={listRef}
        input={engine.input}
        onChangeInput={engine.setInput}
        onSend={() => void engine.sendChat()}
        busy={engine.busy}
        loading={engine.loading}
        streamText={engine.streamText}
        savingMemoryId={engine.savingMemoryId}
        onConfirmMemory={(message) => void engine.confirmMemory(message)}
      />
      {interaction.moodSheetOpen ? (
        <MoodCheckInSheet
          visible
          busy={moodBusy}
          onClose={() => interactionDispatch({ type: "dismissed" })}
          onSubmit={(score, note) => void submitMood(score, note)}
        />
      ) : null}
    </>
  );
}
