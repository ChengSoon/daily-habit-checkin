import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../db/pool.js", () => ({ getPool: () => dbMock }));

import { createSettingsRouter } from "./settingsRoutes.js";

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
  vi.clearAllMocks();
});

async function adminRequest(method: "GET" | "PUT") {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.spaceId = "space-1";
    request.role = "member";
    next();
  });
  app.use(createSettingsRouter());
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server!.address();
  if (!address || typeof address === "string") throw new Error("测试服务监听失败");
  return fetch(`http://127.0.0.1:${address.port}/admin`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "PUT" ? JSON.stringify({ entries: { pin: "1234" } }) : undefined
  });
}

describe("admin settings authorization", () => {
  it.each(["GET", "PUT"] as const)("rejects member %s requests before querying the database", async (method) => {
    const response = await adminRequest(method);

    expect(response.status).toBe(403);
    expect(dbMock.query).not.toHaveBeenCalled();
  });
});
