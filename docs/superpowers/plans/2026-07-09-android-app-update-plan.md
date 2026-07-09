# Android App Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add Android APK update discovery that mirrors GitHub Release builds to R2 and lets the app guide users to a non-GitHub download link.

**Architecture:** GitHub Actions continues producing APKs on `v*` tags, then uploads the APK plus `latest.json` to R2. The Express server exposes a small anonymous manifest proxy. The Expo app checks that proxy from the Profile screen and opens the R2 download URL when an update is available.

**Tech Stack:** Expo Router, React Native, TypeScript, Vitest, Express, Zod, GitHub Actions, Cloudflare R2 S3-compatible uploads.

---

## File Structure

- Create `server/src/appUpdate/appUpdateManifest.ts` for manifest schema, fetch, and response normalization.
- Create `server/src/appUpdate/appUpdateManifest.test.ts` for manifest parsing and error behavior.
- Create `server/src/appUpdate/appUpdateRoutes.ts` for `GET /api/app-update/latest`.
- Modify `server/src/index.ts` to mount the app-update router.
- Modify `server/.env.example`, `server/docker-compose.yml`, and `docs/deployment.md` to document update configuration.
- Create `src/updates/versionCompare.ts` and `src/updates/versionCompare.test.ts` for deterministic version comparison.
- Create `src/updates/appVersion.ts` for current app version/build metadata.
- Create `src/updates/updateClient.ts` and `src/updates/updateClient.test.ts` for update fetch and availability rules.
- Modify `app/(tabs)/profile.tsx` to render the update card and open download URLs.
- Modify `.github/workflows/eas-build.yml` to upload APK/manifest to R2 on release tags.

---

### Task 1: Version Comparison

**Files:**
- Create: `src/updates/versionCompare.test.ts`
- Create: `src/updates/versionCompare.ts`

- [x] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { compareVersions, isRemoteNewer } from "./versionCompare";

describe("compareVersions", () => {
  it("compares semantic version segments numerically", () => {
    expect(compareVersions("1.0.10", "1.0.2")).toBe(1);
    expect(compareVersions("1.2.0", "1.2")).toBe(0);
    expect(compareVersions("2.0.0", "10.0.0")).toBe(-1);
  });

  it("ignores v prefix and prerelease suffix for release checks", () => {
    expect(compareVersions("v1.0.1", "1.0.0")).toBe(1);
    expect(compareVersions("1.0.1-beta.1", "1.0.1")).toBe(0);
  });
});

describe("isRemoteNewer", () => {
  it("uses version first and build number only when versions match", () => {
    expect(isRemoteNewer({ version: "1.1.0", buildNumber: 1 }, { version: "1.0.9", buildNumber: 99 })).toBe(true);
    expect(isRemoteNewer({ version: "1.0.0", buildNumber: 12 }, { version: "1.0.0", buildNumber: 11 })).toBe(true);
    expect(isRemoteNewer({ version: "1.0.0", buildNumber: 11 }, { version: "1.0.0", buildNumber: 12 })).toBe(false);
  });
});
```

- [x] **Step 2: Verify RED**

Run: `npm test -- src/updates/versionCompare.test.ts`

Expected: fails because `src/updates/versionCompare.ts` does not exist.

- [x] **Step 3: Implement comparison**

```ts
export type ComparableVersion = {
  version: string;
  buildNumber?: number | null;
};

