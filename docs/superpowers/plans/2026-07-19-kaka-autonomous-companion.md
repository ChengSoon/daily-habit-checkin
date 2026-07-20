# Kaka Autonomous Companion Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user prohibited subagents, so execution stays inline.

**Goal:** Build the first-phase in-app companion loop: bounded proactive events, authenticated shared chat and memory, deterministic bond growth, mood interactions, and safe LLM responses.

**Architecture:** Client events pass a local eligibility gate and then call authenticated companion endpoints. The server rechecks rate limits and idempotency, derives authoritative context from the current space, owns the prompt and model, validates structured output, and persists shared state. `PetContext` remains the presentation boundary; network or model failure uses local event-specific responses.

**Tech Stack:** Expo 57, React Native 0.86, Expo Router, TypeScript 6, Express 5, PostgreSQL, OpenAI SDK, Zod 4, Vitest.

**Execution rule:** Do not commit until the user explicitly authorizes Git history changes. Each checkpoint uses tests plus `git diff --check` instead.

---

## File Map
- Create `server/src/companion/companionSchemas.ts`: strict request/response schemas and exported domain types.
- Create `server/src/companion/companionPolicy.ts`: server quota, cooldown, dedupe, and bond stage rules.
- Create `server/src/companion/companionSafety.ts`: deterministic risk classification and crisis response.
- Create `server/src/companion/companionSchema.ts`: companion-only idempotent PostgreSQL schema.
- Create `server/src/companion/companionRepository.ts`: space-scoped messages, events, memories, member state, and bond writes.
- Create `server/src/companion/companionStateRepository.ts`: transactional member delivery and bond state writes.
- Create `server/src/companion/companionContext.ts`: authoritative seven-day habit and shared-history snapshot.
- Create `server/src/companion/companionModel.ts`: fixed prompts, structured generation, and chat streaming.
- Create `server/src/companion/companionService.ts`: orchestration and failure-safe business rules.
- Create `server/src/companion/companionRoutes.ts`: authenticated HTTP/SSE routes.
- Modify `server/src/db/schema.ts`, `server/src/index.ts`: run companion schema and mount routes.
- Create `src/pet/companionTypes.ts`: client response validation and UI types.
- Create `src/pet/companionPolicy.ts`: foreground, quiet-hours, busy-state eligibility.
- Create `src/pet/companionFallback.ts`: deterministic offline copy per event.
- Create `src/pet/companionClient.ts`: authenticated JSON/SSE client and CRUD calls.
- Create `src/pet/useCompanionEngine.ts`: app lifecycle, event coordination, cancellation, and sync reload.
- Create `src/pet/PetQuickActions.tsx`, `src/pet/MoodCheckInSheet.tsx`: compact interaction UI.
- Create `src/pet/CompanionMemoryPanel.tsx`: shared memory and bond management UI.
- Modify `src/pet/GlobalPet.tsx`, `src/pet/PetChatPanel.tsx`, `src/pet/PetContext.tsx`, `src/pet/FloatingPet.tsx`, `src/pet/types.ts`, `src/pet/index.ts`: persistent shared chat and richer presentation.
- Create `app/companion-settings.tsx`; modify `app/(tabs)/profile.tsx`, `app/_layout.tsx`: settings entry and route.
- Modify `app/(tabs)/index.tsx`, `src/sync/syncInvalidation.ts`: emit check-in events and refresh companion resources.

### Task 1: Server Contracts, Policy, And Safety
**Files:** Create `server/src/companion/companionSchemas.ts`, `companionPolicy.ts`, `companionSafety.ts` and colocated tests.

