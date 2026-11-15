# CreatorFlow — Testing & Quality Strategy

Status: **Proposed**. Verified current state: **no test framework, no test scripts, no CI** — `server/package.json` scripts are `dev/start/build` only, `client/package.json` likewise, `.github/` absent (V15). Both TypeScript checks currently **fail** (`tsc --noEmit`: server errors in `order.controller.ts` — V13; client errors incl. server-file leakage — V14). Restoring green typechecks is a Phase 0 gate (`MIGRATION_AND_IMPLEMENTATION_ROADMAP.md`); this document defines what runs in CI thereafter.

Normative section map (referenced from other documents): **§3** = tenant-isolation tests, **§4** = API/DB contract tests, **§5** = import-boundary rules + Finding C regression tests.

---

## 1. Test layers

| Layer | Tooling (proposal — no owner approval required; ratify in Phase 1) | Scope | Runs |
|---|---|---|---|
| L0 Static | `tsc --noEmit` (both trees), ESLint (incl. `no-restricted-imports` boundary rules), secret scan, grep-pattern rules (e.g. no `req.body.amount` in payment paths) | whole repo | every push |
| L1 Unit | Vitest (or Jest — one, not both) | pure functions, state machines, zod schemas, pricing math, TTL config derivation | every push |
| L2 Component | Vitest + Testing Library | design-system components, the four state matrix (§12 of the design system), a11y assertions | every push |
| L3 Contract | Vitest against **ephemeral Postgres + Redis** (docker-class fixture) | API request/response schemas, role guards, **DB-level constraints/triggers**, idempotency, isolation | every push (main), nightly full |
| L4 E2E | Playwright | the acceptance journey (§6), browser + socket | nightly + release candidate |
| L5 Non-functional | load script (k6-class), security scan (ZAP-class baseline), dependency audit | critical paths | nightly / pre-release |

Test files: colocated `*.test.ts` per module (`SYSTEM_COMPONENT_ARCHITECTURE.md` §3); cross-module suites in `server/tests/`. **Fixtures** (workspace + 4 roles + project + 2 versions) are shared and versioned; tests never depend on seeded prod-like data.

## 2. Unit & component focus (highest value first)

1. **Pricing derivation** (SEC-07): `minorUnits(video.price)`, currency rules — pure, exhaustive table test.
2. **TTL derivation** (SEC-03): cookie `maxAge` === JWT `exp` for every config combination — the Finding B guard.
3. **State machines**: `review_state`, `publish_package.state`, `publish_job.state`, `ai_job.state`, `processing_state` — every legal transition allowed, every illegal one rejected (table-driven from `API_CONTRACT_AND_MODULES.md` §5).
4. **Attempt/backoff math** (§5.6): `attempt` never exceeds `max_attempts`; backoff formula with jitter bounds.
5. zod schemas: fuzz bodies with extra fields → rejected (mass-assignment guard, SEC-06).
6. Design-system: `StateChip` enum→semantic mapping; theme tokens have no hard-coded color (lint-verified).

## 3. Tenant isolation tests (normative — referenced by `DATABASE_SCHEMA_AND_ERD.md` §1.1, §5.3)

Assert **database properties**, not only API behavior:

| ID | Test |
|---|---|
| ISO-1 | Insert a child row whose `workspace_id` ≠ parent's `workspace_id` → **composite FK rejects** (DB-1) |
| ISO-2 | Every `/workspaces/:wsId/…` route: non-member session → `403 FORBIDDEN`, and a spy on the repository proves **no query executed** |
| ISO-3 | Member of A requesting a resource id owned by B (even with a valid uuid) → `404`/`403`, never data (IDOR/SEC-05) |
| ISO-4 | Repository methods require `workspace_id` — a unit test fails if any exported repository function lacks a workspace-scoped signature |
| ISO-5 | Socket: member of A joining `ws:{B}` → denied; revoked member receives `session.revoked` and is dropped from rooms (SEC-11) |
| ISO-6 | Platform-admin endpoints do not widen tenant queries (audit read still scoped; `/admin/*` audited) |
| ISO-7 | Search/list endpoints never return rows from another workspace even with crafted cursors |