function normalizeVersion(version: string): number[] {
  const clean = version.trim().replace(/^v/i, "").split("-")[0] ?? "";
  return clean.split(".").map((segment) => {
    const parsed = Number.parseInt(segment, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

export function isRemoteNewer(remote: ComparableVersion, current: ComparableVersion): boolean {
  const versionResult = compareVersions(remote.version, current.version);
  if (versionResult !== 0) {
    return versionResult > 0;
  }
  return (remote.buildNumber ?? 0) > (current.buildNumber ?? 0);
}
```

- [x] **Step 4: Verify GREEN**

Run: `npm test -- src/updates/versionCompare.test.ts`

Expected: tests pass.

---

### Task 2: Server Manifest Validation

**Files:**
- Create: `server/src/appUpdate/appUpdateManifest.test.ts`
- Create: `server/src/appUpdate/appUpdateManifest.ts`

- [x] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchLatestAppUpdateManifest, normalizeAppUpdateManifest } from "./appUpdateManifest.js";

describe("normalizeAppUpdateManifest", () => {
  it("accepts a valid Android manifest", () => {
    expect(
      normalizeAppUpdateManifest({
        platform: "android",
        version: "1.0.1",
        buildNumber: 12,
        mandatory: false,
        releaseDate: "2026-07-09T00:00:00.000Z",
        notes: "更新说明",
        downloadUrl: "https://cdn.example/releases/android/v1.0.1/app.apk",
        sha256: "a".repeat(64),
        sizeBytes: 123456
      })
    ).toMatchObject({ platform: "android", version: "1.0.1", buildNumber: 12 });
  });

  it("rejects non-https download URLs", () => {
    expect(() =>
      normalizeAppUpdateManifest({
        platform: "android",
        version: "1.0.1",
        downloadUrl: "http://cdn.example/app.apk",
        sha256: "a".repeat(64),
        sizeBytes: 1
      })
    ).toThrow("更新下载地址必须使用 HTTPS");
  });
});

describe("fetchLatestAppUpdateManifest", () => {
  it("returns null when manifest URL is not configured", async () => {
    await expect(fetchLatestAppUpdateManifest(undefined, "android")).resolves.toBeNull();
  });

  it("fetches and validates manifest", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          platform: "android",
          version: "1.0.1",
          downloadUrl: "https://cdn.example/app.apk",
          sha256: "b".repeat(64),
          sizeBytes: 2
        })
    });

    const manifest = await fetchLatestAppUpdateManifest("https://cdn.example/latest.json", "android", fetchMock);

    expect(fetchMock).toHaveBeenCalledWith("https://cdn.example/latest.json", { headers: { Accept: "application/json" } });
    expect(manifest?.version).toBe("1.0.1");
  });
});
```

- [x] **Step 2: Verify RED**

Run: `cd server && npm test -- src/appUpdate/appUpdateManifest.test.ts`

Expected: fails because `appUpdateManifest.ts` does not exist.

- [x] **Step 3: Implement manifest module**

Implement a Zod schema with `platform`, `version`, optional `buildNumber`, optional `mandatory`, optional `releaseDate`, optional `notes`, HTTPS `downloadUrl`, 64-char hex `sha256`, and non-negative integer `sizeBytes`. Export `normalizeAppUpdateManifest()` and `fetchLatestAppUpdateManifest()`.

- [x] **Step 4: Verify GREEN**

Run: `cd server && npm test -- src/appUpdate/appUpdateManifest.test.ts`

Expected: tests pass.

---

### Task 3: Server Route

**Files:**
- Create: `server/src/appUpdate/appUpdateRoutes.ts`
- Modify: `server/src/index.ts`
- Modify: `server/.env.example`
- Modify: `server/docker-compose.yml`

- [x] **Step 1: Add route module**

Create an Express router that reads `APP_UPDATE_MANIFEST_URL`, accepts only `platform=android`, returns `204` when no manifest URL is configured, and returns `502` when fetching or parsing fails.

- [x] **Step 2: Mount route**

In `server/src/index.ts`, import `createAppUpdateRouter` and mount `app.use("/api/app-update", createAppUpdateRouter());` before authenticated data routes.

- [x] **Step 3: Document environment**

Add `APP_UPDATE_MANIFEST_URL` to `server/.env.example` and `server/docker-compose.yml`.

- [x] **Step 4: Verify server typecheck**

Run: `cd server && npm run build`

Expected: TypeScript build succeeds.

---

### Task 4: Client Update Fetch

**Files:**
- Create: `src/updates/updateClient.test.ts`
- Create: `src/updates/appVersion.ts`
- Create: `src/updates/updateClient.ts`

- [x] **Step 1: Write failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkForAppUpdate } from "./updateClient";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn()
}));

