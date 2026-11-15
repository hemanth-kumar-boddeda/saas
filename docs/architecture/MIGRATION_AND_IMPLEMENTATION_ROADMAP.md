# CreatorFlow — Migration & Implementation Roadmap

Status: **Proposed**. 13 phases (Phase 0 … Phase 12). **Phase 0 is security remediation and repository stabilization; no feature development starts before its exit gate passes.** External lead times from `CREATORFLOW_MASTER_ARCHITECTURE.md` §5 are scheduled, not assumed away. Phase gates are blocking: a phase cannot start while the previous exit criteria lack evidence.

---

## 1. KEEP / REFACTOR / REPLACE map (verified current code)

| Current asset | Verdict | Destination |
|---|---|---|
| `server/server.ts` (Express assembly, `/v1` prefix) | **KEEP** structure, refactor | `server/src/api.ts` + `platform/` (CORS config, body limits) |
| `server/routes/*.ts` + `server/controllers/*.ts` | **REFACTOR** | `server/src/modules/<module>/{routes,service}.ts` (layout per `SYSTEM_COMPONENT_ARCHITECTURE.md` §3); security fixes first (Phase 0) |
| `server/models/*.ts` (Mongoose) | **REPLACE** (CreatorFlow entities) / **KEEP read-only** (legacy marketplace) | Prisma schema (ADR-006); `server/src/legacy/` keeps Mongoose models untouched |
| `server/middleware/auth.ts` | **REPLACE** | session middleware + `requireRole`/`workspaceScope` (V1, V2 removed in Phase 0; full model Phase 3) |
| `server/middleware/error.ts` | **REFACTOR** | error envelope, no message leak (V19, Phase 0) |
| `server/utils/jwt.ts`, Redis session | **REPLACE** | `session` table + namespaced cache, single TTL config (SEC-03; Phase 3, with P0 stop-gaps in Phase 0) |
| `server/utils/redis.ts` (ioredis) | **KEEP** | platform/redis; `@upstash/redis` dependency removed as unused (V24) |
| `server/controllers/order.controller.ts` | **REFACTOR** (P0) | trusted pricing (SEC-07) in Phase 0; Stripe subscription flows rebuilt Phase 10 |
| `server/socketServer.ts` | **REPLACE** | authenticated handshake + canonical rooms (Phase 3) |
| `server/app.ts` (commented out) | **DELETE** | dead file (V17) |
| `client/` Next.js 14 + RTK Query | **KEEP** structure | route groups + design system (Phase 5 onward); `videosApi.ts:1` import removed Phase 0 (Finding C) |
| `client/app/hooks/adminProtected.tsx` | **KEEP as cosmetic**, document | server-side guards are authoritative |
| Cloudinary thumbnails/avatars | **KEEP until Phase 4** | migrate to object storage with assets |
| VdoCipher playback | **REPLACE in Phase 4** | provider playback (ADR-003); OTP endpoint locked in Phase 0 (V11) |
| Cron inside `notification.controller.ts` | **REPLACE** | scheduler process (V21, Phase 1) |
| `server/.env` secrets hygiene | **FIX immediately** | `.gitignore` + rotation (V18, Phase 0) |
| MongoDB marketplace data | **KEEP read-only** | archive per ADR-014 (Phase 12) |

---

## 2. Phase 0 — Security remediation & repository stabilization *(first development milestone)*

**Objective:** close every P0/P1 security hole in the current code and make the repository buildable and CI-gated. **Feature development is forbidden until the exit gate passes.**

**Tasks**
1. Remove hardcoded admin e-mail bypass and the client-embedded e-mail (V1, V3).
2. Replace `socialAuth` client-trusted identity with server-side provider verification (V2); if OIDC cannot land immediately, disable social login (fail-closed).
3. Stop returning tokens/passwords in bodies; stop storing user documents (with password hash) in Redis (V4, V6, V7); activation = 32-byte single-use token (V5).
4. Lock the VdoCipher OTP endpoint behind authentication + ownership (V11); add auth to `get-video` (SEC-05).
5. Validate upload payloads; size/type limits (V12); rate limiting on auth/upload (V8); error envelope without message leak (V19).
6. Authenticated Socket.io + workspace rooms (V9).
7. **Finding A (P0):** server-side amount derivation, currency check, order validation, intent binding, idempotency (SEC-07).
8. **Finding B (P1):** single TTL source of truth; cookie = JWT exp; TTL on every Redis write; logout revocation (SEC-03).
9. **Finding C (P1):** remove `client/redux/features/videos/videosApi.ts:1`; enable boundary lint + CI check (TESTING §5).
10. Repo stabilization: fix `tsc --noEmit` in both trees (V13, V14), delete dead `server/app.ts` (V17), add `server/.gitignore` + rotate exposed credentials (V18), add CI (V15).
11. CORS origin from config (V23); start Google OAuth verification submission (external, weeks).

