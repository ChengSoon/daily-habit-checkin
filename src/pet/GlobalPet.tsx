import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BreathingSheet } from "./BreathingSheet";
import { FloatingPet } from "./FloatingPet";
import { MoodCheckInSheet } from "./MoodCheckInSheet";
import { PetChatPanel } from "./PetChatPanel";
import { useGlobalPetController, type GlobalPetController } from "./useGlobalPetController";

function FloatingLayer({ view, bottom, top }: {
  view: GlobalPetController & { hidden: boolean };
  bottom: number;
  top: number;
}) {
  if (view.hidden) return null;
  return <FloatingPet mood={view.pet.mood} bubble={view.pet.bubble} bottomInset={bottom} topInset={top}
    onClearBubble={view.pet.clearBubble} onPress={view.tapKaka} onLongPress={view.petKaka}
    wakeEnabled={view.wake.enabled} wakeActive={view.wake.voiceWake.active}
    quickActionsOpen={view.interaction.quickActionsOpen} actionAnimation={view.action.animation}
    restAnimation={view.rest.animation} onQuickAction={view.selectQuickAction} onDragStart={view.dragStart} />;
}

function ChatLayer({ view }: { view: GlobalPetController }) {
  return <PetChatPanel visible={view.pet.panelOpen} onClose={view.closePanel}
    messages={view.engine.messages} listRef={view.listRef} input={view.engine.input} onChangeInput={view.engine.setInput}
    onSend={() => void view.engine.sendChat()} onNewConversation={view.confirmNewConversation}
    busy={view.engine.busy} clearing={view.engine.clearing} loading={view.engine.loading}
    streamText={view.engine.streamText} savingMemoryId={view.engine.savingMemoryId}
    onConfirmMemory={(message) => void view.engine.confirmMemory(message)}
    currentAccountId={view.engine.account?.id ?? null} executingActionId={view.engine.executingActionId}
    onConfirmAction={(message) => void view.engine.confirmAction(message)}
    onCancelAction={(message) => void view.engine.cancelAction(message)}
    voiceActive={view.voice.active} voicePhase={view.voice.phase} voiceTranscript={view.voice.transcript}
    voiceErrorMessage={view.voice.errorMessage} voiceVolume={view.voice.volume}
    onStartVoice={() => void view.voice.start()} onInterruptVoice={view.voice.interrupt} onStopVoice={view.voice.stop} />;
}

function PetSheets({ view }: { view: GlobalPetController }) {
  return <>
    {view.interaction.moodSheetOpen ? <MoodCheckInSheet visible busy={view.moodBusy}
      onClose={() => view.dispatch({ type: "dismissed" })}
      onSubmit={(score, note) => void view.submitMood(score, note)} /> : null}
    {view.interaction.breathingOpen ? <BreathingSheet visible
      onClose={() => view.dispatch({ type: "dismissed" })}
      onComplete={() => view.pet.say("做得很好，呼吸慢下来了。", "happy", 4200)} /> : null}
  </>;
}

/** 全局浮层：右下角宠物 + 气泡 + 对话面板。 */
export function GlobalPet() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const onAiTab = pathname === "/ai" || pathname?.endsWith("/ai");
  const hidesFloatingPet = onAiTab || pathname === "/account" || pathname?.startsWith("/admin/");
  const view = useGlobalPetController(hidesFloatingPet);
  const renderView = { ...view, hidden: hidesFloatingPet };

  // AI 与表单页隐藏浮宠避免双入口或遮挡；面板已打开时仍允许显示并关闭。
  if (!view.pet.visible || (hidesFloatingPet && !view.pet.panelOpen)) {
    return null;
  }

  const bottom = Math.max(insets.bottom, 8) + 62;

  return (
    <>
      <FloatingLayer view={renderView} bottom={bottom} top={insets.top} />
      <ChatLayer view={renderView} />
      <PetSheets view={renderView} />
    </>
  );
}
