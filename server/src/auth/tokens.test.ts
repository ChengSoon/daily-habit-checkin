import { afterEach, describe, expect, it } from "vitest";
import { signToken, verifyToken } from "./tokens.js";

const previousSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

describe("session-bound access tokens", () => {
  it("round-trips the account session version", () => {
    process.env.JWT_SECRET = "test-secret-that-is-long-enough";
    const token = signToken({ accountId: "account-1", spaceId: "space-1", sessionVersion: 3 });

    expect(verifyToken(token)).toMatchObject({ accountId: "account-1", sessionVersion: 3 });
  });
});
