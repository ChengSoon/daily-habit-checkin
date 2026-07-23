import { useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import { Alert, type FlatList } from "react-native";
import { getVoiceWakeEnabled, saveVoiceWakeEnabled } from "../sync/localSettings";
import { createId } from "../utils/id";
import { chatClearConfirmation } from "./companionSettingsModel";
import type { CompanionMessage } from "./companionTypes";
import { createCompanionEvent } from "./companionTypes";
import { useCompanionEngine } from "./useCompanionEngine";
import { usePetActionPlayer } from "./petActions";
import {
  feedbackForQuickAction,
  initialPetInteractionState,
  petInteractionReducer,
  type PetQuickAction,
  type RequestedQuickAction
} from "./petInteractionState";
import { usePet } from "./PetContext";
import { usePetRest } from "./petRestState";
import { usePetVoiceConversation } from "./usePetVoiceConversation";
import { usePetVoiceWake } from "./usePetVoiceWake";
import { wakeAcknowledgePhrase } from "./voiceWakeState";

const QUICK_ACTION_PENDING_HOLD_MS = 4200;
const QUICK_ACTION_FALLBACK_HOLD_MS = 3600;
const PETTING_REACTIONS = [
  "嘿嘿，收到你的摸摸啦。",
  "再摸一下，我就要开心得跳起来啦。",
  "嗯，我也在这里陪着你。"
] as const;

type InteractionDispatch = Dispatch<Parameters<typeof petInteractionReducer>[1]>;
type PetContext = ReturnType<typeof usePet>;
type CompanionEngine = ReturnType<typeof useCompanionEngine>;
type VoiceConversation = ReturnType<typeof usePetVoiceConversation>;

function useVoiceWakeController(options: {
  hidden: boolean;
  pet: PetContext;
  engine: CompanionEngine;
  voice: VoiceConversation;
  dispatch: InteractionDispatch;
}) {
  const { hidden, pet, engine, voice, dispatch } = options;
  const [enabled, setEnabled] = useState(false);
  const voiceWake = usePetVoiceWake({
    enabled: enabled && pet.visible && !hidden && !pet.panelOpen && !engine.busy && !engine.clearing,
    onWake: (command) => {
      dispatch({ type: "dismissed" });
      pet.openPanel();
      const trimmed = command.trim();
      if (trimmed) return void voice.start({ initialTranscript: trimmed });
      const greeting = wakeAcknowledgePhrase();
      pet.say(greeting, "wave", 2800);
      void voice.start({ wakeGreeting: greeting });
    }
  });
  useEffect(() => {
    void getVoiceWakeEnabled().then(setEnabled).catch(() => undefined);
  }, []);
  const toggle = () => {
    dispatch({ type: "request_selected" });
    const next = !enabled;
    setEnabled(next);
    void saveVoiceWakeEnabled(next).catch(() => {
      setEnabled(!next);
      pet.say("语音唤醒设置没有保存，请稍后再试。", "waiting", 4200);
    });
    pet.say(next ? "语音唤醒已开启，说“卡卡”就能叫我。" : "语音唤醒已关闭。",
      next ? "happy" : "waiting", 4200);
  };
  return { enabled, voiceWake, toggle };
}

function usePetRuntimeEffects(options: {
  pet: PetContext;
  engine: CompanionEngine;
  stopAction: () => void;
  restState: string;
  dispatch: InteractionDispatch;
  wakeError: string | null;
  listRef: React.RefObject<FlatList<CompanionMessage> | null>;
}) {
  const { pet, engine, stopAction, restState, dispatch, wakeError, listRef } = options;
  const { panelOpen, clearBubble, subscribeCompanionEvents, say } = pet;
  const { emit, messages, streamText } = engine;
  const wakeErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (panelOpen) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [listRef, messages.length, panelOpen, streamText]);
  useEffect(() => {
    if (!panelOpen) return;
    stopAction();
    dispatch({ type: "dismissed" });
  }, [dispatch, panelOpen, stopAction]);
  useEffect(() => {
    if (restState === "awake") return;
    stopAction();
    clearBubble();
    dispatch({ type: "dismissed" });
  }, [clearBubble, dispatch, restState, stopAction]);
  useEffect(() => subscribeCompanionEvents((event) => void emit(event)), [emit, subscribeCompanionEvents]);
  useEffect(() => {
    if (!wakeError) return void (wakeErrorRef.current = null);
    if (wakeError === wakeErrorRef.current) return;
    wakeErrorRef.current = wakeError;
    say(wakeError, "waiting", 4600);
  }, [say, wakeError]);
}

function handleLocalQuickAction(options: {
  action: PetQuickAction;
  dispatch: InteractionDispatch;
  pet: PetContext;
  playAction: (action: "playful") => void;
}): boolean {
  const { action, dispatch, pet, playAction } = options;
  if (action === "chat") {
    dispatch({ type: "chat_selected" });
    pet.openPanel();
    return true;
  }
  if (action === "mood") {
    dispatch({ type: "mood_selected" });
    return true;
  }
  if (action === "play") {
    dispatch({ type: "request_selected" });
    playAction("playful");
    pet.say("来，和我动一动。", "happy", 3000);
    return true;
  }
  if (action === "breathing") {
    dispatch({ type: "breathing_selected" });
    pet.say("跟着我的节奏，慢一点就好。", "waiting", 3200);
    return true;
  }
  return false;
}

