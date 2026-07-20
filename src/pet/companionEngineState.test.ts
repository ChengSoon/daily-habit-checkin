import { describe, expect, it } from "vitest";
import {
  canStartChat,
  companionEngineReducer,
  initialCompanionEngineState,
  shouldReloadCompanion
} from "./companionEngineState";
import type { CompanionMessage } from "./companionTypes";

function message(id: string, role: "user" | "assistant" = "user"): CompanionMessage {
  return {
    id,
    role,
    content: `${role} ${id}`,
    senderAccountId: role === "user" ? "account-1" : null,
    senderName: role === "user" ? "小程" : null,
    riskLevel: "normal",
    memoryProposal: null,
    memoryConfirmed: false,
    createdAt: "2026-07-19T12:00:00.000Z"
  };
}

describe("companionEngineReducer", () => {
  it("loads shared history only for the active space", () => {
    const selected = companionEngineReducer(initialCompanionEngineState, {
      type: "space_changed",
      spaceId: "space-1"
    });
    const stale = companionEngineReducer(selected, {
      type: "load_succeeded",
      spaceId: "space-old",
      messages: [message("old")]
    });
    const loaded = companionEngineReducer(stale, {
      type: "load_succeeded",
      spaceId: "space-1",
      messages: [message("shared")]
    });

    expect(stale.messages).toEqual([]);
    expect(loaded.messages.map((item) => item.id)).toEqual(["shared"]);
  });

  it("allows one chat request and deduplicates the optimistic user message", () => {
    const selected = { ...initialCompanionEngineState, spaceId: "space-1" };
    const started = companionEngineReducer(selected, {
      type: "chat_started",
      requestId: "request-1",
      message: message("user-1")
    });
    const repeated = companionEngineReducer(started, {
      type: "chat_started",
      requestId: "request-2",
      message: message("user-1")
    });

    expect(canStartChat(selected)).toBe(true);
    expect(canStartChat(started)).toBe(false);
    expect(repeated.messages.filter((item) => item.id === "user-1")).toHaveLength(1);
    expect(repeated.requestId).toBe("request-1");
  });

  it("ignores stale deltas and stale-space loads after cancellation", () => {
    const started = companionEngineReducer(
      { ...initialCompanionEngineState, spaceId: "space-1" },
      { type: "chat_started", requestId: "request-1", message: message("user-1") }
    );
    const staleDelta = companionEngineReducer(started, {
      type: "chat_delta",
      requestId: "request-old",
      delta: "不应出现"
    });
    const changed = companionEngineReducer(staleDelta, {
      type: "space_changed",
      spaceId: "space-2"
    });

    expect(staleDelta.streamText).toBe("");
    expect(changed).toMatchObject({
      spaceId: "space-2",
      messages: [],
      busy: false,
      requestId: null,
      streamText: ""
    });
  });

  it("clears the active conversation without losing the selected space", () => {
    const state = {
      ...initialCompanionEngineState,
      spaceId: "space-1",
      messages: [message("user-1"), message("assistant-1", "assistant")],
      busy: true,
      requestId: "request-1",
      streamText: "正在回复"
    };
    const cleared = companionEngineReducer(state, {
      type: "conversation_cleared",
      spaceId: "space-1"
    });

    expect(cleared).toMatchObject({
      spaceId: "space-1",
      messages: [],
      busy: false,
      requestId: null,
      streamText: "",
      errorMessage: null
    });
  });

  it("finishes with one assistant message and hides raw failures", () => {
    const started = companionEngineReducer(
      { ...initialCompanionEngineState, spaceId: "space-1" },
      { type: "chat_started", requestId: "request-1", message: message("user-1") }
    );
    const finished = companionEngineReducer(started, {
      type: "chat_succeeded",
      requestId: "request-1",
      message: message("assistant-1", "assistant")
    });
    const failed = companionEngineReducer(started, {
      type: "chat_failed",
      requestId: "request-1",
      message: message("fallback-1", "assistant")
    });

    expect(finished.messages.map((item) => item.id)).toEqual(["user-1", "assistant-1"]);
    expect(finished.busy).toBe(false);
    expect(failed.messages[1].content).not.toMatch(/HTTP|API|error/i);
  });

  it("keeps user message above assistant when createdAt is identical", () => {
    const sameTime = "2026-07-19T12:00:00.000Z";
    const loaded = companionEngineReducer(
      { ...initialCompanionEngineState, spaceId: "space-1" },
      {
        type: "load_succeeded",
        spaceId: "space-1",
        messages: [
          { ...message("assistant-1", "assistant"), createdAt: sameTime },
          { ...message("user-1"), createdAt: sameTime }
        ]
      }
    );

    expect(loaded.messages.map((item) => item.id)).toEqual(["user-1", "assistant-1"]);
  });
});

describe("shouldReloadCompanion", () => {
  it("reloads only the companion resource", () => {
    expect(shouldReloadCompanion({ resource: "companion" })).toBe(true);
    expect(shouldReloadCompanion({ resource: "check_ins" })).toBe(false);
  });
});