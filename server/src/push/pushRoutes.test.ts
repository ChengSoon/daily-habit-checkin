import { describe, expect, it } from "vitest";
import { isGetuiConfigured } from "./getuiClient.js";

describe("getuiClient config detection", () => {
  it("returns a boolean when credentials are absent or configured", () => {
    expect(typeof isGetuiConfigured()).toBe("boolean");
  });
});
