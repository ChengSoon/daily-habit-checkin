import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const buildConfig = require("./app.config.js") as (input: { config: Record<string, unknown> }) => any;
const previousAppEnv = process.env.APP_ENV;
const previousApiBaseUrl = process.env.API_BASE_URL;
const previousR2PublicBase = process.env.R2_PUBLIC_BASE;

afterEach(() => {
  if (previousAppEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = previousAppEnv;
  if (previousApiBaseUrl === undefined) delete process.env.API_BASE_URL;
  else process.env.API_BASE_URL = previousApiBaseUrl;
  if (previousR2PublicBase === undefined) delete process.env.R2_PUBLIC_BASE;
  else process.env.R2_PUBLIC_BASE = previousR2PublicBase;
});

describe("production app config", () => {
  it("requires HTTPS and disables cleartext transport", () => {
    process.env.APP_ENV = "production";

    const config = buildConfig({ config: {} });
    const buildProperties = config.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-build-properties"
    );

    expect(config.extra.apiBaseUrl).toMatch(/^https:\/\//);
    expect(config.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads).toBe(false);
    expect(buildProperties[1].android.usesCleartextTraffic).toBe(false);
  });

  it("rejects an HTTP API override", () => {
    process.env.APP_ENV = "production";
    process.env.API_BASE_URL = "http://api.example.com";

    expect(() => buildConfig({ config: {} })).toThrow("API_BASE_URL must use HTTPS");
  });
});