function requestQuickAction(options: {
  action: RequestedQuickAction;
  dispatch: InteractionDispatch;
  pet: PetContext;
  engine: CompanionEngine;
  pulse: (action: RequestedQuickAction) => void;
}) {
  const { action, dispatch, pet, engine, pulse } = options;
  dispatch({ type: "request_selected" });
  pulse(action);
  const feedback = feedbackForQuickAction(action);
  pet.say(feedback.pending, "waiting", QUICK_ACTION_PENDING_HOLD_MS);
  const type = action === "reflection" ? "daily_reflection" : "quick_encouragement";
  void engine.emit(createCompanionEvent({ id: createId(`pet-${type}`), type, payload: {} })).then((reply) => {
    if (!reply || reply.decision === "silent" || !reply.message) {
      pet.say(feedback.quiet, "waiting", QUICK_ACTION_FALLBACK_HOLD_MS);
    }
  }).catch(() => pet.say(feedback.quiet, "waiting", QUICK_ACTION_FALLBACK_HOLD_MS));
}

function useQuickActions(options: {
  markActivity: () => boolean;
  dispatch: InteractionDispatch;
  pet: PetContext;
  engine: CompanionEngine;
  playAction: ReturnType<typeof usePetActionPlayer>["play"];
  toggleVoiceWake: () => void;
}) {
  const { markActivity, dispatch, pet, engine, playAction, toggleVoiceWake } = options;
  const pulse = (action: RequestedQuickAction) => playAction(action === "reflection" ? "curious" : "celebrate");
  return (action: PetQuickAction) => {
    if (markActivity()) return;
    if (action === "voice_wake") return toggleVoiceWake();
    if (handleLocalQuickAction({ action, dispatch, pet, playAction })) return;
    if (action !== "encouragement" && action !== "reflection") return;
    requestQuickAction({ action, dispatch, pet, engine, pulse });
  };
}

function usePetGestures(options: {
  markActivity: () => boolean;
  stopAction: () => void;
  playAction: ReturnType<typeof usePetActionPlayer>["play"];
  dispatch: InteractionDispatch;
  pet: PetContext;
  voice: VoiceConversation;
  engine: CompanionEngine;
}) {
  const { markActivity, stopAction, playAction, dispatch, pet, voice, engine } = options;
  const pettingIndex = useRef(0);
  const [moodBusy, setMoodBusy] = useState(false);
  const wakeSleeping = () => {
    if (!markActivity()) return false;
    stopAction();
    dispatch({ type: "dismissed" });
    return true;
  };
  const petKaka = () => {
    if (wakeSleeping()) return;
    dispatch({ type: "pet_long_pressed" });
    playAction("petting");
    pet.say(PETTING_REACTIONS[pettingIndex.current++ % PETTING_REACTIONS.length], "happy", 3800);
  };
  const tapKaka = () => {
    if (!wakeSleeping()) dispatch({ type: "pet_tapped" });
  };
  const submitMood = async (score: 1 | 2 | 3 | 4 | 5, note: string) => {
    setMoodBusy(true);
    try {
      await engine.emit(createCompanionEvent({ id: createId("pet-mood"), type: "mood_checkin", payload: { score, note } }));
      dispatch({ type: "dismissed" });
    } finally {
      setMoodBusy(false);
    }
  };
  const closePanel = () => {
    voice.stop();
    pet.closePanel();
  };
  return { moodBusy, petKaka, tapKaka, submitMood, closePanel };
}

function confirmNewConversation(engine: CompanionEngine) {
  Alert.alert("开启新对话？", chatClearConfirmation(), [
    { text: "取消", style: "cancel" },
    { text: "开启新对话", style: "destructive", onPress: () => {
      void engine.startNewConversation().then((cleared) => {
        if (!cleared) Alert.alert("新对话未开启", "共同对话没有清空，请稍后再试。", [{ text: "知道了" }]);
      });
    } }
  ]);
}

export function useGlobalPetController(hidden: boolean) {
  const pet = usePet();
  const [interaction, dispatch] = useReducer(petInteractionReducer, initialPetInteractionState);
  const action = usePetActionPlayer();
  const rest = usePetRest();
  const engine = useCompanionEngine({ panelOpen: pet.panelOpen, bubbleDismissedAt: pet.bubbleDismissedAt,
    say: pet.say, notifyThinking: pet.notifyThinking, setVisible: pet.setVisible });
  const voice = usePetVoiceConversation({ disabled: engine.busy || engine.clearing, sendMessage: engine.sendChat });
  const wake = useVoiceWakeController({ hidden, pet, engine, voice, dispatch });
  const listRef = useRef<FlatList<CompanionMessage>>(null);
  usePetRuntimeEffects({ pet, engine, stopAction: action.stop, restState: rest.state,
    dispatch, wakeError: wake.voiceWake.errorMessage, listRef });
  const selectQuickAction = useQuickActions({ markActivity: rest.markActivity, dispatch, pet, engine,
    playAction: action.play, toggleVoiceWake: wake.toggle });
  const gestures = usePetGestures({ markActivity: rest.markActivity, stopAction: action.stop,
    playAction: action.play, dispatch, pet, voice, engine });
  const dragStart = () => {
    action.stop();
    rest.markActivity();
    dispatch({ type: "drag_started" });
  };
  return { pet, interaction, dispatch, action, rest, engine, voice, wake, listRef,
    selectQuickAction, dragStart, confirmNewConversation: () => confirmNewConversation(engine), ...gestures };
}

export type GlobalPetController = ReturnType<typeof useGlobalPetController>;
