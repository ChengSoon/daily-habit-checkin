import { describe, expect, it } from "vitest";
import { isObjectKeyForScope } from "./r2Client.js";

describe("R2 object ownership", () => {
  it("accepts only keys issued for the expected kind and scope", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(isObjectKeyForScope("avatar", "account-1", `avatars/account-1/${id}.jpg`)).toBe(true);
    expect(isObjectKeyForScope("reward", "space-1", `rewards/space-1/${id}.png`)).toBe(true);
    expect(isObjectKeyForScope("adventure", "space-1", `adventure/space-1/${id}.webp`)).toBe(true);
    expect(isObjectKeyForScope("adventure", "space-1", "adventure_badges/space-1/legacy-badge.png")).toBe(true);
  });

  it("rejects cross-scope and path traversal keys", () => {
    expect(isObjectKeyForScope("avatar", "account-1", "avatars/account-2/file.jpg")).toBe(false);
    expect(isObjectKeyForScope("reward", "space-1", "rewards/space-1/../space-2/file.png")).toBe(false);
    expect(isObjectKeyForScope("reward", "space-1", "adventure/space-1/file.png")).toBe(false);
    expect(isObjectKeyForScope("adventure", "space-1", "adventure_badges/space-2/legacy.png")).toBe(false);
    expect(isObjectKeyForScope("adventure", "space-1", "adventure_badges/space-1/nested/file.png")).toBe(false);
  });
});