**Dependencies:** none (first phase); owner action needed for credential rotation and OAuth submission.
**DB changes:** none (MongoDB untouched). **API changes:** auth/OTP/error/order/socket behavior only — no new CreatorFlow endpoints.
**Frontend:** Finding C fix; remove client-embedded admin e-mail; adapt auth pages to generic errors.
**Security requirements:** items 1–9 above = SEC-01…SEC-03, SEC-05…SEC-08, SEC-10, SEC-11, SEC-16 P0/P1 remediation.
**Tests:** `SECURITY_AND_THREAT_MODEL.md` §4 (A-1…A-6, B-1…B-7, C-1…C-3) + V19/V8/V11 regression tests; first CI run.
**Acceptance criteria:** all §4 tests green; P0 checklist in `SECURITY_AND_THREAT_MODEL.md` §5 complete except design-risk areas.
**Exit gate (blocking):** (a) `tsc --noEmit` green both trees; (b) CI green on a clean checkout; (c) Findings A, B, C CLOSED with independent confirmation; (d) no P0 item open. **Only then does Phase 1 feature-adjacent work begin.**
**Rollback:** every fix is a code revert; no schema/data changes; rotation incidents handled by issuing new credentials.

## 3. Phase 1 — Backend modularization & contract foundation

**Objective:** move the flat Express code into the canonical module layout with zod contracts, idempotency middleware, and the test harness — behavior-preserving except where Phase 0 already changed security behavior.
**Tasks:** create `server/src/modules/*` + `platform/*` skeleton; migrate routes module-by-module; zod validation + error envelope wiring; `Idempotency-Key` middleware + `idempotency_record` (needs Phase 2 schema — until then, in-memory interim is **not** permitted; see DB changes); audit middleware; OpenAPI generation; move cron to `scheduler.ts` entrypoint (V21); queue scaffolding (BullMQ).
**Dependencies:** Phase 0 exit gate; Phase 2 schema for idempotency (interleave: layout first, idempotency middleware lands with Phase 2).
**DB changes:** Prisma bootstrap + first migration wave (Phase 2 content if sequenced after).
**API changes:** same routes, new conventions (envelope §1.2, validation §1.4); module boundaries per `SYSTEM_COMPONENT_ARCHITECTURE.md` §3.
**Frontend:** none required (base URL unchanged).
**Security requirements:** no behavior regressions; boundary rules enforced in lint (Finding C guard stays green).
**Tests:** L0–L3 harness live; contract tests CT-1/CT-9 for migrated routes.
**Acceptance criteria:** every existing route served from its module; `legacy/` contains only marketplace code.
**Exit gate:** layout matches the canonical tree; CI with L1–L3 mandatory.
**Rollback:** git revert per module migration; routes are mounted by path, so partial reverts are safe.

## 4. Phase 2 — PostgreSQL core schema (tenancy, sessions, idempotency, audit)

**Objective:** stand up the primary data store for CreatorFlow entities (`DATABASE_SCHEMA_AND_ERD.md` §2) — identity/tenancy wave: `user`, `workspace`, `workspace_member`, `workspace_invite`, `session`, `idempotency_record`, `audit_event`, `cleanup_task`, plus hand-written SQL (composite FKs, partial unique indexes, `audit_event` permissions).
**Dependencies:** ADR-006 ratified (Prisma) — architect-level, no owner spend; managed Postgres provisioned (`INFRASTRUCTURE_AND_DEPLOYMENT.md` §10 row 7).
**DB changes:** `DATABASE_SCHEMA_AND_ERD.md` §2.1 + §2.3.1 + `audit_event` (§2.9); migration contract documented (Prisma + `migration.sql` for triggers).
**API changes:** none public yet — repositories behind the module layer.
**Frontend:** none.
**Security requirements:** `session` stores token hashes only (SEC-03 target model); append-only `audit_event` (DB-7); composite FKs (ISO-1).
**Tests:** ISO-1, DB-7, DB-8 (idempotency), migration up/down rehearsal.
**Acceptance criteria:** DB-1, DB-7, DB-8 pass against ephemeral Postgres.
**Exit gate:** schema deployed to staging; restore rehearsal documented.
**Rollback:** down-migration tested; MongoDB remains the live store for marketplace (no cutover in this phase).