- [x] **Step 1: Write failing schema tests** for strict per-event payloads, `silent` field exclusion, output length, and memory proposal categories.
- [x] **Step 2: Run** `npm test -- src/companion/companionSchemas.test.ts` in `server/`; expect missing-module failure.
- [x] **Step 3: Implement strict schemas** with these public contracts:
```ts
export const CompanionEventSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1).max(128), type: z.literal("app_returned"), occurredAt: z.iso.datetime(), timezoneOffsetMinutes: z.number().int().min(-840).max(840), payload: z.object({}).strict() }).strict(),
  z.object({ id: z.string().min(1).max(128), type: z.literal("checkin_completed"), occurredAt: z.iso.datetime(), payload: z.object({ habitId: z.string().min(1).max(128), streak: z.number().int().nonnegative(), allDone: z.boolean(), milestoneDays: z.number().int().positive().nullable() }).strict() }).strict(),
  z.object({ id: z.string().min(1).max(128), type: z.literal("all_done"), occurredAt: z.iso.datetime(), payload: z.object({ dateKey: z.iso.date() }).strict() }).strict(),
  z.object({ id: z.string().min(1).max(128), type: z.literal("streak_milestone"), occurredAt: z.iso.datetime(), payload: z.object({ habitId: z.string().min(1).max(128), days: z.number().int().positive() }).strict() }).strict(),
  z.object({ id: z.string().min(1).max(128), type: z.literal("partner_progress"), occurredAt: z.iso.datetime(), payload: z.object({ checkInId: z.string().min(1).max(128), habitId: z.string().min(1).max(128) }).strict() }).strict(),
  z.object({ id: z.string().min(1).max(128), type: z.literal("mood_checkin"), occurredAt: z.iso.datetime(), payload: z.object({ score: z.number().int().min(1).max(5), note: z.string().trim().max(500) }).strict() }).strict(),
  z.object({ id: z.string().min(1).max(128), type: z.enum(["evening_no_progress", "quick_encouragement", "daily_reflection"]), occurredAt: z.iso.datetime(), payload: z.object({}).strict() }).strict()
]);
export const CompanionReplySchema = z.object({ version: z.literal(1), eventId: z.string(), decision: z.enum(["speak", "silent"]), message: z.string().trim().max(240).optional(), mood: z.enum(["idle", "happy", "thinking", "waiting", "sad", "wave"]), intent: z.enum(["celebrate", "comfort", "encourage", "listen", "reflect"]), riskLevel: z.enum(["normal", "distress", "crisis"]), suggestedAction: z.enum(["open_habit", "open_checkin", "open_chat"]).optional(), followUpQuestion: z.string().trim().max(120).optional(), memoryProposal: z.object({ category: z.enum(["preference", "important_date", "shared_goal", "encouragement_style", "shared_moment"]), content: z.string().trim().min(1).max(200) }).optional() }).strict();
```
- [x] **Step 4: Write and pass policy tests** proving ordinary cap `2/day/member`, `90m` cooldown, `24h` fingerprint dedupe, requested-event exemption, monotonic bond stages, and duplicate `sourceKey` rejection.
- [x] **Step 5: Write and pass safety tests** for distress/crisis phrases, conservative risk merge, and non-roleplay crisis copy.
- [x] **Step 6: Run** `npm test -- src/companion/companionSchemas.test.ts src/companion/companionPolicy.test.ts src/companion/companionSafety.test.ts` and `npm run build` in `server/`; expect all pass.

### Task 2: Companion Persistence
**Files:** Create `server/src/companion/companionSchema.ts`, `companionRepository.ts`, `companionStateRepository.ts` and tests; modify `server/src/db/schema.ts`.

- [x] **Step 1: Write repository tests** with a mocked `Pool`/`PoolClient` asserting every query receives auth-derived `spaceId`, events use `ON CONFLICT`, memory deletes include `space_id`, and bond writes are transactional.
- [x] **Step 2: Run** `npm test -- src/companion/companionRepository.test.ts` in `server/`; expect missing exports.
- [x] **Step 3: Add idempotent schema** for `companion_events`, `companion_messages`, `companion_memories`, `companion_space_state`, `companion_member_state`, and `companion_bond_events`, including foreign keys, `(space_id,event_id)`/`(space_id,source_key)` unique constraints, and indexes for message expiry/order.
- [x] **Step 4: Keep the base schema file under 300 lines** by exporting `runCompanionSchema()` from the new file and invoking it after `SCHEMA_SQL` completes.
- [x] **Step 5: Implement repository methods**:
```ts
claimEvent(spaceId, accountId, event): Promise<{ claimed: boolean; cachedReply: CompanionReply | null }>;
completeEvent(spaceId, eventId, reply): Promise<void>;
listRecentMessages(spaceId, limit): Promise<CompanionMessage[]>;
appendExchange(spaceId, accountId, userMessage, assistantMessage, meta): Promise<void>;
listMemories(spaceId): Promise<CompanionMemory[]>;
saveMemory(spaceId, accountId, proposal): Promise<CompanionMemory>;
deleteMemory(spaceId, memoryId): Promise<boolean>;
readMemberStateForUpdate(client, spaceId, accountId): Promise<MemberDeliveryState>;
awardBond(spaceId, sourceKey, points): Promise<BondState>;
```
- [x] **Step 6: Run** repository tests, `npm run build`, `git diff --check`; expect pass.

