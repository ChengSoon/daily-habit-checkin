import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppUpdateRouter } from "./appUpdateRoutes.js";

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
});

async function requestApp(app: express.Express, path: string): Promise<Response> {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server!.address();
  if (!address || typeof address === "string") {
    throw new Error("测试服务监听失败");
  }
  return fetch(`http://127.0.0.1:${address.port}${path}`);
}

describe("createAppUpdateRouter", () => {
  it("returns 204 when manifest URL is not configured", async () => {
    const app = express();
    app.use("/api/app-update", createAppUpdateRouter({ getManifestUrl: () => undefined }));

    const response = await requestApp(app, "/api/app-update/latest?platform=android");

    expect(response.status).toBe(204);
  });

  it("rejects unsupported platforms", async () => {
    const app = express();
    app.use("/api/app-update", createAppUpdateRouter({ getManifestUrl: () => "https://cdn.example/latest.json" }));

    const response = await requestApp(app, "/api/app-update/latest?platform=ios");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "暂不支持该平台的应用更新" });
  });

  it("returns the latest Android manifest", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          platform: "android",
          version: "1.0.1",
          downloadUrl: "https://cdn.example/app.apk",
          sha256: "d".repeat(64),
          sizeBytes: 3
        })
    });
    const app = express();
    app.use(
      "/api/app-update",
      createAppUpdateRouter({ getManifestUrl: () => "https://cdn.example/latest.json", fetcher })
    );

    const response = await requestApp(app, "/api/app-update/latest?platform=android");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ platform: "android", version: "1.0.1" });
  });
});
