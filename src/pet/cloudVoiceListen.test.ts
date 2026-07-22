import { describe, expect, it } from "vitest";
import {
  CLOUD_CONVERSATION_RECORD_OPTIONS,
  CLOUD_WAKE_RECORD_OPTIONS
} from "./cloudVoiceRecordOptions";

describe("cloud voice record options", () => {
  it("对话静音短于旧默认 1.1s，且不低于唤醒参数", () => {
    expect(CLOUD_CONVERSATION_RECORD_OPTIONS.silenceDurationMs).toBeLessThan(1100);
    expect(CLOUD_CONVERSATION_RECORD_OPTIONS.silenceDurationMs).toBeGreaterThanOrEqual(
      CLOUD_WAKE_RECORD_OPTIONS.silenceDurationMs ?? 0
    );
    expect(CLOUD_CONVERSATION_RECORD_OPTIONS.minSpeechMs).toBeLessThan(450);
  });
});