## 5. Phase 3 — Authentication & authorization rebuild

**Objective:** the target session model replacing JWT-in-everything: opaque session cookie, `session` table + namespaced Redis cache, server-side Google OIDC, Argon2id passwords, RBAC (`owner|admin|editor|viewer`), rate limits, CSRF double-submit, Socket.io handshake.
**Dependencies:** Phase 2 (session/idempotency tables); Google OIDC credentials.
**DB changes:** session rotation columns already in `DATABASE_SCHEMA_AND_ERD.md` §2.1; invite token hashing.
**API changes:** `/v1/auth/*`, `/v1/me` per `API_CONTRACT_AND_MODULES.md` §3.1; CSRF header required on mutations; websocket handshake.
**Frontend:** auth screens (route table 9–13), profile/sessions screen (14), cookie-only auth in RTK Query.
**Security requirements:** SEC-01…SEC-03, SEC-10, SEC-11 fully implemented (not just mitigated).
**Tests:** B-1…B-7 remain green under the new model; ISO-2/ISO-5; CT-1 role matrix; CT-15.
**Acceptance criteria:** no access/refresh tokens in bodies anywhere; logout kills replay; unauthenticated socket rejected.
**Exit gate:** old JWT middleware deleted; pentest-style checklist (SEC §5) re-run green.
**Rollback:** feature flag routes old auth path for one release; sessions are disposable.

## 6. Phase 4 — Video infrastructure (ADR-003 provider)

**Objective:** resumable direct-to-storage upload, provider processing, playback tokens, thumbnails, quota counters (`VIDEO_PROCESSING_ARCHITECTURE.md` §7).
**Dependencies:** provider account (lead time), object storage + CDN, ADR-003 owner sign-off (budget).
**DB changes:** `upload_session`, `video_asset`, `video_version` (+ `updated_at`), `video_processing_job`, `storage_quota`, `cleanup_task` subjects (`DATABASE_SCHEMA_AND_ERD.md` §2.3).
**API changes:** `API_CONTRACT_AND_MODULES.md` §3.5, §3.6 endpoints incl. playback token endpoint (replaces VdoCipher OTP — V11 closure), webhook receiver `/v1/webhooks/video/:provider`.
**Frontend:** screens 18 (Asset library), 19 (Uploads & processing), player inside 3 (Review).
**Security requirements:** SEC-08 (upload validation), SEC-09 (no URL ingestion), VP-4/VP-5.
**Tests:** VP-1…VP-6; ISO-1 for version children; CT-7 processing states.
**Acceptance criteria:** a 1 GB upload resumes across a mid-flight disconnect; `ready` version media columns immutable (DB-6).
**Exit gate:** two real providers proven against the port (primary + fallback adapter smoke).
**Rollback:** provider port allows adapter switch; stored sources remain in our bucket.

## 7. Phase 5 — Review workflow (versions, comments, revisions, approvals)

**Objective:** the product's core: immutable versions, submit/withdraw/under_review/approve/request-changes, timestamped comments, revisions, approvals with optimistic concurrency (`API_CONTRACT_AND_MODULES.md` §3.6–3.8, §5.2).
**Dependencies:** Phase 4 (`ready` versions), Phase 3 (roles), design system foundation (screens 1–5).
**DB changes:** `timestamp_comment`, `comment_reply`, `approval`, `revision`, `project`, `project_member` (`DATABASE_SCHEMA_AND_ERD.md` §2.2, §2.4).
**API changes:** `API_CONTRACT_AND_MODULES.md` §3.4, §3.6–3.8 incl. **withdraw endpoint**; `expectedUpdatedAt` guard.
**Frontend:** screens 1 (Dashboard), 2 (Project), 3 (Review), 4 (Comments), 5 (Version history).
**Security requirements:** comment write = editor+ (OD-03); approval = owner/admin; ISO-3 on all id lookups.
**Tests:** CT-5, CT-6, CT-7; journey steps 4–6; ISO-2 per new route.
**Acceptance criteria:** approved version cannot re-enter review (submit guard); approval row and state transition always atomic.
**Exit gate:** journey steps 1–6 green.
**Rollback:** new tables only; no legacy data involved.

## 8. Phase 6 — AI gateway core (transcription, captions, translation)

