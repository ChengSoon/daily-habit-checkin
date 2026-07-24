import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const buildConfig = require("./app.config.js") as (input: { config: Record<string, unknown> }) => any;
const previousAppEnv = process.env.APP_ENV;
const previousApiBaseUrl = process.env.API_BASE_URL;
const previousAllowCleartextApi = process.env.ALLOW_CLEARTEXT_API;
const previousR2PublicBase = process.env.R2_PUBLIC_BASE;

afterEach(() => {
  if (previousAppEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = previousAppEnv;
  if (previousApiBaseUrl === undefined) delete process.env.API_BASE_URL;
  else process.env.API_BASE_URL = previousApiBaseUrl;
  if (previousAllowCleartextApi === undefined) delete process.env.ALLOW_CLEARTEXT_API;
  else process.env.ALLOW_CLEARTEXT_API = previousAllowCleartextApi;
  if (previousR2PublicBase === undefined) delete process.env.R2_PUBLIC_BASE;
  else process.env.R2_PUBLIC_BASE = previousR2PublicBase;
});

describe("production app config", () => {
  it("uses the explicitly allowed production HTTP API", () => {
    process.env.APP_ENV = "production";
    delete process.env.API_BASE_URL;
    delete process.env.ALLOW_CLEARTEXT_API;

    const config = buildConfig({ config: {} });
    const buildProperties = config.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-build-properties"
    );

    expect(config.extra.apiBaseUrl).toBe("http://111.228.40.252:4000/habit");
    expect(config.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads).toBe(true);
    expect(buildProperties[1].android.usesCleartextTraffic).toBe(true);
  });

  it("rejects an HTTP API without an explicit opt-in", () => {
    process.env.APP_ENV = "production";
    process.env.API_BASE_URL = "http://api.example.com";
    process.env.ALLOW_CLEARTEXT_API = "false";

    expect(() => buildConfig({ config: {} })).toThrow("API_BASE_URL must use HTTPS unless ALLOW_CLEARTEXT_API=true");
  });

  it("keeps cleartext disabled for a production HTTPS API", () => {
    process.env.APP_ENV = "production";
    process.env.API_BASE_URL = "https://api.example.com";
    process.env.ALLOW_CLEARTEXT_API = "false";

    const config = buildConfig({ config: {} });
    const buildProperties = config.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-build-properties"
    );

    expect(config.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads).toBe(false);
    expect(buildProperties[1].android.usesCleartextTraffic).toBe(false);
  });
});
