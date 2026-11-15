# CreatorFlow — Architecture Decision Records

Status: **living register**. Recovered records: **ADR-001, ADR-002, ADR-003, ADR-014** (content recovered from existing references in the six predecessor documents — nothing invented). New records **ADR-004…ADR-013, ADR-015, ADR-016** are **explicitly OPEN** — a recommendation is recorded where the evidence supports one, but no recommendation is presented as a completed decision. **OD-01…OD-08** (the eight additional decisions surfaced by the 2026-11-03 validation) live in **§5**; four are RESOLVED by the remediation sprint, four remain OPEN.

**Conventions:** Status = `Accepted` | `Proposed` | `Open`. "Owner approval: Yes" means the product owner must sign off before the decision is acted upon (spend, vendor, compliance, or product behavior). "Operational cost" = recurring run cost introduced by the decision. "Migration impact" = what changes if the decision is later reversed.

---

## 1. Register summary

| ADR | Subject | Status | Owner approval |
|---|---|---|---|
| 001 | Application style: modular monolith, three processes | **Accepted** | No |
| 002 | PostgreSQL as primary source of truth | **Accepted** | No |
| 003 | Video provider (Mux primary, port for swap) | **Open** (D2) | **Yes** — budget |
| 004 | Authentication strategy (self-hosted sessions vs managed auth) | **Open** (D1) | **Yes** |
| 005 | Background processing: BullMQ on Redis | **Open** | No |
| 006 | ORM: Prisma vs Drizzle | **Open** (D4) | **Yes** |
| 007 | API surface: keep Express vs Next.js route handlers | **Open** (D6) | **Yes** |
| 008 | Repository & deploy layout (`client/`+`server/` vs `apps/*`) | **Open** (D7) | **Yes** |
| 009 | AI vendors & monthly spend cap | **Open** (D3) | **Yes** |
| 010 | Google Cloud project & YouTube quota budget | **Open** (D8) | **Yes** |
| 011 | Stripe scope for CreatorFlow billing | **Open** (D9) | **Yes** |
| 012 | Tenant isolation: app-level + FKs vs Postgres RLS | **Open** | **Yes** |
| 013 | Data residency / compliance requirements | **Open** (D10) | **Yes** |
| 014 | Legacy marketplace disposition | **Proposed** (recommendation: archive read-only) | **Yes** |
| 015 | AI gateway shape: provider-independent ports | **Open** | No |
| 016 | Realtime transport & room model (Socket.io retained) | **Open** | No |

Mapping D1–D10 (`CREATORFLOW_MASTER_ARCHITECTURE.md` §4) → ADR: D1→004, D2→003, D3→009, D4→006, D5→014, D6→007, D7→008, D8→010, D9→011, D10→013.

---

## 2. ADR-001 — ADR-008

### ADR-001 — Modular monolith with three backend processes
- **Context (recovered):** `SYSTEM_COMPONENT_ARCHITECTURE.md` §1; `CREATORFLOW_MASTER_ARCHITECTURE.md` §2.1 row "Application". Video/AI/publish jobs are long-running; the existing Express domain layer is reusable; team size does not justify distribution.
- **Alternatives:** (a) Next.js API routes; (b) separate Next.js + Express as today; (c) modular monolith + worker; (d) microservices.
- **Advantages:** one codebase/one deploy pipeline; jobs run in a real worker; module boundaries preserve an extraction path; reuses existing Express code.
- **Disadvantages:** shared failure domain; scaling is coarse (worker scales separately, api separately); discipline required to keep module imports clean.
- **Operational cost:** 3 service types to run (api, worker, scheduler) — one container image, three commands; lowest of the alternatives.
- **Migration impact:** none — it is the container every other decision fits inside; reversing it (microservices) later is possible because modules expose `index.ts` public surfaces only.
- **Recommendation:** (c) — recorded as the blueprint's foundation.
- **Status: Accepted. Owner approval: not required** (architectural baseline; not in the D1–D10 approval table).

