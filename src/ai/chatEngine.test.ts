import { describe, expect, it } from "vitest";
import { createInitialChatState, draftToRequest, reduceChat } from "./chatEngine";

describe("reduceChat", () => {
  it("boots with home assistant and quick replies", () => {
    const { state } = reduceChat(createInitialChatState(), { type: "boot" });
    expect(state.flow.kind).toBe("idle");
    expect(state.messages[0]?.role).toBe("assistant");
    expect(state.messages[0]?.quickReplies?.some((r) => r.value === "plan")).toBe(true);
  });

  it("walks through plan flow and emits generate_plan", () => {
    let state = createInitialChatState();

    ({ state } = reduceChat(state, { type: "reply", replyId: "plan", value: "plan", label: "生成习惯计划" }));
    expect(state.flow.kind).toBe("plan");
    if (state.flow.kind !== "plan") throw new Error("expected plan flow");
    expect(state.flow.step).toBe("goal");

    let effects;
    ({ state, effects } = reduceChat(state, { type: "text", text: "每天拉伸" }));
    expect(state.flow.kind).toBe("plan");
    if (state.flow.kind === "plan") expect(state.flow.draft.goalText).toBe("每天拉伸");

    ({ state } = reduceChat(state, { type: "reply", replyId: "lv", value: "beginner", label: "新手" }));
    ({ state } = reduceChat(state, { type: "reply", replyId: "d", value: "7", label: "7 天" }));
    ({ state } = reduceChat(state, { type: "reply", replyId: "m", value: "10", label: "10 分钟" }));
    ({ state } = reduceChat(state, { type: "reply", replyId: "f", value: "daily", label: "每天" }));
    ({ state } = reduceChat(state, { type: "reply", replyId: "r", value: "evening", label: "晚上" }));
    ({ state, effects } = reduceChat(state, { type: "reply", replyId: "t", value: "check", label: "一键完成" }));

    expect(effects).toHaveLength(1);
    expect(effects[0]?.type).toBe("generate_plan");
    if (effects[0]?.type === "generate_plan") {
      const req = draftToRequest(effects[0].draft);
      expect(req.goalText).toBe("每天拉伸");
      expect(req.durationDays).toBe(7);
      expect(req.dailyAvailableMinutes).toBe(10);
      expect(req.expectedFrequency).toEqual({ type: "daily" });
    }
  });

  it("loads habits when starting adjust flow", () => {
    let state = createInitialChatState();
    const result = reduceChat(state, {
      type: "reply",
      replyId: "adjust",
      value: "adjust",
      label: "调整现有习惯"
    });
    expect(result.effects).toEqual([{ type: "load_habits" }]);
  });

  it("builds suggestion card from stats", () => {
    let state = createInitialChatState();
    ({ state } = reduceChat(state, { type: "reply", replyId: "adjust", value: "adjust" }));
    ({ state } = reduceChat(state, {
      type: "habits_loaded",
      habits: [{ id: "h1", name: "早起" }]
    }));
    const { state: next } = reduceChat(state, {
      type: "stats_loaded",
      stats: {
        habitId: "h1",
        habitName: "早起",
        completionRate7Days: 20,
        currentStreak: 0,
        planEnded: false
      }
    });
    const last = next.messages[next.messages.length - 1];
    expect(last?.suggestionCard?.title).toBe("把目标调轻一点");
    expect(last?.suggestionCard?.actionLabel).toBe("调整计划");
  });
});

  it("sends free-form idle text to real model chat", () => {
    const state = createInitialChatState();
    const result = reduceChat(state, { type: "text", text: "怎样坚持早起？" });
    expect(result.effects).toEqual([{ type: "llm_chat" }]);
    expect(result.state.messages.at(-1)?.role).toBe("user");
  });
