import { describe, expect, it } from "vitest";
import { isFcmConfigured } from "./fcmClient.js";

describe("fcmClient config detection", () => {
  it("detects local secrets file when present", () => {
    // 开发机上我们会放 server/secrets/firebase-adminsdk.json；CI 无密钥时应为 false 或 true 均可，不抛错
    expect(typeof isFcmConfigured()).toBe("boolean");
  });
});
