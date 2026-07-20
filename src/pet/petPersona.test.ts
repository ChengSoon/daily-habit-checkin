import { describe, expect, it } from "vitest";
import { buildPetMessages } from "./petPersona";

describe("legacy pet message adapter", () => {
  it("does not send a client-owned system prompt", () => {
    const messages = buildPetMessages(
      [{ id: "old", role: "assistant", text: "我在", createdAt: 0 }],
      "陪我聊聊"
    );

    expect(messages).toEqual([
      { role: "assistant", content: "我在" },
      { role: "user", content: "陪我聊聊" }
    ]);
  });
});
