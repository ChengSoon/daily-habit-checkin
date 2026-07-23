import { describe, expect, it } from "vitest";
import { readProtocolToken } from "./syncWebSocketServer.js";

describe("readProtocolToken", () => {
  it("reads the JWT from the WebSocket protocol list", () => {
    expect(readProtocolToken("habit-sync, auth.header.payload.signature")).toBe("header.payload.signature");
  });

  it("supports Node's array header representation", () => {
    expect(readProtocolToken(["habit-sync", "auth.token-value"])).toBe("token-value");
  });

  it("rejects a missing or empty auth protocol", () => {
    expect(readProtocolToken("habit-sync")).toBeNull();
    expect(readProtocolToken("habit-sync, auth.")).toBeNull();
    expect(readProtocolToken(undefined)).toBeNull();
  });
});
