import { z } from "zod";

const AppUpdateManifestSchema = z.object({
  platform: z.literal("android"),
  version: z.string().trim().min(1),
  buildNumber: z.number().int().nonnegative().optional(),
  mandatory: z.boolean().optional().default(false),
  releaseDate: z.string().datetime().optional(),
  notes: z.string().optional().default(""),
  downloadUrl: z.string().url().refine((value) => value.startsWith("https://"), {
    message: "更新下载地址必须使用 HTTPS"
  }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, "sha256 必须是 64 位十六进制摘要"),
  sizeBytes: z.number().int().nonnegative()
});

export type AppUpdatePlatform = "android";
export type AppUpdateManifest = z.infer<typeof AppUpdateManifestSchema>;
export type ManifestFetch = (
  input: string,
  init?: { headers?: Record<string, string> }
) => Promise<{
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}>;

export function normalizeAppUpdateManifest(data: unknown): AppUpdateManifest {
  return AppUpdateManifestSchema.parse(data);
}

export async function fetchLatestAppUpdateManifest(
  manifestUrl: string | undefined,
  platform: AppUpdatePlatform,
  fetcher: ManifestFetch = fetch
): Promise<AppUpdateManifest | null> {
  if (!manifestUrl) {
    return null;
  }

  const response = await fetcher(manifestUrl, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`更新信息拉取失败（${response.status ?? "unknown"}）`);
  }

  const manifest = normalizeAppUpdateManifest(await response.json());
  if (manifest.platform !== platform) {
    throw new Error("更新信息平台不匹配");
  }

  return manifest;
}
