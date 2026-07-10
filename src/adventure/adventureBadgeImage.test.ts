import { describe, expect, it } from "vitest";
import { validateBadgeImageMetadata, validateBadgeImageMime } from "./adventureBadgeValidation";

describe("adventureBadgeImage", () => {
  it("accepts jpeg, png and webp badge images up to 5 MB", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp"] as const) {
      expect(() => validateBadgeImageMetadata(mime, 5 * 1024 * 1024)).not.toThrow();
    }
  });

  it("rejects unsupported or oversized badge images", () => {
    expect(() => validateBadgeImageMetadata("image/svg+xml", 1000)).toThrow("仅支持 JPEG、PNG 或 WebP");
    expect(() => validateBadgeImageMetadata("image/png", 5 * 1024 * 1024 + 1)).toThrow("勋章图片不能超过 5 MB");
  });

  it("checks the source format before compression without applying the upload size limit", () => {
    expect(() => validateBadgeImageMime("image/png")).not.toThrow();
    expect(() => validateBadgeImageMime("image/svg+xml")).toThrow("仅支持 JPEG、PNG 或 WebP");
  });
});