### Task 3: Authoritative Context And Model Boundary
**Files:** Create `server/src/companion/companionContext.ts`, `companionPrompt.ts`, `companionModel.ts` and tests.

- [x] **Step 1: Write failing context tests** proving the snapshot includes member names, active habits, today/7-day aggregates, last 12 messages, confirmed memories, and bond stage, while excluding notes, email, API keys, and full raw history.
- [x] **Step 2: Implement `buildCompanionContext(spaceId, accountId, now)`** using parameterized space-scoped queries and a 7-day date range.
- [x] **Step 3: Write prompt tests** that assert fixed persona, shared-visibility reminder, one-question limit, anti-dependency language, no client system prompt, and JSON response contract.
- [x] **Step 4: Implement injectable model interface**:
```ts
export interface CompanionModel {
  respond(input: ModelCompanionInput): Promise<CompanionReply>;
  streamChat(input: ModelChatInput, onDelta: (text: string) => void): Promise<string>;
}
```
Use server `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`; set a bounded timeout and validate parsed JSON with `CompanionReplySchema`.
- [x] **Step 5: Run** context/prompt/model tests and `npm run build`; expect pass.

### Task 4: Service And Authenticated Routes
**Files:** Create `server/src/companion/companionService.ts`, `companionRoutes.ts` and tests; modify `server/src/index.ts`.

- [x] **Step 1: Write service tests** for duplicate event reuse, server-side quota rejection before model call, crisis override, model failure fallback without bond/memory writes, and successful persisted response.
- [x] **Step 2: Implement service orchestration** in this order: claim event, server policy, context load, deterministic risk check, model call or crisis response, response validation, persistence, optional deterministic bond award, sync notification.
- [x] **Step 3: Write route tests** mounting a real Express app with mocked auth/service; prove unauthenticated `401`, request validation `400`, auth identity forwarding, SSE headers, shared message pagination, memory confirmation/deletion, and no body-provided `spaceId` support.
- [x] **Step 4: Implement routes**:
```text
POST   /api/companion/respond
POST   /api/companion/chat
GET    /api/companion/messages?cursor=&limit=
DELETE /api/companion/messages
GET    /api/companion/memories
POST   /api/companion/memories
DELETE /api/companion/memories/:id
GET    /api/companion/state
PUT    /api/companion/state
```
- [x] **Step 5: Mount** `app.use("/api/companion", requireAuth, createCompanionRouter({ onChange }))`; reuse the existing rate limiter as an outer cost guard.
- [x] **Step 6: Run** all companion server tests, full `npm test`, and `npm run build` in `server/`; expect pass.

### Task 5: Client Contracts, Local Gate, And Transport
**Files:** Create `src/pet/companionTypes.ts`, `companionPolicy.ts`, `companionFallback.ts`, `companionClient.ts` and tests.

- [x] **Step 1: Write failing client tests** for response parsing, unknown action rejection, foreground/busy/quiet-hours gate, fallback copy, and SSE chunk parsing.
- [x] **Step 2: Implement client schemas/types** matching server JSON, including `CompanionMessage`, `CompanionMemory`, `CompanionState`, and explicit `SharedVisibility = "shared"`.
- [x] **Step 3: Implement local gate**:
```ts
shouldAttemptEvent({ event, appState, panelOpen, typing, bubbleDismissedAt, quietHours, now }): { allowed: boolean; reason: string };
```
Requested events and direct check-in feedback bypass quiet hours; unsolicited events do not.
- [x] **Step 4: Implement authenticated CRUD with `apiRequest`** and authenticated SSE using `getApiBaseUrl()` plus `getAuthToken()`. Abort on account/space changes and expose only natural user errors.
- [x] **Step 5: Run** `npm test -- src/pet/companionTypes.test.ts src/pet/companionPolicy.test.ts src/pet/companionClient.test.ts` and `npx tsc --noEmit`; expect pass.

