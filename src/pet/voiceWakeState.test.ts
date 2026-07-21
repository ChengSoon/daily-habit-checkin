import { describe, expect, it } from "vitest";
import {
  commandAfterWakePhrase,
  initialVoiceWakeState,
  isRecoverableVoiceWakeError,
  voiceWakeErrorMessage,
  voiceWakeReducer
} from "./voiceWakeState";

describe("voice wake state", () => {
  it("只在识别到卡卡后返回后续指令", () => {
    expect(commandAfterWakePhrase("卡卡，帮我安排今天的打卡")).toBe("帮我安排今天的打卡");
    expect(commandAfterWakePhrase("请叫卡卡")).toBe("");
    expect(commandAfterWakePhrase("提醒我喝水")).toBeNull();
  });

  it("支持常见识别变体并清理标点", () => {
    expect(commandAfterWakePhrase("咔咔：打开对话")).toBe("打开对话");
    expect(commandAfterWakePhrase("K A K A remind me tomorrow")).toBe("remind me tomorrow");
  });

  it("限制监听音量并在停止时清空状态", () => {
    const listening = voiceWakeReducer(
      voiceWakeReducer(initialVoiceWakeState, { type: "started" }),
      { type: "listening" }
    );
    expect(voiceWakeReducer(listening, { type: "volume_changed", volume: 20 }).volume).toBe(10);
    expect(voiceWakeReducer(listening, { type: "stopped" })).toEqual(initialVoiceWakeState);
  });

  it("区分权限错误和可自动恢复的识别错误", () => {
    expect(voiceWakeErrorMessage("not-allowed")).toContain("权限");
    expect(isRecoverableVoiceWakeError("speech-timeout")).toBe(true);
    expect(isRecoverableVoiceWakeError("not-allowed")).toBe(false);
  });
});