vi.mock("../sync/apiClient", () => ({
  apiRequest: mocks.apiRequest
}));

describe("checkForAppUpdate", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it("returns available update when remote version is newer", async () => {
    mocks.apiRequest.mockResolvedValue({
      platform: "android",
      version: "1.0.1",
      buildNumber: 2,
      mandatory: false,
      downloadUrl: "https://cdn.example/app.apk",
      sha256: "c".repeat(64),
      sizeBytes: 100
    });

    const result = await checkForAppUpdate({ platform: "android", version: "1.0.0", buildNumber: 1 });

    expect(result.status).toBe("available");
    expect(result.update?.version).toBe("1.0.1");
  });

  it("returns current when remote is not newer", async () => {
    mocks.apiRequest.mockResolvedValue({
      platform: "android",
      version: "1.0.0",
      buildNumber: 1,
      downloadUrl: "https://cdn.example/app.apk",
      sha256: "c".repeat(64),
      sizeBytes: 100
    });

    await expect(checkForAppUpdate({ platform: "android", version: "1.0.0", buildNumber: 1 })).resolves.toMatchObject({
      status: "current"
    });
  });
});
```

- [x] **Step 2: Verify RED**

Run: `npm test -- src/updates/updateClient.test.ts`

Expected: fails because `updateClient.ts` does not exist.

- [x] **Step 3: Implement update client**

Use `apiRequest("/api/app-update/latest?platform=android", { anonymous: true })`, compare with `isRemoteNewer()`, and return a discriminated union with `available`, `current`, `unsupported`, and `unconfigured`.

- [x] **Step 4: Verify GREEN**

Run: `npm test -- src/updates/updateClient.test.ts src/updates/versionCompare.test.ts`

Expected: tests pass.

---

### Task 5: Profile Update Card

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [x] **Step 1: Add state and loader**

Use `useFocusEffect` to check updates on Android, store loading/error/result state, and keep existing profile loading behavior unchanged.

- [x] **Step 2: Render update card**

Add a “应用更新” `SectionCard` showing current version, latest version, release notes, size, and buttons for “检查更新” and “下载更新”.

- [x] **Step 3: Open download URL**

Use `Linking.openURL(update.downloadUrl)` for the download button.

- [x] **Step 4: Verify client typecheck**

Run: `npx tsc --noEmit`

Expected: TypeScript succeeds.

---

### Task 6: R2 Release Sync Workflow

**Files:**
- Modify: `.github/workflows/eas-build.yml`
- Modify: `docs/deployment.md`

- [x] **Step 1: Add workflow env defaults**

Add `R2_RELEASE_PREFIX: releases/android` and `R2_RELEASE_KEEP: 5`.

- [x] **Step 2: Configure AWS CLI for R2 on release publish**

After GitHub Release upload, set AWS credentials from R2 secrets and endpoint `https://<account>.r2.cloudflarestorage.com`.

- [x] **Step 3: Upload APK and manifest**

Find the `.apk`, compute `sha256`/size, write `latest.json`, upload APK to `s3://$R2_BUCKET/$R2_RELEASE_PREFIX/$tag/app.apk`, and upload manifest to `s3://$R2_BUCKET/$R2_RELEASE_PREFIX/latest.json`.

- [x] **Step 4: Clean old versions**

List version directories under the prefix and delete older entries beyond `R2_RELEASE_KEEP`.

- [x] **Step 5: Document setup**

Document required GitHub secrets and server `APP_UPDATE_MANIFEST_URL`.

---

### Task 7: Final Verification

**Files:**
- All changed files.

- [x] **Step 1: Run client tests**

Run: `npm test`

Expected: all client tests pass.

- [x] **Step 2: Run client typecheck**

Run: `npx tsc --noEmit`

Expected: TypeScript succeeds.

- [x] **Step 3: Run server tests and build**

Run: `cd server && npm test && npm run build`

Expected: server tests and build pass.

- [x] **Step 4: Inspect workflow YAML**

Run: `git diff -- .github/workflows/eas-build.yml`

Expected: R2 upload is gated by release publish and does not run for preview builds.