### Task 6: Companion Engine And Shared Chat
**Files:** Create `src/pet/useCompanionEngine.ts`; modify `src/pet/GlobalPet.tsx`, `PetChatPanel.tsx`, `PetContext.tsx`, `types.ts`, `index.ts`; remove pet chat use of `petAi.ts`/`petPersona.ts` after migration.

- [x] **Step 1: Write engine reducer tests** for loading shared history, one in-flight event, cancellation, stale-space reply rejection, sync refresh, fallback display, and no duplicate current user message.
- [x] **Step 2: Implement `useCompanionEngine`** with app foreground events, sync subscription filtered to `resource === "companion"`, request abort, message pagination, and `sendChat(message)` streaming state.
- [x] **Step 3: Keep `GlobalPet.tsx` under 180 lines** by delegating network/state to the hook; wire loaded messages, sender names, streaming draft, safe errors, and model replies into `PetContext.say`.
- [x] **Step 4: Update chat panel** to show `共同对话 · 双方可见`, sender labels, loading/empty states, and memory proposal confirmation without nesting cards.
- [x] **Step 5: Delete or stop exporting obsolete client-owned system prompts** so companion prompts exist only on the server; retain local fallback persona text only.
- [x] **Step 6: Run** focused pet tests and `npx tsc --noEmit`; expect pass.

### Task 7: Touch Actions And Mood Check-In
**Files:** Create `src/pet/PetQuickActions.tsx`, `MoodCheckInSheet.tsx`; modify `FloatingPet.tsx`, `GlobalPet.tsx`, `PetSprite.tsx`, `petAnimation.ts` and tests.

- [x] **Step 1: Write interaction-state tests** for tap opening actions, drag not opening actions, action dismissal, five valid mood scores, and `review` animation override.
- [x] **Step 2: Implement a stable icon toolbar** for chat, mood, encouragement, and reflection; preserve the existing drag responder and accessibility labels.
- [x] **Step 3: Implement mood sheet** with a five-option segmented control, optional 500-character note, shared-visibility label, submit/cancel states, and keyboard-safe layout.
- [x] **Step 4: Map actions** to user-request events; use `review` for reflection/bond unlock and preserve reduced-motion first-frame behavior.
- [x] **Step 5: Run** interaction tests, TypeScript, and targeted ESLint; expect pass.

### Task 8: Memories, Bond, And Settings
**Files:** Create `src/pet/CompanionMemoryPanel.tsx`, `app/companion-settings.tsx`; modify `app/(tabs)/profile.tsx`, `app/_layout.tsx` and tests.

- [x] **Step 1: Write pure view-model tests** for four bond stages, category labels, delete confirmation copy, 90-day chat clear warning, and per-member proactive mode serialization.
- [x] **Step 2: Build an unframed settings screen** with pet visibility, proactive mode (`off|restrained|balanced`), reused quiet-hours summary, bond stage, shared memory filters/delete, and destructive shared-chat clear confirmation.
- [x] **Step 3: Add one `paw`/`heart` settings row** in profile that navigates to `/companion-settings`; do not expand the existing 497-line profile file with companion logic.
- [x] **Step 4: Register the route** in the root stack and load/save member state through companion endpoints.
- [x] **Step 5: Run** view-model tests, TypeScript, and ESLint; expect pass.

### Task 9: Real Events And Partner Synchronization
**Files:** Modify `app/(tabs)/index.tsx`, `src/pet/PetContext.tsx`, `src/pet/useCompanionEngine.ts`, `src/sync/syncInvalidation.ts`; add focused tests.