### ADR-002 — PostgreSQL as primary source of truth
- **Context (recovered):** `CREATORFLOW_MASTER_ARCHITECTURE.md` §2.1 row "Database"; `DATABASE_SCHEMA_AND_ERD.md` status line. Versions, approvals, comments, audit and idempotency need referential integrity, immutability triggers and multi-row transactions that MongoDB does not give here.
- **Alternatives:** (a) PostgreSQL (+ Prisma/Drizzle — ORM is separate, ADR-006); (b) MongoDB + Mongoose (status quo); (c) staged migration as transition with Postgres as destination.
- **Advantages:** composite FKs enforce tenant isolation in the DB (ISO-1); constraint triggers enforce the approval invariant for *any* writer; partial unique indexes give one-approval-per-version etc.; transactions make approval+state atomic.
- **Disadvantages:** two datastores during transition (legacy Mongo read-only); team must learn hand-written SQL migrations for triggers/RLS.
- **Operational cost:** one managed Postgres instance per environment + backups/rehearsals (§INFRASTRUCTURE_AND_DEPLOYMENT.md §5); Mongo retained read-only until ADR-014 executes.
- **Migration impact:** reversing to Mongo would forfeit the DB-level guarantees the threat model depends on — not recommended; the legacy marketplace is unaffected (no rows migrate).
- **Recommendation:** PostgreSQL; keep Mongo read-only for legacy (ADR-014).
- **Status: Accepted. Owner approval: not required** (not in the D1–D10 table; provisioning cost is standard infrastructure spend already assumed in the roadmap).

### ADR-003 — Video provider: Mux primary behind a `VideoProvider` port
- **Context (recovered):** `VIDEO_PROCESSING_ARCHITECTURE.md` §2, §9; `CREATORFLOW_MASTER_ARCHITECTURE.md` D2. No pipeline exists today (V12/V16); the target needs upload, transcode, HLS, thumbnails, duration, playback security.
- **Alternatives:** (a) Mux; (b) Cloudflare Stream; (c) S3-compatible + FFmpeg workers + CDN.
- **Advantages of recommendation:** managed transcode/HLS removes the largest self-built surface; signed playback; webhook model fits the job state machine; port keeps (b)/(c) as swaps.
- **Disadvantages:** per-minute pricing (assumption — verify); moderate lock-in (export = source + renditions); account approval is a lead time.
- **Operational cost:** per-minute delivered + storage (vendor pricing **assumption**, verify before Phase 4 spend); no FFmpeg fleet to run.
- **Migration impact:** adapter swap in `modules/assets` + re-point delivery; stored sources stay in our object storage, so exposure is bounded.
- **Recommendation:** Mux primary, Cloudflare Stream fallback adapter, S3+FFmpeg escape hatch — *subject to budget sign-off*.
- **Status: Open. Owner approval: REQUIRED (budget).**

### ADR-004 — Authentication strategy (D1)
- **Context:** current auth is insecure by verification (V1–V7, SEC-01…SEC-03) and must be rebuilt regardless; the open question is *what* to build/buy.
- **Alternatives:** (a) self-hosted opaque sessions in the API (recommended in `CREATORFLOW_MASTER_ARCHITECTURE.md` §2.1); (b) managed auth (Clerk/Auth0-class); (c) keep NextAuth shim.
- **Advantages:** (a) full control, no vendor cost, fits the Express API directly, session table already designed (`DATABASE_SCHEMA_AND_ERD.md` §2.1); (b) fastest to audit-grade features, offloads OTP/MFA.
- **Disadvantages:** (a) we own MFA/rate-limit/lockout work; (b) vendor cost, lock-in, and a second identity store to reconcile with workspaces/billing.
- **Operational cost:** (a) engineering time only; (b) per-MAU vendor fee (pricing assumption — quote needed).
- **Migration impact:** (a)→(b) later = identity export + session cutover; doable because passwords are hashed and e-mails are portable, but disruptive — decide before Phase 3.
- **Recommendation:** (a) self-hosted sessions; revisit (b) only if schedule pressure grows.
- **Status: Open. Owner approval: REQUIRED.**

