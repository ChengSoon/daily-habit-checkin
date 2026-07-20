import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { greetingBubble, reactionForCheckIn, reactionForError } from "./petMood";
import type { CompanionEvent } from "./companionTypes";
import type { PetCheckInEvent, PetMood } from "./types";

type CompanionEventHandler = (event: CompanionEvent) => void;

export function createCompanionEventBus() {
  const handlers = new Set<CompanionEventHandler>();
  return {
    emit(event: CompanionEvent) {
      for (const handler of handlers) handler(event);
    },
    subscribe(handler: CompanionEventHandler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }
  };
}

type PetContextValue = {
  mood: PetMood;
  bubble: string | null;
  bubbleDismissedAt: number | null;
  panelOpen: boolean;
  visible: boolean;
  setVisible: (v: boolean) => void;
  openPanel: () => void;
  closePanel: () => void;
  clearBubble: () => void;
  say: (text: string, mood?: PetMood, holdMs?: number) => void;
  emitCompanionEvent: (event: CompanionEvent) => void;
  subscribeCompanionEvents: (handler: CompanionEventHandler) => () => void;
  notifyCheckIn: (event: PetCheckInEvent) => void;
  notifyThinking: (active: boolean) => void;
  notifyError: (message: string) => void;
  greetIfNeeded: () => void;
};

const PetContext = createContext<PetContextValue | null>(null);

const DEFAULT_HOLD_MS = 4200;

export function PetProvider({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState<PetMood>("idle");
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleDismissedAt, setBubbleDismissedAt] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingDepth = useRef(0);
  const greeted = useRef(false);
  const [companionEventBus] = useState(createCompanionEventBus);

  const clearBubbleTimer = useCallback(() => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  }, []);

  const scheduleIdle = useCallback(
    (holdMs: number) => {
      clearBubbleTimer();
      clearTimer.current = setTimeout(() => {
        setBubble(null);
        setMood((current) => (current === "thinking" ? current : "idle"));
      }, holdMs);
    },
    [clearBubbleTimer]
  );

  const say = useCallback(
    (text: string, nextMood: PetMood = "wave", holdMs = DEFAULT_HOLD_MS) => {
      setBubble(text);
      setMood(nextMood);
      if (nextMood !== "thinking") {
        scheduleIdle(holdMs);
      }
    },
    [scheduleIdle]
  );

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    setMood((m) => (m === "thinking" ? m : "waiting"));
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setMood((m) => (m === "thinking" ? m : "idle"));
  }, []);

  const clearBubble = useCallback(() => {
    clearBubbleTimer();
    setBubble(null);
    setBubbleDismissedAt(Date.now());
  }, [clearBubbleTimer]);

  const notifyCheckIn = useCallback(
    (event: PetCheckInEvent) => {
      const reaction = reactionForCheckIn(event);
      say(reaction.bubble, reaction.mood, 5200);
    },
    [say]
  );

  const notifyThinking = useCallback(
    (active: boolean) => {
      if (active) {
        thinkingDepth.current += 1;
        clearBubbleTimer();
        setMood("thinking");
        setBubble("让我想想…");
        return;
      }
      thinkingDepth.current = Math.max(0, thinkingDepth.current - 1);
      if (thinkingDepth.current === 0) {
        setMood("idle");
        setBubble(null);
      }
    },
    [clearBubbleTimer]
  );

  const notifyError = useCallback(
    (message: string) => {
      thinkingDepth.current = 0;
      const reaction = reactionForError(message);
      say(reaction.bubble, reaction.mood, 5000);
    },
    [say]
  );

  const greetIfNeeded = useCallback(() => {
    if (greeted.current) return;
    greeted.current = true;
    say(greetingBubble(), "wave", 3600);
  }, [say]);

  useEffect(() => () => clearBubbleTimer(), [clearBubbleTimer]);

  const value = useMemo<PetContextValue>(
    () => ({
      mood,
      bubble,
      bubbleDismissedAt,
      panelOpen,
      visible,
      setVisible,
      openPanel,
      closePanel,
      clearBubble,
      say,
      emitCompanionEvent: companionEventBus.emit,
      subscribeCompanionEvents: companionEventBus.subscribe,
      notifyCheckIn,
      notifyThinking,
      notifyError,
      greetIfNeeded
    }),
    [
      mood,
      bubble,
      bubbleDismissedAt,
      panelOpen,
      visible,
      openPanel,
      closePanel,
      clearBubble,
      say,
      notifyCheckIn,
      notifyThinking,
      notifyError,
      greetIfNeeded,
      companionEventBus
    ]
  );

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePet(): PetContextValue {
  const ctx = useContext(PetContext);
  if (!ctx) {
    throw new Error("usePet 必须在 PetProvider 内使用");
  }
  return ctx;
}

/** 可选订阅：未挂 Provider 时返回 null，避免业务页强依赖。 */
export function usePetOptional(): PetContextValue | null {
  return useContext(PetContext);
}