- [x] **Step 1: Add an event-emission API** to `PetContext` that accepts typed `CompanionEvent` while preserving `notifyCheckIn` compatibility during migration.
- [x] **Step 2: Emit stable event IDs** after successful check-ins using check-in ID plus event kind; include only habit ID and deterministic streak/milestone fields.
- [x] **Step 3: On foreground** send `app_returned`; let server context/policy decide welcome-back or evening-no-progress behavior before any model call.
- [x] **Step 4: On `check_ins` invalidation** reload check-ins, diff unseen IDs, and emit `partner_progress` only when `createdBy !== currentAccount.id`; never infer partner emotion.
- [x] **Step 5: Test** own-write suppression, duplicate invalidation dedupe, partner event creation, and ordinary daily cap; run focused tests and TypeScript.

### Task 10: Integration, Visual QA, And Completion Gate
**Files:** Update tests and documentation only as failures require; do not broaden behavior.

- [x] **Step 1: Run client gates:** `npm test`, `npx tsc --noEmit`, `npm run lint`.
- [x] **Step 2: Run server gates:** `cd server && npm test && npm run build`.
- [x] **Step 3: Run schema/integration checks** against the documented local PostgreSQL environment: create two accounts in one space and one account in another; prove shared visibility and cross-space isolation through HTTP responses.
- [ ] **Step 4: Start Expo Web** with an unused local port, open the actual app, and verify desktop plus mobile widths: no overlap, nonblank pet sprite, drag, quick actions, mood sheet, shared chat, memory confirmation, settings, and reduced motion.
- [ ] **Step 5: Exercise failure paths** with model unavailable and network offline; verify local copy, no raw errors, no stale replay, no memory/bond mutation.
- [x] **Step 6: Audit all ten design acceptance criteria** against source, tests, API evidence, and screenshots; record any unavailable external verification explicitly.
- [x] **Step 7: Run** `git diff --check`, inspect `git status`, and report changes without committing.

## Completion Verification (2026-07-20)

- Client: 48 test files / 197 tests passed; `npx tsc --noEmit` passed; Expo lint exited 0 with 14 pre-existing warnings outside companion files.
- Server: 23 test files / 105 tests passed; `npm run build` passed. Missing OpenAI credentials now fail lazily and use the service fallback instead of crashing startup.
- PostgreSQL/HTTP: A and B joined one space while C remained separate. B saw A's message, memory, and bond; C saw zero shared rows and received 404 when deleting A/B memory.
- Failure evidence: missing-model fallback returned natural copy, hid raw errors, reused duplicate event replies, appended one message, and changed neither memory nor bond.
- Web smoke: Expo Web served HTTP 200 (43 KB SSR shell). The 1536x1872 WebP pet atlas is nonblank and has alpha.
- Unavailable external verification: `agent.browsers.list()` returned `[]`; desktop/mobile screenshots, drag/click flows, overlap inspection, reduced-motion observation, and browser-offline UI behavior could not be executed. Task 10 Steps 4-5 therefore remain unchecked.

### Acceptance Audit

1. Pass: server policy tests cover 2/day, 90-minute cooldown, 24-hour dedupe, restrained/off modes, and member-local midnight; client tests cover quiet hours/busy/dismissal gates.
2. Pass by source/tests: typed check-in, milestone, app-return, partner-progress, and mood events map to bounded replies and animation moods; visual observation is unavailable.
3. Pass: live two-account/three-account HTTP evidence proves shared visibility and cross-space isolation.
4. Pass: memory proposal confirmation says both parties can see it; list/delete behavior is tested and cross-space deletion is blocked.
5. Pass: bond stages are monotonic, source keys are unique, retry/dedup tests pass, and check-in milestone facts award deterministic points.
6. Pass: invalid output/model failure tests and live no-key fallback show safe local copy without memory/bond mutation.
7. Pass: deterministic distress/crisis classification and non-roleplay crisis copy are covered by service/safety tests.
8. Pass: chat prompt/current-message tests prove one user message; UI/server errors are normalized before display.
9. Partial: drag, animation, interaction reducer, reduced-motion frame, TypeScript, and asset checks pass; real browser interaction is unavailable.
10. Partial: unit/full suites, TypeScript, lint, build, PostgreSQL HTTP integration, and Web HTTP smoke pass; screenshot-based visual smoke is unavailable.
