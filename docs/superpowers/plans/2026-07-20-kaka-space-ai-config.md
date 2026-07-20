# Kaka Space AI Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kaka use the authenticated couple space's complete AI configuration before falling back to server `OPENAI_*` settings.

**Architecture:** Add a server-side resolver that reads only `aiBaseUrl`, `aiApiKey`, and `aiModel` from `app_settings` using the auth-derived `space_id`. The companion service resolves a model per operation, while prompts, safety rules, context building, persistence, and request schemas remain server-owned. Provider failures keep the existing user-facing fallback but emit redacted diagnostics.

**Tech Stack:** Express 5, PostgreSQL, OpenAI SDK, TypeScript 6, Zod 4, Vitest.

**Delivery note:** This plan does not create commits unless the user separately authorizes Git history changes.

---

### Task 1: Resolve Space Model Configuration

**Files:**
- Create: `server/src/companion/companionModelResolver.ts`
- Create: `server/src/companion/companionModelResolver.test.ts`

- [x] **Step 1: Write failing resolver tests**

Cover the preferred space configuration, incomplete-setting fallback, URL normalization, and parameterized `space_id` query:

```ts
expect(await resolver.resolve("space-1")).toMatchObject({ source: "space" });
expect(queries[0].values).toEqual(["space-1", ["aiBaseUrl", "aiApiKey", "aiModel"]]);
expect(queries[0].text).toContain("key = ANY($2::text[])");
```

- [x] **Step 2: Run the test and verify RED**

Run: `cd server && npm test -- --run src/companion/companionModelResolver.test.ts`

Expected: FAIL because `companionModelResolver.ts` does not exist.

- [x] **Step 3: Implement the minimal resolver**

Expose:

```ts
export type ResolvedCompanionModel = {
  model: CompanionModel;
  source: "space" | "server";
};

export function createCompanionModelResolver(options?: {
  db?: CompanionDb;
  serverModel?: CompanionModel;
  createModel?: (options: CompanionModelOptions) => CompanionModel;
}): { resolve(spaceId: string): Promise<ResolvedCompanionModel> };
```

The resolver queries only the three AI keys, requires all trimmed values for a space override, normalizes the OpenAI-compatible base URL, and otherwise reuses the server model.

- [x] **Step 4: Run the resolver test and verify GREEN**

Run: `cd server && npm test -- --run src/companion/companionModelResolver.test.ts`

Expected: PASS.

### Task 2: Support Request-Scoped OpenAI Credentials

**Files:**
- Modify: `server/src/companion/companionModel.ts`
- Modify: `server/src/companion/companionModel.test.ts`

- [x] **Step 1: Write a failing model-options test**

Inject an SDK factory and assert that explicit `apiKey` and `baseUrl` are used instead of environment values without exposing the key in output.

- [x] **Step 2: Run the test and verify RED**

Run: `cd server && npm test -- --run src/companion/companionModel.test.ts`

Expected: FAIL because model options do not accept request-scoped credentials.

- [x] **Step 3: Implement explicit provider options**

Extend `createCompanionModel` with `apiKey`, `baseUrl`, and an injectable SDK factory. Preserve lazy environment validation, timeout, structured response validation, and streaming behavior.

- [x] **Step 4: Run model tests and verify GREEN**

Run: `cd server && npm test -- --run src/companion/companionModel.test.ts`

Expected: PASS.

### Task 3: Route Companion Operations Through the Resolver

**Files:**
- Modify: `server/src/companion/companionService.ts`
- Modify: `server/src/companion/companionService.test.ts`
- Create: `server/src/companion/companionModelDiagnostics.ts`
- Create: `server/src/companion/companionServiceState.ts`
- Modify: `server/src/companion/companionPrompt.ts`
- Modify: `server/src/companion/companionPrompt.test.ts`

- [x] **Step 1: Write failing service tests**

Assert that both `respond` and `chat` resolve with the request `spaceId`, call the returned model, and log only redacted metadata on provider failure:

```ts
expect(resolveModel).toHaveBeenCalledWith("space-1");
expect(warn).toHaveBeenCalledWith(
  "companion model failed",
  expect.objectContaining({ source: "space", operation: "chat", status: 429 })
);
```

- [x] **Step 2: Run the tests and verify RED**

Run: `cd server && npm test -- --run src/companion/companionService.test.ts`

Expected: FAIL because the service still owns one fixed model and emits no diagnostics.

- [x] **Step 3: Implement resolver wiring and redacted logging**

Resolve only after policy and crisis gates. Log only `name`, numeric `status`, string `code`, `operation`, and `source`; never log credentials, prompts, user messages, or raw errors.

- [x] **Step 4: Run service tests and verify GREEN**

Run: `cd server && npm test -- --run src/companion/companionService.test.ts`

Expected: PASS.

- [x] **Step 5: Make the structured prompt enumerate the strict schema**

List the exact `mood`, `intent`, `riskLevel`, `suggestedAction`, and `memoryProposal` values in the server prompt and add a prompt test. Keep `CompanionReplySchema` strict so provider-specific labels such as `gentle` or `low` still fail safely instead of becoming application state.

### Task 4: Integration Verification

**Files:**
- Verify: `server/src/companion/*.test.ts`
- Verify: `docs/superpowers/specs/2026-07-19-kaka-autonomous-companion-design.md`

- [x] **Step 1: Run server quality gates**

Run: `cd server && npm test && npm run build`

Expected: all tests and TypeScript compilation pass.

- [x] **Step 2: Run repository quality gates**

Run: `npm test`, `npm run lint`, and `npx tsc --noEmit` from the repository root.

Expected: all commands pass without new errors.

- [x] **Step 3: Rebuild the local app container**

Run: `cd server && docker compose up -d --build --no-deps app`

Expected: `habit-app` is running and `/health` returns HTTP 200.

- [x] **Step 4: Run real space-config model smoke tests**

Resolve an existing configured space inside the rebuilt container, then send synthetic chat and proactive events directly through the resolved model. Confirm both responses pass validation and are not fallback copy without persisting diagnostic messages or exposing credentials.
