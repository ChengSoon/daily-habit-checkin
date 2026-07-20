import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AppState } from "react-native";
import { listAllCheckIns } from "../checkins/checkinRepository";
import { getAppSettings } from "../settings/settingsRepository";
import { getCurrentAccount, type Account } from "../sync/authService";
import { subscribeAuthTokenChanges } from "../sync/localSettings";
import { subscribeSyncInvalidations } from "../sync/syncInvalidation";
import { createId } from "../utils/id";
import { companionClient } from "./companionClient";
import {
  canStartChat,
  companionEngineReducer,
  initialCompanionEngineState,
  shouldReloadCompanion
} from "./companionEngineState";
import { fallbackForEvent } from "./companionFallback";
import { createCheckInEventTracker } from "./companionEventBridge";
import { memoryActionForMessage } from "./companionMemoryView";
import { shouldAttemptEvent } from "./companionPolicy";
import {
  createCompanionEvent,
  type CompanionEvent,
  type CompanionMessage,
  type CompanionReply
} from "./companionTypes";
import type { PetMood } from "./types";

type EngineOptions = {
  panelOpen: boolean;
  bubbleDismissedAt?: number | null;
  say: (text: string, mood?: PetMood, holdMs?: number) => void;
  notifyThinking: (active: boolean) => void;
  setVisible: (visible: boolean) => void;
};

function assistantMessage(id: string, content: string, riskLevel: CompanionMessage["riskLevel"]): CompanionMessage {
  return {
    id,
    role: "assistant",
    content,
    senderAccountId: null,
    senderName: null,
    riskLevel,
    memoryProposal: null,
    memoryConfirmed: false,
    createdAt: new Date().toISOString()
  };
}

function moodForReply(reply: CompanionReply): PetMood {
  return reply.mood;
}