These run at L3 on every push — they are the acceptance evidence for SEC-04.

## 4. API & database contract tests (normative — referenced by `SYSTEM_COMPONENT_ARCHITECTURE.md` §4.2, `DATABASE_SCHEMA_AND_ERD.md` DB-8)

Source of truth chain: zod schemas → generated OpenAPI 3.1 → tests assert the implementation matches (`API_CONTRACT_AND_MODULES.md` §6).

**Required cases:**

| ID | Test |
|---|---|
| CT-1 | Every documented route exists, has its role guard, and rejects one step down the role ladder (viewer→comment, editor→approve, editor→publish enqueue) |
| CT-2 | Response schemas match; **no token/password-shaped field in any response type** (guards against V4/V6/V7 regressions, automated) |
| CT-3 | **Idempotency (DB-8):** same `Idempotency-Key` + same body → replayed stored response; same key + different body → `409 IDEMPOTENCY_MISMATCH`; concurrent duplicate → `409 IDEMPOTENCY_IN_PROGRESS`; derived job key wins over the header (`API_CONTRACT_AND_MODULES.md` §1.5) |
| CT-4 | **Approval invariant:** insert a `publish_job` against an unapproved version → **constraint trigger rejects** (not just the API) — evidence for `SYSTEM_COMPONENT_ARCHITECTURE.md` §4.2 and SEC-15 |
| CT-5 | Stale approval: `expectedUpdatedAt` mismatch → `409 VERSION_STALE`, zero rows written; concurrent approve/submit race → one winner |
| CT-6 | Approval decision ↔ state mapping: `approve` writes `decision='approved'` **and** `review_state='approved'` atomically; `request-changes` likewise (no orphan rows) |
| CT-7 | State machines: illegal transition (e.g. `approved → submitted`) rejected at API and CHECK-constraint level |
| CT-8 | DB invariants: second `approved` approval per version rejected (DB-3); one live `ai_output` per (job, schema, version) (DB-4); one live package per (project, version) (DB-5); media columns immutable (DB-6); `audit_event` UPDATE/DELETE rejected (DB-7) |
| CT-9 | Error envelope: internal error → `INTERNAL` + `requestId` only, **no** `err.message` (V19 regression, SEC-16) |
| CT-10 | Rate limits: auth endpoints trip at documented thresholds (V8 regression) |
| CT-11 | Publish idempotency: double enqueue / double delivery / crash-resume → exactly one `publish_job` row (SEC-14, YT-3/YT-4) |
| CT-12 | Payment: A-1…A-6 from `SECURITY_AND_THREAT_MODEL.md` §4.1 (Finding A) |
| CT-13 | Session: B-1…B-7 from `SECURITY_AND_THREAT_MODEL.md` §4.2 (Finding B) |
| CT-14 | Upload: polyglot/oversize/checksum-mismatch rejected before any provider call (SEC-08); no endpoint fetches a caller URL (SEC-09) |
| CT-15 | Realtime handshake: unauthenticated socket rejected before any room (SEC-11) |

## 5. Import boundary rules & Finding C regression tests (normative)

**Rule (canonical, mirrors `SYSTEM_COMPONENT_ARCHITECTURE.md` §3):**

1. Code under `server/**` must never be imported by code under `client/**`, and vice versa.
2. Cross-boundary types/constants live in `shared/**` — vendor-free, side-effect-free, and itself forbidden from importing either tree.
3. Exceptions require an ADR entry; none exist today.

**Why it must be mechanical:** the current violation is real — `client/redux/features/videos/videosApi.ts:1` imports `addReplyToReview` from `../../../../server/controllers/video.controller` (symbol unused; the file defines its own mutation at `videosApi.ts:88`). The dead import pulls `mongoose`, `cloudinary`, `ejs`, `express`, `axios`, `../utils/redis`, `../utils/sendMail` into the client program; `client/tsconfig.json:24` includes `**/*.ts`, so the server file compiles inside the client project and yields **10 `TS2339` errors** under `../server/controllers/video.controller.ts` (lines 164, 210, 218, 271, 281, 283, 331, 344, 362, 364). Finding C (P1) stays **OPEN** until the import is removed and these tests pass.