### ADR-005 — Background processing: BullMQ on Redis
- **Context:** `CREATORFLOW_MASTER_ARCHITECTURE.md` §2.1 row "Background processing"; the repo already ships `ioredis` (`server/package.json:32`, used at `server/utils/redis.ts:1`) and Upstash (`:23`, currently unused).
- **Alternatives:** (a) BullMQ + Redis; (b) managed queue (SQS/Cloud Tasks-class); (c) cron-only.
- **Advantages:** reuses the existing Redis; job state lives in Postgres rows (source of truth) so queue loss ≠ job loss; one operational dependency.
- **Disadvantages:** Redis becomes load-bearing for delivery (mitigated: rows are authoritative); no per-queue IAM granularity like a managed queue.
- **Operational cost:** negligible incremental (same Redis instance); concurrency limits sized per queue.
- **Migration impact:** queue behind a thin producer API; swapping to (b) later touches producers/consumers only.
- **Recommendation:** (a).
- **Status: Open** (ratify at Phase 1 start). **Owner approval: not required.**

### ADR-006 — ORM: Prisma vs Drizzle (D4)
- **Context:** `DATABASE_SCHEMA_AND_ERD.md` §7; schema includes constraints Prisma cannot express (triggers, partial indexes, RLS) which live in hand-written SQL either way.
- **Alternatives:** (a) Prisma; (b) Drizzle.
- **Advantages:** (a) mature migrations workflow, excellent type generation, team familiarity assumed, first-class docs for composite FKs; (b) lighter, SQL-near, faster cold starts.
- **Disadvantages:** (a) heavier client, schema DSL hides SQL we need to review anyway; (b) smaller ecosystem for our patterns.
- **Operational cost:** none material (dev-time tooling).
- **Migration impact:** ORM swap rewrites repositories only — `repository.ts` is the single Prisma touchpoint (`SYSTEM_COMPONENT_ARCHITECTURE.md` §3), so blast radius is contained but total.
- **Recommendation:** Prisma.
- **Status: Open** (blocks Phase 2 file workflow). **Owner approval: REQUIRED (listed as D4).**

### ADR-007 — API surface: keep Express vs move into Next.js route handlers (D6)
- **Context:** `CREATORFLOW_MASTER_ARCHITECTURE.md` §2.1/D6; current API is Express (`server/server.ts`), frontend is Next.js.
- **Alternatives:** (a) keep Express; (b) move to Next.js route handlers.
- **Advantages:** (a) reuses the domain layer, natural home for Socket.io and long-running request flows, independent scaling; (b) one deployable, shared runtime.
- **Disadvantages:** (b) breaks Socket.io hosting model, couples job-adjacent HTTP code to the web runtime, and buys nothing for a worker-based product.
- **Operational cost:** (a) one extra service (already counted in ADR-001); (b) none extra but constrains hosting.
- **Migration impact:** (a)→(b) would be a full API rewrite — high risk, low reward; not recommended.
- **Recommendation:** (a) keep Express.
- **Status: Open. Owner approval: REQUIRED (listed as D6).**

### ADR-008 — Repository & deploy layout (D7)
- **Context:** verified layout `client/` + `server/` siblings; `CREATORFLOW_MASTER_ARCHITECTURE.md` D7; roadmap adds `worker`/`scheduler` entrypoints inside `server/`.
- **Alternatives:** (a) keep `client/` + `server/`; (b) monorepo `apps/*` with `shared/` package.
- **Advantages:** (a) zero churn now, matches all existing paths/docs; (b) formal package boundaries, single lockfile, cleaner CI matrix.
- **Disadvantages:** (a) `shared/` import path must be configured by tsconfig path rather than package; (b) migration cost touches every import and CI script.
- **Operational cost:** (a) none; (b) one-time migration effort + workspace tooling maintenance.
- **Migration impact:** (a)→(b) is mechanical but wide; import-boundary lint (TESTING §5) works in either layout.
- **Recommendation:** (a) keep current layout, add `shared/` as a path-mapped directory; revisit (b) only if a third app appears.
- **Status: Open. Owner approval: REQUIRED (listed as D7).**

---

## 3. ADR-009 — ADR-016

### ADR-009 — AI vendors & monthly spend cap (D3)
- **Context:** `AI_PROVIDER_ARCHITECTURE.md` §2.1, §10; no AI code exists (V16); adapters are vendor-agnostic by design.
- **Alternatives:** Anthropic Claude primary + OpenAI fallback with Deepgram/Whisper STT (recommended); all-OpenAI single vendor; Google-only; self-hosted (excluded — §9 non-goal).
- **Advantages:** recommended split gives best-in-class text + independent STT; port means any swap is config.
- **Disadvantages:** two vendor relationships to secure; cost forecasting needs both price sheets.
- **Operational cost:** per-token + per-minute STT, **monthly cap required before Phase 6** (spend ceiling = owner-defined; pricing assumptions to verify).
- **Migration impact:** none — adapters isolate vendors (AI-1 CI check enforces it).
- **Recommendation:** Claude primary / OpenAI fallback; Deepgram or Whisper for STT; approve cap before Phase 6.
- **Status: Open. Owner approval: REQUIRED (vendors + cap).**

