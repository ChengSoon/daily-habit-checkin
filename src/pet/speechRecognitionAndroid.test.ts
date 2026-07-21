import { describe, expect, it } from "vitest";
import {
  androidSpeechUnavailableMessage,
  pickAndroidSpeechService
} from "./speechRecognitionAndroid";

describe("pickAndroidSpeechService", () => {
  it("优先选择国产系统语音服务", () => {
    expect(
      pickAndroidSpeechService([
        "com.google.android.googlequicksearchbox",
        "com.iflytek.inputmethod",
        "com.miui.voiceassist"
      ])
    ).toBe("com.iflytek.inputmethod");
  });

  it("没有优先项时回退到设备已安装服务", () => {
    expect(pickAndroidSpeechService(["com.vendor.speech"])).toBe("com.vendor.speech");
  });

  it("空列表返回 undefined", () => {
    expect(pickAndroidSpeechService([])).toBeUndefined();
  });
});

describe("androidSpeechUnavailableMessage", () => {
  it("无服务时提示可走应用内识别", () => {
    expect(androidSpeechUnavailableMessage([])).toContain("应用内识别");
  });

  it("有服务但仍不可用时给出排查指引", () => {
    expect(androidSpeechUnavailableMessage(["com.iflytek.inputmethod"])).toContain("网络");
  });
});