**Enforcement (three layers):**

| Layer | Mechanism |
|---|---|
| Lint | ESLint `no-restricted-imports`/`no-restricted-paths`: `client/**` cannot resolve `../server/**` (and vice versa); `shared/**` cannot import either |
| Typecheck | CI fails when any `client/tsc --noEmit` error references a path outside `client/` (parse the error output; this is what turns today's 10 errors into a red build) |
| Architecture test | a repo scan test asserts no `import … from '.*server/'` statement exists under `client/` (guards against lint-config drift) |

**Finding C closure tests:** C-1 (lint), C-2 (out-of-root typecheck errors), C-3 (`shared/` purity) — specified in `SECURITY_AND_THREAT_MODEL.md` §4.3. Closure requires the source fix **and** these tests green, confirmed independently of the fix's author.

## 6. E2E acceptance journey (the product's spine)

One Playwright suite walks the normative workflow (`CREATORFLOW_MASTER_ARCHITECTURE.md` §1.1) with the four role users:

1. Owner creates workspace → invites editor → editor accepts.
2. Editor creates project, uploads a version (resumable, checksum), waits for `ready` (fake provider webhook).
3. Editor runs `transcribe`, gets a transcript, submits the version.
4. Owner opens review, posts a timestamped comment + change request; socket delivery asserted (room-scoped).
5. Editor creates a **new** version, links a `revision`, submits; withdraw/submit edge cases asserted.
6. Owner approves with `expectedUpdatedAt`; stale-approval variant asserted (409).
7. Editor prepares a publish package (`draft`); **editor validate attempt → 403**; owner validates → `validated`.
8. Owner enqueues publish; job reaches `published` against the fake YouTube adapter; **duplicate enqueue → same job**; unapproved-version publish attempt → DB trigger rejection.
9. Viewer attempts comment/approve/publish → 403 each (role matrix).
10. Cross-workspace probe (member of A touches B's ids) → 403/404 (ISO-3).
11. Logout → previously issued token rejected (B-4).

Suite runs nightly and on release candidates; steps 6–8 are the release-blocking core.

## 7. Non-functional tests

- **Load:** upload-concurrency and review-read spikes at 2× expected peak (assumption: define peak after Phase 5 beta); assert queue lag SLO and API p95.
- **Security baseline:** ZAP-class scan of staging on every release candidate; the 16 SEC regression suites (§3–§5) are the deeper gate.
- **Chaos-lite:** kill a worker mid-upload → job resumes from job-row state; flush Redis → no job loss, sessions re-login (§INFRASTRUCTURE_AND_DEPLOYMENT.md §7).
- **Dependency audit + secret scan** in CI (V18 class).

## 8. Quality gates (what blocks what)

| Gate | Blocks |
|---|---|
| L0 green (typecheck both trees, lint, boundary rules, secret scan) | merge |
| L1–L3 green | merge |
| Findings A/B/C closed with their tests (`SECURITY_AND_THREAT_MODEL.md` §4) | **feature development start** (Phase 0 exit) |
| L4 nightly green on release candidate | release |
| Phase acceptance criteria (roadmap) | next phase |

## 9. Acceptance criteria for this strategy

| # | Criterion |
|---|---|
| T-1 | CI runs L0–L3 on every push; no merge without them |
| T-2 | ISO-1…ISO-7 pass (evidence for SEC-04) |
| T-3 | CT-1…CT-15 pass (evidence for the approval invariant, idempotency, retries, V19/V8 regressions) |
| T-4 | C-1…C-3 pass (Finding C closed) |
| T-5 | The §6 journey passes nightly, steps 6–8 release-blocking |
| T-6 | Coverage of state machines and pricing/TTL derivation = 100 % of enumerated cases (table-driven, not percentage vanity) |