### ADR-010 — Google Cloud project & YouTube quota budget (D8)
- **Context:** `CREATORFLOW_MASTER_ARCHITECTURE.md` §5.1/D8; consent verification lead time gates Phase 9; quota scope uncertainty = OD-06.
- **Alternatives:** (a) new project per environment (recommended); (b) one shared project.
- **Advantages:** (a) clean quota accounting per env, independent verification, no staging traffic consuming production quota.
- **Disadvantages:** (a) N consent screens/verifications to maintain.
- **Operational cost:** Google Cloud project fees (typically free tier + API costs — *assumption, verify*); quota headroom may require paid allowance (quote needed).
- **Migration impact:** splitting a shared project later re-keys `youtube_quota_ledger` (schema tolerates it — `quota_scope_id`).
- **Recommendation:** new project per environment; submit verification in Phase 0.
- **Status: Open. Owner approval: REQUIRED.**

### ADR-011 — Stripe scope for CreatorFlow billing (D9)
- **Context:** `CREATORFLOW_MASTER_ARCHITECTURE.md` D9; existing Stripe integration is marketplace orders with the P0 pricing flaw (SEC-07).
- **Alternatives:** (a) per-seat/workspace subscription plans (recommended start); (b) usage-based billing from day one; (c) hybrid with metered overage.
- **Advantages:** (a) simple to reason about, matches quota model, easy invoicing; (b) aligns cost with consumption but needs metering trust (built in Phases 6–10 regardless).
- **Disadvantages:** (a) heavy users underpay vs cost; (b) billing disputes and pricing complexity earlier.
- **Operational cost:** Stripe fees (standard, *assumption*); metering already recorded via `usage_record` even while unbilled.
- **Migration impact:** plans → usage is additive (metering exists from Phase 10 either way); price model changes are plan-row changes, not schema changes.
- **Recommendation:** start with seat/workspace plans; record usage without billing it until Phase 10+ evidence.
- **Status: Open. Owner approval: REQUIRED.**

### ADR-012 — Tenant isolation depth: application + composite FKs vs Postgres RLS
- **Context:** `DATABASE_SCHEMA_AND_ERD.md` §1.1, §7; `API_CONTRACT_AND_MODULES.md` §5.5. Two layers already designed (app filter + composite FKs); the open question is whether to add **row-level security** as a third.
- **Alternatives:** (a) app scoping + composite FKs now, RLS later (recommended); (b) RLS from day one; (c) app-only (rejected — insufficient alone).
- **Advantages:** (a) fastest to ship, DB property still enforced by FKs, RLS added as hardening in Phase 11; (b) strongest guarantee — even a buggy repository cannot read across tenants.
- **Disadvantages:** (a) a raw-SQL writer can still *read* wrong rows until RLS lands; (b) RLS changes the data-access contract for every module (connection `workspace_id` context, migration of every query, testing overhead).
- **Operational cost:** (a) none extra; (b) per-query context management + slower joins + specialist knowledge on call.
- **Migration impact:** (a)→(b) is additive (enable policies per table in Phase 11) — the schema already carries `workspace_id` everywhere, so no restructure.
- **Recommendation:** (a) now, RLS in Phase 11 as defence in depth — **explicitly not decided**: the operational cost is an owner call.
- **Status: Open. Owner approval: REQUIRED.**

### ADR-013 — Data residency / compliance requirements (D10)
- **Context:** `CREATORFLOW_MASTER_ARCHITECTURE.md` D10 — "none stated".
- **Alternatives:** (a) assume none for v1 (recommended); (b) EU-only data residency now; (c) full SOC2/ISO programme from day one.
- **Advantages:** (a) no premature architecture constraints; (b)/(c) unlock enterprise buyers later.
- **Disadvantages:** (a) retrofitting residency later means region selection, replication and vendor choices redone; compliance evidence absent for sales.
- **Operational cost:** (a) zero; (b) multi-region premium; (c) audit programme cost (quote needed).
- **Migration impact:** (a)→(b) is a data-movement project — the single most expensive late decision; low likelihood but high impact.
- **Recommendation:** assume none unless the owner states otherwise; revisit at first enterprise prospect.
- **Status: Open. Owner approval: REQUIRED (confirm "none").**

