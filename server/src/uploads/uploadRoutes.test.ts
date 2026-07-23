import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const r2Mock = vi.hoisted(() => ({
  createPresignedUpload: vi.fn(async (options: { kind: string; scope: string }) => ({
    key: `${options.kind}/${options.scope}/badge.png`,
    uploadUrl: "https://upload.example.test"
  })),
  isAllowedImageMime: vi.fn((mime: string) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime))
}));

vi.mock("../r2/r2Client.js", () => r2Mock);
vi.mock("../auth/authMiddleware.js", () => ({
  requireAuth: (request: express.Request, _response: express.Response, next: express.NextFunction) => {
    request.accountId = "account-1";
    request.spaceId = "space-1";
    request.role = request.header("x-role") === "member" ? "member" : "owner";
    next();
  }
}));

import { createUploadRouter } from "./uploadRoutes.js";

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
  vi.clearAllMocks();
});

async function presign(role: "owner" | "member", body: unknown): Promise<Response> {
  const app = express();
  app.use(express.json());
  app.use("/api/uploads", createUploadRouter());
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server!.address();
  if (!address || typeof address === "string") throw new Error("测试服务监听失败");
  return fetch(`http://127.0.0.1:${address.port}/api/uploads/presign`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-role": role },
    body: JSON.stringify(body)
  });
}

describe("upload routes", () => {
  it("allows an owner to request a custom badge upload", async () => {
    const response = await presign("owner", {
      kind: "adventure",
      contentType: "image/png",
      sizeBytes: 400_000
    });

    expect(response.status).toBe(200);
    expect(r2Mock.createPresignedUpload).toHaveBeenCalledWith({
      kind: "adventure", scope: "space-1", contentType: "image/png", sizeBytes: 400_000
    });
  });

  it("rejects custom badge uploads from a member", async () => {
    const response = await presign("member", {
      kind: "adventure",
      contentType: "image/png",
      sizeBytes: 400_000
    });

    expect(response.status).toBe(403);
    expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
  });

  it("rejects reward image uploads from a member", async () => {
    const response = await presign("member", {
      kind: "reward",
      contentType: "image/png",
      sizeBytes: 400_000
    });

    expect(response.status).toBe(403);
    expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
  });

  it("rejects unsupported or oversized custom badge images", async () => {
    const wrongMime = await presign("owner", {
      kind: "adventure",
      contentType: "image/svg+xml",
      sizeBytes: 400_000
    });
    expect(wrongMime.status).toBe(400);

    server?.close();
    server = null;
    const oversized = await presign("owner", {
      kind: "adventure",
      contentType: "image/png",
      sizeBytes: 8 * 1024 * 1024 + 1
    });
    expect(oversized.status).toBe(400);
  });

  it("allows gif for animated island/background assets", async () => {
    const response = await presign("owner", {
      kind: "adventure",
      contentType: "image/gif",
      sizeBytes: 1_200_000
    });
    expect(response.status).toBe(200);
    expect(r2Mock.createPresignedUpload).toHaveBeenCalledWith({
      kind: "adventure", scope: "space-1", contentType: "image/gif", sizeBytes: 1_200_000
    });
  });

  it("requires a declared upload size for every image kind", async () => {
    const response = await presign("owner", {
      kind: "avatar",
      contentType: "image/jpeg"
    });

    expect(response.status).toBe(400);
    expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
  });

  it("rejects oversized avatar and reward images", async () => {
    const oversizedAvatar = await presign("owner", {
      kind: "avatar",
      contentType: "image/jpeg",
      sizeBytes: 1024 * 1024 + 1
    });
    expect(oversizedAvatar.status).toBe(400);

    server?.close();
    server = null;
    const oversizedReward = await presign("owner", {
      kind: "reward",
      contentType: "image/jpeg",
      sizeBytes: 5 * 1024 * 1024 + 1
    });
    expect(oversizedReward.status).toBe(400);
  });

  it("does not expose R2 infrastructure errors to the client", async () => {
    r2Mock.createPresignedUpload.mockRejectedValueOnce(new Error("secret endpoint failed"));

    const response = await presign("owner", {
      kind: "avatar",
      contentType: "image/png",
      sizeBytes: 1000
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "获取上传地址失败" });
  });
});