export function useCompanionEngine(options: EngineOptions) {
  const { bubbleDismissedAt, notifyThinking, panelOpen, say, setVisible } = options;
  const [state, dispatch] = useReducer(companionEngineReducer, initialCompanionEngineState);
  const [input, setInput] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null);
  const stateRef = useRef(state);
  const accountRef = useRef(account);
  const inputRef = useRef(input);
  const panelOpenRef = useRef(panelOpen);
  const quietHoursRef = useRef<
    { isEnabled: boolean; start: string; end: string } | undefined
  >(undefined);
  const chatController = useRef<AbortController | null>(null);
  const eventController = useRef<AbortController | null>(null);
  const checkInEventTracker = useRef(createCheckInEventTracker());
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);
  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  const reloadMessages = useCallback(async (spaceId: string) => {
    dispatch({ type: "load_started", spaceId });
    try {
      const page = await companionClient.listMessages();
      dispatch({ type: "load_succeeded", spaceId, messages: page.items });
    } catch {
      dispatch({ type: "load_failed", spaceId });
    }
  }, []);

  const emit = useCallback(
    async (event: CompanionEvent): Promise<CompanionReply | null> => {
      checkInEventTracker.current.remember(event);
      const currentAccount = accountRef.current;
      if (!currentAccount) return null;
      const gate = shouldAttemptEvent({
        event,
        appState: AppState.currentState,
        panelOpen: panelOpenRef.current,
        typing: !!inputRef.current.trim(),
        bubbleDismissedAt: bubbleDismissedAt ?? null,
        quietHours: quietHoursRef.current,
        now: new Date()
      });
      if (!gate.allowed || eventController.current) return null;
      const controller = new AbortController();
      eventController.current = controller;
      try {
        const reply = await companionClient.respond(event);
        if (
          controller.signal.aborted ||
          accountRef.current?.spaceId !== currentAccount.spaceId ||
          reply.decision === "silent" ||
          !reply.message
        ) {
          return reply;
        }
        say(reply.message, moodForReply(reply), 5200);
        return reply;
      } catch {
        if (controller.signal.aborted) return null;
        const fallback = fallbackForEvent(event);
        if (fallback.message) say(fallback.message, fallback.mood, 4200);
        return fallback;
      } finally {
        if (eventController.current === controller) eventController.current = null;
      }
    },
    [bubbleDismissedAt, say]
  );
  const emitRef = useRef(emit);
  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);
  const refreshAccount = useCallback(async () => {
    const nextAccount = await getCurrentAccount();
    chatController.current?.abort();
    eventController.current?.abort();
    checkInEventTracker.current.reset();
    accountRef.current = nextAccount;
    setAccount(nextAccount);
    dispatch({ type: "space_changed", spaceId: nextAccount?.spaceId ?? null });
    if (!nextAccount) return;
    const [settings, companionState, checkIns] = await Promise.all([
      getAppSettings().catch(() => null),
      companionClient.getState().catch(() => null),
      listAllCheckIns().catch(() => null)
    ]);
    if (accountRef.current?.id !== nextAccount.id) return;
    quietHoursRef.current = settings
      ? {
          isEnabled: settings.isQuietHoursEnabled,
          start: settings.quietHoursStart,
          end: settings.quietHoursEnd
        }
      : undefined;
    if (companionState) setVisible(companionState.member.petVisible);
    if (checkIns) checkInEventTracker.current.seed(checkIns);
    await reloadMessages(nextAccount.spaceId);
    if (accountRef.current?.id !== nextAccount.id) return;
    void emitRef.current(createCompanionEvent(createId("pet-return"), "app_returned", {}));
  }, [reloadMessages, setVisible]);

  useEffect(() => {
    const timer = setTimeout(() => void refreshAccount(), 0);
    const unsubscribe = subscribeAuthTokenChanges(() => void refreshAccount());
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [refreshAccount]);

  const reloadPartnerProgress = useCallback(async (currentAccount: Account) => {
    try {
      const checkIns = await listAllCheckIns();
      if (accountRef.current?.id !== currentAccount.id) return;
      const events = checkInEventTracker.current.reconcile(checkIns, currentAccount.id);
      for (const event of events) await emitRef.current(event);
    } catch {
      // 同步失败不补发旧伙伴进展，下一次 invalidation 会重新建立事实快照。
      checkInEventTracker.current.reset();
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const currentAccount = accountRef.current;
      if (nextState !== "active" || !currentAccount) return;
      void reloadMessages(currentAccount.spaceId);
      void emitRef.current(createCompanionEvent(createId("pet-return"), "app_returned", {}));
    });
    const unsubscribe = subscribeSyncInvalidations((event) => {
      const currentAccount = accountRef.current;
      if (currentAccount && shouldReloadCompanion(event)) {
        void reloadMessages(currentAccount.spaceId);
      }
      if (currentAccount && event.resource === "check_ins") {
        void reloadPartnerProgress(currentAccount);
      }
    });
    return () => {
      subscription.remove();
      unsubscribe();
      chatController.current?.abort();
      eventController.current?.abort();
    };
  }, [reloadMessages, reloadPartnerProgress]);

  useEffect(() => {
    if (panelOpen && accountRef.current) {
      void reloadMessages(accountRef.current.spaceId);
    }
  }, [panelOpen, reloadMessages]);

  const sendChat = useCallback(async () => {
    const text = inputRef.current.trim();
    const currentAccount = accountRef.current;
    if (!text || !currentAccount || !canStartChat(stateRef.current)) return;
    const messageId = createId("pet-u");
    const requestId = createId("pet-r");
    const userMessage: CompanionMessage = {
      id: messageId,
      role: "user",
      content: text,
      senderAccountId: currentAccount.id,
      senderName: currentAccount.displayName,
      riskLevel: "normal",
      memoryProposal: null,
      memoryConfirmed: false,
      createdAt: new Date().toISOString()
    };
    dispatch({ type: "chat_started", requestId, message: userMessage });
    setInput("");
    notifyThinking(true);
    const controller = new AbortController();
    chatController.current = controller;
    try {
      const reply = await companionClient.chat(
        { messageId, message: text, timezoneOffsetMinutes: new Date().getTimezoneOffset() },
        (delta) => dispatch({ type: "chat_delta", requestId, delta }),
        controller.signal
      );
      if (controller.signal.aborted || accountRef.current?.spaceId !== currentAccount.spaceId) return;
      dispatch({
        type: "chat_succeeded",
        requestId,
        message: assistantMessage(createId("pet-a"), reply, "normal")
      });
      say(reply.slice(0, 40) + (reply.length > 40 ? "…" : ""), "happy", 3600);
      void reloadMessages(currentAccount.spaceId);
    } catch {
      if (!controller.signal.aborted) {
        dispatch({
          type: "chat_failed",
          requestId,
          message: assistantMessage(createId("pet-e"), "我暂时没接上话，但我还在这里。", "normal")
        });
      }
    } finally {
      notifyThinking(false);
      if (chatController.current === controller) chatController.current = null;
    }
  }, [notifyThinking, reloadMessages, say]);

  const confirmMemory = useCallback(
    async (message: CompanionMessage) => {
      const currentAccount = accountRef.current;
      if (
        !currentAccount ||
        savingMemoryId ||
        memoryActionForMessage(message) !== "confirm" ||
        !message.memoryProposal
      ) {
        return;
      }
      setSavingMemoryId(message.id);
      try {
        await companionClient.saveMemory(message.memoryProposal, message.id);
        await reloadMessages(currentAccount.spaceId);
        say("这条共同记忆已经收好了。", "happy", 3600);
      } catch {
        say("这次没存好，稍后再试就好。", "sad", 3600);
      } finally {
        setSavingMemoryId(null);
      }
    },
    [reloadMessages, savingMemoryId, say]
  );

  return {
    ...state,
    account,
    input,
    setInput,
    savingMemoryId,
    sendChat,
    confirmMemory,
    emit,
    reloadMessages
  };
}
