import { describe, expect, it } from "vitest";
import { androidSpeechStartOptions } from "./speechRecognitionAndroid";

describe("speechRecognitionSupport re-exports", () => {
  it("androidSpeechStartOptions 带服务包时返回配置", () => {
    expect(androidSpeechStartOptions("com.iflytek.inputmethod")).toEqual({
      androidRecognitionServicePackage: "com.iflytek.inputmethod"
    });
  });

  it("androidSpeechStartOptions 无服务包时返回空对象", () => {
    expect(androidSpeechStartOptions()).toEqual({});
  });
});