**Objective:** provider-independent AI layer with jobs/outputs/costs (`AI_PROVIDER_ARCHITECTURE.md`), transcript + caption editor.
**Dependencies:** AI credentials (lead time), Phase 4 audio extraction, ADR-009 (vendors/cap) — owner sign-off before spend.
**DB changes:** `ai_job`, `ai_output` (supersession + `schema_version`), `transcript`, `transcript_segment`, `caption_track` (`DATABASE_SCHEMA_AND_ERD.md` §2.5, §2.6).
**API changes:** `API_CONTRACT_AND_MODULES.md` §3.9, §3.10 endpoints; quota pre-check (429 `QUOTA_EXCEEDED`).
**Frontend:** screen 20 (Transcript & captions), AI panel of screen 6.
**Security requirements:** SEC-12 prompt-injection boundary (AI §7.1); OD-07 per-job token cap decided here; no provider SDK outside adapters (AI-1).
**Tests:** AI-1…AI-7, CT for supersession (DB-4), injection fixture in CI.
**Acceptance criteria:** invalid output never reaches `ai_output`; override creates a new row (AI-4).
**Exit gate:** one real STT provider + one LLM through the port; cost dashboard reads real numbers.
**Rollback:** provider adapters are config; jobs table is additive.

## 9. Phase 7 — AI content intelligence & Thumbnail Studio

**Objective:** titles/description/chapters/SEO/concepts, Thumbnail Studio (screen 7), SEO assistant (21), brand kits.
**Dependencies:** Phase 6 gateway; image generation stays optional (deferred v1.1 unless ADR-009 approves).
**DB changes:** `brand_kit`, `thumbnail_concept`, `thumbnail_asset` (`DATABASE_SCHEMA_AND_ERD.md` §2.6–2.7).
**API changes:** `API_CONTRACT_AND_MODULES.md` §3.11 + AI tasks; prompt registry versioning live.
**Frontend:** screens 6 (full), 7, 21.
**Security requirements:** SEC-12 continues; AI text rendering escaped (SEC-10).
**Tests:** structured-output schemas; override-rate telemetry; eval set on prompt changes (AI §6).
**Acceptance criteria:** all nine `ai_job.task` values implementable; cost caps enforced pre-enqueue (AI-7).
**Exit gate:** journey step 3 extended with a real AI run.
**Rollback:** prompt-version rollback (flip routing); outputs immutable.

## 10. Phase 8 — Publishing package assembly (pre-YouTube)

**Objective:** `publish_package` lifecycle (draft/validated/superseded), package editor UI, validation checks, calendar read model — everything publishable **before** Google verification lands.
**Dependencies:** Phase 5 approvals (DB trigger needs `approval`), Phase 4 assets.
**DB changes:** `publish_package` + `publish_package_requires_approved_version` trigger (`DATABASE_SCHEMA_AND_ERD.md` §2.8).
**API changes:** `API_CONTRACT_AND_MODULES.md` §3.13 package endpoints (editor prepares, owner validates — OD-04).
**Frontend:** screen 8 (Publishing Studio, package half), 26 (calendar read side).
**Security requirements:** SEC-15 gates 1–2 (roles + trigger); editor cannot validate (CT-1).
**Tests:** CT-4 variant for packages (DB-5), role matrix, DB-2 for the package trigger.
**Acceptance criteria:** a validated package exists end-to-end with no YouTube code involved.
**Exit gate:** journey steps 7 (minus enqueue) green.
**Rollback:** tables/triggers are additive; UI behind a flag.

## 11. Phase 9 — YouTube connections & publish execution

**Objective:** OAuth connections, token vault, quota ledger, `publish.upload`/`publish.reconcile` queues, job states incl. `outcome_unknown` reconciliation (`YOUTUBE_PUBLISHING_ARCHITECTURE.md`).
**Dependencies:** **Google OAuth consent verification complete** (started Phase 0 — the long pole), Phase 8 packages, Phase 5 approvals, ADR-010 + OD-06 resolved.
**DB changes:** `youtube_connection`, `youtube_quota_ledger`, `publish_job` + `publish_job_requires_approved_version` trigger, `storage_quota.publish_quota_units_used`.
**API changes:** `API_CONTRACT_AND_MODULES.md` §3.12 connections, §3.13 job endpoints incl. retry; `GET .../youtube/quota` reading the resolved data source.
**Frontend:** screen 25 (YouTube connections), 8 (job half), 26 (calendar complete).
**Security requirements:** SEC-13 (token vault), SEC-14 (idempotency/reconciliation), SEC-15 (DB trigger + roles).
**Tests:** YT-1…YT-8, CT-11, journey step 8.
**Acceptance criteria:** one real video published from an approved version; duplicate enqueue proven harmless; `outcome_unknown` reconciles without duplicates.
**Exit gate:** publish SLO data for 1 week on staging; dead-letter flow exercised.
**Rollback:** disable enqueue flag (packages keep working); connections revocable at Google.

