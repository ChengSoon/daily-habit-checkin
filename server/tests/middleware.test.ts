import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createRateLimiter, requireApiKey } from "../src/middleware.js";

function mockResponse(): Response & { statusCode: number; body: unknown; headers: Record<string, string> } {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    }
  };
  return response as unknown as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  };
}

function mockRequest(overrides?: Partial<Request>): Request {
  return {
    ip: "1.2.3.4",
    header: () => undefined,
    socket: { remoteAddress: "1.2.3.4" },
    ...overrides
  } as unknown as Request;
}

describe("requireApiKey", () => {
  it("passes through when API_KEY is not configured", () => {
    delete process.env.API_KEY;
    const next = vi.fn() as unknown as NextFunction;
    const response = mockResponse();

    requireApiKey(mockRequest(), response, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a missing or wrong key when API_KEY is set", () => {
    process.env.API_KEY = "secret";
    const next = vi.fn() as unknown as NextFunction;
    const response = mockResponse();

    requireApiKey(mockRequest({ header: () => "wrong" } as unknown as Partial<Request>), response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(401);
    delete process.env.API_KEY;
  });

  it("accepts a matching key", () => {
    process.env.API_KEY = "secret";
    const next = vi.fn() as unknown as NextFunction;
    const response = mockResponse();

    requireApiKey(mockRequest({ header: () => "secret" } as unknown as Partial<Request>), response, next);

    expect(next).toHaveBeenCalledOnce();
    delete process.env.API_KEY;
  });
});

describe("createRateLimiter", () => {
  it("allows requests up to the limit then blocks with 429", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const next = vi.fn() as unknown as NextFunction;

    const first = mockResponse();
    limiter(mockRequest(), first, next);
    const second = mockResponse();
    limiter(mockRequest(), second, next);

    expect(next).toHaveBeenCalledTimes(2);

    const third = mockResponse();
    limiter(mockRequest(), third, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(third.statusCode).toBe(429);
    expect(third.headers["Retry-After"]).toBeDefined();
  });

  it("resets the window after it expires", () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    const next = vi.fn() as unknown as NextFunction;

    limiter(mockRequest(), mockResponse(), next);
    const blocked = mockResponse();
    limiter(mockRequest(), blocked, next);
    expect(blocked.statusCode).toBe(429);

    now += 1_001;
    const afterReset = mockResponse();
    limiter(mockRequest(), afterReset, next);
    expect(next).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("tracks limits per client IP", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const next = vi.fn() as unknown as NextFunction;

    limiter(mockRequest({ ip: "1.1.1.1" } as Partial<Request>), mockResponse(), next);
    const otherIp = mockResponse();
    limiter(mockRequest({ ip: "2.2.2.2" } as Partial<Request>), otherIp, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(otherIp.statusCode).toBe(0);
  });
});