### ADR-014 — Legacy marketplace disposition (D5)
- **Context (recovered):** `CREATORFLOW_MASTER_ARCHITECTURE.md` D5 — options "Archive (read-only) vs isolate vs remove"; recommendation recorded: **archive read-only until CreatorFlow launches**; `DATABASE_SCHEMA_AND_ERD.md` §4 and the roadmap keep MongoDB untouched (`MIGRATION_AND_IMPLEMENTATION_ROADMAP.md` Phase 12).
- **Alternatives:** (a) archive read-only (recommended); (b) isolate as a separate deployable; (c) remove entirely.
- **Advantages:** (a) zero migration risk, revenue/history preserved, no maintenance spend; (b) clean separation but duplicate ops; (c) deletes legacy burden but destroys data/revenue abruptly.
- **Disadvantages:** (a) old bugs stay reachable read-only; must ensure write paths are actually disabled (roadmap Phase 12 enforces this); (b) extra service to run for no product gain.
- **Operational cost:** (a) storage + read-serving only; (b) a second deployment; (c) none after cutover.
- **Migration impact:** (a)→(c) later is a deletion decision with data-export step; reversible only until deleted.
- **Recommendation:** (a) archive read-only; execute in Phase 12.
- **Status: Proposed** (recommendation recovered, **not approved**). **Owner approval: REQUIRED.**

### ADR-015 — AI gateway shape: provider-independent capability ports
- **Context:** `CREATORFLOW_MASTER_ARCHITECTURE.md` §2.1 row "AI"; `AI_PROVIDER_ARCHITECTURE.md` §2 — no AI code exists, so the port can be built right the first time.
- **Alternatives:** (a) provider-independent ports with per-capability adapters (recommended); (b) single provider hard-wired.
- **Advantages:** (a) no vendor lock-in, swaps are config, uniform validation/cost accounting across providers, testable with a fake adapter in CI; (b) less upfront code.
- **Disadvantages:** (a) interface design cost up front; (b) lock-in — a price/availability change becomes a rewrite.
- **Operational cost:** none extra (in-process module; no separate service).
- **Migration impact:** (b)→(a) later is a retrofit across every call site — cheapest to start with (a).
- **Recommendation:** (a). **Status: Open** (ratify at Phase 6 start). **Owner approval: not required.**

### ADR-016 — Realtime transport & room model (Socket.io retained, authenticated rooms)
- **Context:** `CREATORFLOW_MASTER_ARCHITECTURE.md` §2.1 row "Realtime"; current implementation broadcasts everything unauthenticated (V9, `server/socketServer.ts:9-14`) and must be replaced regardless of choice.
- **Alternatives:** (a) Socket.io retained with auth handshake + canonical rooms (recommended — existing dependency); (b) SSE; (c) polling.
- **Advantages:** (a) bidirectional, room targeting, Redis adapter for horizontal scale, existing client dep; (b) simpler proxy story but unidirectional; (c) simplest but latency/load poor for review collaboration.
- **Disadvantages:** (a) connection state to manage, auth handshake to secure (SEC-11); (b) reconnect semantics hand-rolled; (c) unacceptable UX for live review.
- **Operational cost:** (a) socket connection capacity on api replicas (caps: 10/user, 100/workspace); (b)/(c) higher request volume instead.
- **Migration impact:** events are invalidation-only triggers (`API_CONTRACT_AND_MODULES.md` §3.15), so changing transport touches the client hook, not business logic.
- **Recommendation:** (a) Socket.io with the canonical `ws:{workspaceId}…` room names.
- **Status: Open** (ratify at Phase 3 start). **Owner approval: not required.**

---

## 4. Traceability