## 12. Phase 10 — Billing & usage (Stripe for CreatorFlow)

**Objective:** replace marketplace orders with workspace plans: `subscription`, `billing_webhook_event`, usage metering wired to `storage_quota`, seat limits; Finding A's trusted pricing carries over to checkout.
**Dependencies:** Stripe production account (ADR-011), Phase 2/9 counters.
**DB changes:** `subscription`, `billing_webhook_event`, `usage_record` (`DATABASE_SCHEMA_AND_ERD.md` §2.8–2.9).
**API changes:** `API_CONTRACT_AND_MODULES.md` §3.14 billing + webhook (idempotent by event id); plan gates on quotas.
**Frontend:** screens 23 (Usage), 24 (Billing).
**Security requirements:** SEC-07 regression suite re-run against subscription flows; webhook signature verification; no amount from client.
**Tests:** A-series extended to checkout; CT for webhook idempotency; quota enforcement (429 paths).
**Acceptance criteria:** webhook replay → one state change; plan downgrade enforces limits.
**Exit gate:** test-mode full cycle (subscribe → use → limit → invoice) green.
**Rollback:** webhook handler is the only writer — disable via flag; data retained.

## 13. Phase 11 — Hardening & defence in depth

**Objective:** RLS enablement decision executed (ADR-012), load tests, observability SLOs, DR rehearsal, security baseline scan, accessibility audit.
**Dependencies:** all feature phases; ADR-012 owner decision.
**DB changes:** Postgres RLS policies (if ratified) + `SET app.workspace_id` contract; indexes from `DATABASE_SCHEMA_AND_ERD.md` §6 perf notes.
**API changes:** none intended; perf fixes only.
**Frontend:** a11y fixes from audit; perf pass.
**Security requirements:** full SEC-01…SEC-16 re-audit; ZAP baseline; secret scan history check.
**Tests:** `TESTING_AND_QUALITY_STRATEGY.md` §7 non-functional (load, chaos-lite, restore rehearsal); ISO suite under RLS.
**Acceptance criteria:** SLOs met at 2× peak; quarterly restore rehearsal documented and executed once.
**Exit gate:** independent security review sign-off.
**Rollback:** RLS toggled by migration revert (app-layer isolation remains).

## 14. Phase 12 — Legacy marketplace disposition & launch

**Objective:** execute ADR-014 (recommended: archive read-only), freeze MongoDB schema, launch CreatorFlow GA.
**Dependencies:** ADR-014 owner approval, all phase gates, marketing/legal pages.
**DB changes:** none to MongoDB; read-only flags enforced at the routing layer.
**API changes:** legacy routes served from `legacy/` unchanged except Phase-0 fixes; eventual removal scheduled.
**Frontend:** legacy storefront behind the archive flag; public screens (`(public)` group) finalized.
**Security requirements:** legacy routes cannot create CreatorFlow-side effects; admin surface audited.
**Tests:** full suite + journey; legacy smoke tests.
**Acceptance criteria:** legacy marketplace serves read-only; no write path from old clients.
**Exit gate:** GA checklist (SEC §5 + roadmap gates) all green.
**Rollback:** archive flag off restores legacy writes (if business requires); GA staged by percentage.

---

## 15. Cross-phase rules

1. **Gate discipline:** Phase 0 exit (P0 security + buildability) precedes everything; each later phase's exit criteria are evidence-based (tests listed), not date-based.
2. **External lead times start in Phase 0** regardless of coding order (Google verification, provider accounts, email auth, Stripe).
3. **Findings A/B/C stay OPEN** in the register until their §4 tests pass independently — writing this roadmap does not close them.
4. **Open decisions** (D1–D10, ADR-004…016, OD-05…08) block only the phases that consume them; they are tracked in `ARCHITECTURE_DECISION_RECORDS.md`, not silently resolved here.
5. Every phase writes `audit_event` for its new privileged transitions from day one.

## 16. Risk register (top items)

| Risk | Mitigation |
|---|---|
| Google verification slips past Phase 9 | start Phase 0; Phase 8 delivers package value without YouTube |
| Provider pricing (Mux/D2) unaffordable | port keeps S3+FFmpeg escape hatch (ADR-003) |
| Postgres cutover defects | CreatorFlow data is new — no legacy rows migrate (Mongo stays read-only) |
| Scope creep into "dashboard with AI buttons" | journey steps 4–8 are release-blocking (TESTING §6) |
| Security regressions after Phase 0 | SEC regression suites are merge-blocking (TESTING §8) |
