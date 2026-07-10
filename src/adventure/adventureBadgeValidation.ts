const MAX_BADGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateBadgeImageMime(mime: string): void {
  if (!ALLOWED_MIME.has(mime)) throw new Error("仅支持 JPEG、PNG 或 WebP");
}

export function validateBadgeImageMetadata(mime: string, sizeBytes: number): void {
  validateBadgeImageMime(mime);
  if (sizeBytes > MAX_BADGE_BYTES) throw new Error("勋章图片不能超过 5 MB");
}
