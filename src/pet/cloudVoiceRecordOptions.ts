import type { CloudListenOptions } from "./cloudVoiceListenTypes";

/** 唤醒录音更短静音、更灵敏，减少“说完还要等很久才再听”。 */
export const CLOUD_WAKE_RECORD_OPTIONS: CloudListenOptions = {
  maxDurationMs: 8_000,
  silenceDurationMs: 650,
  minSpeechMs: 280,
  speechThreshold: 0.014
};

/** 对话录音：比默认更短静音，减少“说完还要等很久”。仍略长于唤醒，避免截断长句。 */
export const CLOUD_CONVERSATION_RECORD_OPTIONS: CloudListenOptions = {
  maxDurationMs: 12_000,
  silenceDurationMs: 750,
  minSpeechMs: 350,
  speechThreshold: 0.018
};
