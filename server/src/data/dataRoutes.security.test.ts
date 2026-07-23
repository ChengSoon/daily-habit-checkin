import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock("../db/pool.js", () => ({
  getPool: () => ({ query: dbMock.query }),
  withTransaction: dbMock.withTransaction
}));

import { createDataRouter, createWalletRouter } from "./dataRoutes.js";

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
  vi.clearAllMocks();
});

async function request(router: express.Router, path: string, method: "POST" | "PUT" | "DELETE") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.spaceId = "space-1";
    req.accountId = "account-1";
    req.role = "member";
    next();
  });
  app.use(router);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server!.address();
  if (!address || typeof address === "string") throw new Error("测试服务监听失败");
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transactions: [], createdBy: "account-2" })
  });
}

describe("authoritative data write boundaries", () => {
  it("does not expose the raw wallet transaction endpoint", async () => {
    const response = await request(createWalletRouter(), "/transactions", "POST");

    expect(response.status).toBe(405);
    expect(dbMock.withTransaction).not.toHaveBeenCalled();
  });

  it.each(["check_ins", "reward_redemptions", "xp_transactions"])(
    "rejects generic writes to %s",
    async (resource) => {
      const put = await request(createDataRouter(), `/${resource}/record-1`, "PUT");
      expect(put.status).toBe(405);

      server?.close();
      server = null;
      const remove = await request(createDataRouter(), `/${resource}/record-1`, "DELETE");
      expect(remove.status).toBe(405);
      expect(dbMock.query).not.toHaveBeenCalled();
    }
  );
});
