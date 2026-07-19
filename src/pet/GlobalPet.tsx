import { usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createId } from "../utils/id";
import { askPet } from "./petAi";
import { FloatingPet } from "./FloatingPet";
import { PetChatPanel } from "./PetChatPanel";
import { usePet } from "./PetContext";
import type { PetChatMessage } from "./types";

/** 全局浮层：右下角宠物 + 气泡 + 对话面板。 */
export function GlobalPet() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pet = usePet();
  const greetIfNeeded = pet.greetIfNeeded;
  const [messages, setMessages] = useState<PetChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  const listRef = useRef<FlatList<PetChatMessage>>(null);

  useEffect(() => {
    greetIfNeeded();
  }, [greetIfNeeded]);

  useEffect(() => {
    if (!pet.panelOpen) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length, streamText, pet.panelOpen]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const userMsg: PetChatMessage = {
      id: createId("pet-u"),
      role: "user",
      text,
      createdAt: Date.now()
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setBusy(true);
    setStreamText("");
    pet.notifyThinking(true);
    try {
      const reply = await askPet(history, text, (chunk) => {
        setStreamText((prev) => `${prev}${chunk}`);
      });
      const clean = reply.trim() || "我在这儿陪你～";
      setMessages((prev) => [
        ...prev,
        { id: createId("pet-a"), role: "assistant", text: clean, createdAt: Date.now() }
      ]);
      pet.notifyThinking(false);
      pet.say(clean.slice(0, 40) + (clean.length > 40 ? "…" : ""), "happy", 3600);
    } catch (error) {
      const message = error instanceof Error ? error.message : "聊不拢，稍后再试";
      pet.notifyThinking(false);
      pet.notifyError(message);
      setMessages((prev) => [
        ...prev,
        { id: createId("pet-e"), role: "assistant", text: `呜…${message}`, createdAt: Date.now() }
      ]);
    } finally {
      setStreamText("");
      setBusy(false);
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
          onPress={pet.openPanel}
        />
      ) : null}

      <PetChatPanel
        visible={pet.panelOpen}
        onClose={pet.closePanel}
        messages={messages}
        listRef={listRef}
        input={input}
        onChangeInput={setInput}
        onSend={() => void send()}
        busy={busy}
        streamText={streamText}
      />
    </>
  );
}
