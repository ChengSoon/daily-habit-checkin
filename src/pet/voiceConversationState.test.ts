import { describe, expect, it } from "vitest";
import {
  initialVoiceConversationState,
  isRecoverableVoiceError,
  textForSpeech,
  voiceConversationReducer,
  voiceErrorMessage
} from "./voiceConversationState";

describe("voice conversation state", () => {
  it("推进听取、思考、说话和下一轮聆听", () => {
    let state = voiceConversationReducer(initialVoiceConversationState, { type: "started" });
    state = voiceConversationReducer(state, { type: "listening" });
    state = voiceConversationReducer(state, {
      type: "transcript_changed",
      transcript: "今天有点累"
    });
    state = voiceConversationReducer(state, { type: "thinking", transcript: state.transcript });
    expect(state).toMatchObject({ active: true, phase: "thinking", transcript: "今天有点累" });

    state = voiceConversationReducer(state, { type: "speaking" });
    state = voiceConversationReducer(state, { type: "listening" });
    expect(state).toMatchObject({ active: true, phase: "listening", transcript: "" });
  });

  it("结束时彻底清空会话态", () => {
    const active = voiceConversationReducer(initialVoiceConversationState, { type: "started" });
    expect(voiceConversationReducer(active, { type: "stopped" })).toEqual(
      initialVoiceConversationState
    );
  });

  it("只在聆听阶段记录并限制音量", () => {
    const listening = voiceConversationReducer(
      voiceConversationReducer(initialVoiceConversationState, { type: "started" }),
      { type: "listening" }
    );
    expect(
      voiceConversationReducer(listening, { type: "volume_changed", volume: 20 }).volume
    ).toBe(10);
    expect(
      voiceConversationReducer(
        voiceConversationReducer(listening, { type: "speaking" }),
        { type: "volume_changed", volume: 6 }
      ).volume
    ).toBe(-2);
  });
});

describe("voice conversation helpers", () => {
  it("把 Markdown 回复整理为自然朗读文本", () => {
    expect(textForSpeech("**先休息**，再看[计划](https://example.com)。")).toBe(
      "先休息 ，再看计划。"
    );
  });

  it("区分可自动重试和需要用户处理的错误", () => {
    expect(voiceErrorMessage("not-allowed")).toContain("权限");
    expect(voiceErrorMessage("service-not-allowed")).toContain("识别服务");
    expect(isRecoverableVoiceError("no-speech")).toBe(true);
    expect(isRecoverableVoiceError("not-allowed")).toBe(false);
  });
});