| Decision | Consumed by phase | Blocking? |
|---|---|---|
| ADR-001, 002 | 1–2 | already Accepted — baseline |
| ADR-004, 016 | 3 | yes — auth rebuild |
| ADR-003 | 4 | yes — provider spend |
| ADR-006 | 2 | yes — migration workflow |
| ADR-009, 015 | 6–7 | yes — vendor/cap |
| ADR-010, 014 (exec) | 9 / 12 | yes — Google verification & legacy call |
| ADR-011 | 10 | yes — pricing model |
| ADR-012 | 11 | yes — RLS go/no-go |
| ADR-007, 008 | 1 | yes — layout sign-off |
| ADR-013 | 11 | confirm "none" before launch |

An Open ADR blocks only its consuming phase; nothing in Phase 0 depends on an unratified ADR (Phase 0 is security + buildability).

---

## 5. Additional open decisions (OD-01 … OD-08)

Recovered from the 2026-11-03 validation report as referenced by the existing documents. **Four RESOLVED by this remediation sprint, four remain OPEN.**

| ID | Decision | Context | Options | Recommendation | Status | Owner approval |
|---|---|---|---|---|---|---|
| **OD-01** | `project.review_state` denormalisation | Roll-up column on `project` vs deriving from latest version (`DATABASE_SCHEMA_AND_ERD.md` §2.2, §7) | (a) keep denormalised with single writer + nightly reconciliation; (b) derive on read via lateral join | (a) — list reads stay O(1); nightly reconciler catches drift | **RESOLVED** (sprint) | No |
| **OD-02** | `approval.decision='rejected'` value | Earlier enum had `approved\|rejected` but no review-state transition consumes `rejected` (`DATABASE_SCHEMA_AND_ERD.md` §2.4, `API_CONTRACT_AND_MODULES.md` §3.8) | (a) v1 value set = `approved\|changes_requested` only; (b) add `rejected` + its own transition | (a) — no unmappable values; a future reject-without-changes is a later change, not an implied one | **RESOLVED for v1** (sprint) | No (revisit if requested) |
| **OD-03** | May `viewer` comment? | Earlier draft granted then revoked comment rights to viewers (`API_CONTRACT_AND_MODULES.md` §1.7, §3.7) | (a) viewer = read-only, commenting needs `editor`+; (b) separate `commenter` flag/role | (a) for v1 — one rule, one check (`requireRole('editor')`); (b) deferred to a later version | **RESOLVED for v1** (sprint) | No (deferred role = product call later) |
| **OD-04** | Editor permissions for publish-package preparation | Preparing vs executing a publish are different risks (`API_CONTRACT_AND_MODULES.md` §1.7, §3.13; `DATABASE_SCHEMA_AND_ERD.md` §2.8) | (a) editor prepares/edits `draft` only; validate + enqueue = owner/admin; (b) editor may validate; (c) editor may enqueue | (a) — least privilege at the highest-risk write, enforced by role guards **and** the package/job split | **RESOLVED** (sprint) | No (ratified with schema) |
| **OD-05** | Source-file download by editors in v1 | `VIDEO_PROCESSING_ARCHITECTURE.md` §9 | (a) allowed as workspace setting, audited; (b) admin-only; (c) not in v1 | (a) — editors need masters for re-cutting; audited download balances risk | **OPEN** | Yes (product behavior) |
| **OD-06** | YouTube quota scope: Google Cloud project vs channel | `youtube_quota_ledger` assumes per-project quota (`DATABASE_SCHEMA_AND_ERD.md` §2.8) | (a) per project (assumed); (b) per channel | verify against current Google docs before Phase 9; ledger key adapts either way | **OPEN** | No (verification task; blocks Phase 9 design freeze) |
| **OD-07** | Per-job AI token cap | Monthly workspace cap alone lets one runaway job consume the month (`AI_PROVIDER_ARCHITECTURE.md` §10) | (a) set a per-job cap (candidate: 200 000 tokens); (b) monthly only | (a) — bounds injected-instruction cost (SEC-12) | **OPEN** | Yes (spend behavior) |
| **OD-08** | Retain raw AI provider responses for debugging? | Invalid-output debugging is weak without them (`AI_PROVIDER_ARCHITECTURE.md` §10) | (a) retain 14 days, redacted, separate table, strict access; (b) do not retain | (a) — keeps the debugging story without long-term PII exposure | **OPEN** | Yes (data retention policy) |

**Rule:** no OPEN item above may be presented as decided in any document; the consuming phase does not start until its row flips to RESOLVED/Approved with the approver recorded here.
