# CreatorFlow — Security & Threat Model

Status: **Proposed remediation plan; findings register is authoritative.** Evidence = `CREATORFLOW_MASTER_ARCHITECTURE.md` §0.1 (V1–V27, re-verified against source with file:line citations) and Findings A/B/C (§0.2). No application code was changed to produce this document.

**Register key:** every `SEC-nn` below is a threat area. Findings A (P0), B (P1) and C (P1) are mapped to SEC-07, SEC-03 and `TESTING_AND_QUALITY_STRATEGY.md` §5 respectively.

---

## 1. How to read this document

| Field | Meaning |
|---|---|
| **Severity** | P0 = exploit causes financial loss, full account takeover or auth bypass now; P1 = high-likelihood compromise or boundary violation; P2 = defence-in-depth gap |
| **Status** | **EXPLOITABLE NOW** = verified in current source; **DESIGN RISK** = the feature does not exist yet (V16 greenfield); the control below is required before that feature ships |
| **Regression test** | The test that must exist and pass; located per `TESTING_AND_QUALITY_STRATEGY.md` |
| **Acceptance criteria** | The check that closes the area. An area is OPEN until its acceptance criteria pass **independently of the author of the fix** |

**Closure rule (applies to every SEC area and to Findings A/B/C):** a proposed remediation is not a closed finding. Status flips to CLOSED only when (1) the source is changed, (2) the listed regression test passes in CI, (3) an independent reviewer confirms the fix. Findings A, B and C are **OPEN** today.

---

## 2. Priority remediation before any feature development

P0 gate (from `CREATORFLOW_MASTER_ARCHITECTURE.md` §6, expanded with SEC ids):

| # | Item | Evidence | SEC |
|---|---|---|---|
| 1 | Remove hardcoded admin e-mail bypass | `server/middleware/auth.ts:47-50`, `server/controllers/user.controller.ts:264-278`, `client/app/components/Navbar/Navbar.tsx:49-71` | SEC-02 |
| 2 | Stop trusting client identity in `socialAuth` — server-side OIDC verification | `server/controllers/user.controller.ts:260-285` | SEC-01 |
| 3 | Stop returning tokens/password material in bodies and Redis sessions | `server/utils/jwt.ts:47-52`, `:36`, `server/controllers/user.controller.ts:140`, `:244-246` | SEC-03 |
| 4 | Fix activation flow: 32-byte random single-use tokens, no password inside tokens | `server/controllers/user.controller.ts:41-66`, `:82-93` | SEC-01 |
| 5 | Authenticate + scope Socket.io; lock down VdoCipher OTP; validate upload payloads | `server/socketServer.ts:9-14`, `server/routes/video.route.ts:31`, `server/controllers/video.controller.ts:17-36` | SEC-11, SEC-05, SEC-08 |
| 6 | Fix broken TypeScript builds (server + client) and add CI (`tsc --noEmit` + lint + tests) | `npx tsc --noEmit` fails in both trees (V13, V14); no CI (V15) | all |
| 7 | Rate limiting on auth/upload endpoints; stop leaking internal error messages | no limiter in `server/package.json` (V8); `server/middleware/error.ts:33-36` (V19) | SEC-01, SEC-16 |
| 8 | Secret hygiene: `server/.gitignore`, rotate exposed credentials, never print env values | `server/.env` exists, no `server/.gitignore` (V18) | SEC-16 |
| 9 | **Finding A (P0):** derive PaymentIntent amount from server-side `video.price`; reconcile paid amount and currency | `server/controllers/order.controller.ts:137`, `:25-31`, `server/models/video.model.ts:37` | **SEC-07** |
| 10 | **Finding B (P1):** one TTL source of truth; cookie `maxAge` = JWT `exp`; bounded refresh; revoke on logout | `server/models/user.model.ts:97-106`, `server/utils/jwt.ts:14-26` | **SEC-03** |
| 11 | **Finding C (P1):** remove the client→server import; enforce the boundary in lint + CI | `client/redux/features/videos/videosApi.ts:1` | `TESTING_AND_QUALITY_STRATEGY.md` §5 |

Items 9–11 are **OPEN**. See §4.

---

## 3. Threat register (16 areas)

### SEC-01 — Account takeover
- **Severity:** P0. **Status: EXPLOITABLE NOW.**
- **Evidence:** `socialAuth` accepts `{email,name,avatar}` from the request body with no provider verification (`server/controllers/user.controller.ts:260-285`); registration returns `activeToken` and the signed activation JWT payload contains the user object **including the plaintext password** (`user.controller.ts:41-66`, `:82-93`, payload built at `:85-86`); activation code is 4-digit, 1000–9999, 5-minute window (`:83`, `:89`); no rate limiting anywhere (V8).
- **Attack scenario:** attacker POSTs `/social-auth` with any victim e-mail → is logged in as the victim. Or: brute-force the 4-digit activation code (10 000 possibilities, no limiter) to activate an attacker-registered account under a victim's e-mail, or trigger password-reset against it.
- **Impact:** full account takeover of any user, including owners; purchased videos, workspaces and (future) connected YouTube channels inherit the compromise.
- **Remediation:** server-side OIDC (Google) verification of the identity token — never accept client-supplied identity; activation = 32 random bytes, single-use hash, stored expiry; activation JWT payload = `{userId, codeHash}` only, never user fields; generic auth error messages; rate limits 10/min/IP + 5/15min per account (`API_CONTRACT_AND_MODULES.md` §1.6).
- **Regression test:** `SEC-01.t` — social auth with a fabricated body identity and no valid provider token → 401; activation code guess #11 → 429.
- **Acceptance criteria:** no endpoint accepts an identity claim that was not verified by the provider; no token minted by the server contains a password or name field; brute-forcing activation/reset is rate-limited out.

### SEC-02 — Admin escalation
- **Severity:** P0. **Status: EXPLOITABLE NOW.**
- **Evidence:** hardcoded e-mail bypass inside `authorizeRoles` (`server/middleware/auth.ts:47-50`); the same e-mail auto-promoted to `admin` at registration/social login (`user.controller.ts:264-278`); the e-mail is embedded in shipped client code (`client/app/components/Navbar/Navbar.tsx:49-71`); client-side route guard is Redux-state only (`client/app/hooks/adminProtected.tsx:11-18`).
- **Attack scenario:** anyone who registers with the published e-mail (or spoofs it via `socialAuth`, SEC-01) gains `admin`. Independently, the client guard proves nothing — server routes rely on the bypass-corrupted role check.
- **Impact:** platform-wide admin actions: user management, all videos, analytics, settings; audit-free escalation.
- **Remediation:** delete the e-mail bypass and the client-embedded e-mail entirely; platform admin = explicit `user.is_platform_admin` flag, granted only through an audited platform action (`DATABASE_SCHEMA_AND_ERD.md` §2.9 `platform_admin_action`); server-side `authorizeRoles` is the only gate; client guards are cosmetic.
- **Regression test:** `SEC-02.t` — grep/lint fails if the literal e-mail appears anywhere in the repo; a non-flag user hitting an admin endpoint → 403 even if their role string says `admin`.
- **Acceptance criteria:** no e-mail literal in authorization code or client bundle; admin access requires the DB flag plus an `audit_event` per use.

### SEC-03 — Session & token theft (includes Finding B, P1)
- **Severity:** P1 (Finding B) with P0 sub-items. **Status: EXPLOITABLE NOW.**
- **Evidence:** access **and** refresh tokens returned in JSON bodies (`server/utils/jwt.ts:47-52`; `/auth/me` returns `accessToken`, `user.controller.ts:244-246`); Redis session stores the **entire user document including the password hash** (`jwt.ts:36`, written from `user.controller.ts:140`, served back at `:239-246`); shared Redis keyspace between sessions and video caches by bare id (`V22`, `video.controller.ts:87-99`, `auth.ts:29`); logout deletes the Redis key but cannot invalidate an already-issued JWT (`user.controller.ts:160-176`); `generateAccessToken` re-signs on every request on nine routes (`server/routes/video.route.ts:8,10,17,19,21,23,25,27,29`), sliding the session forward; **Finding B**: token lifetimes defined twice and disagreeing — see the table below.
- **Finding B — verified lifetime inventory:**

  | Timer | Value | Where defined | Verified |
  |---|---|---|---|
  | Access JWT `exp` | **7 days** | `server/models/user.model.ts:97-99` (also re-signed at `user.controller.ts:204-208`) | ✓ |
  | Access cookie `maxAge` | `ACCESS_TOKEN_EXPIRE × 60×60×1000` ms → **hours**; `server/.env` sets `ACCESS_TOKEN_EXPIRE = 4` → **4 hours** | `server/utils/jwt.ts:14`, `:18-19`; `server/.env:22` | ✓ (the variable name suggests minutes; the code multiplies as hours — a third, silent unit bug) |
  | Refresh JWT `exp` | **30 days** | `server/models/user.model.ts:102-106` (`user.controller.ts:210-214`) | ✓ |
  | Refresh cookie `maxAge` | `REFRESH_TOKEN_EXPIRE × 24×60×60×1000` ms → **days**; `server/.env` sets `REFRESH_TOKEN_EXPIRE = 58` → **58 days** | `server/utils/jwt.ts:15`, `:25-26`; `server/.env:24` | ✓ |
  | Redis session TTL | **none** at login (`jwt.ts:36`), `EX 604800` (7 d) on refresh (`user.controller.ts:221`), **none** after a purchase (`order.controller.ts:91`) | three different writers | ✓ |
  | Revocation | cookie clear + `redis.del` only; issued JWTs stay valid to `exp` (up to 7 d) | `user.controller.ts:160-176` | ✓ |

  Consequences: a stolen access token works for 7 days regardless of the 4-hour cookie; a stolen refresh cookie is accepted for 30 days (JWT) although the browser drops it at 58 days; Redis sessions never expire on the login path; logout is not revocation.
- **Attack scenario:** XSS or device theft captures the `access_token` cookie or the JSON body token → replay for 7 days; the Redis user document leak (password hash) turns any Redis read into offline cracking; because logout cannot invalidate JWTs, "sign out" gives false assurance after a token theft.
- **Impact:** persistent impersonation, including future workspace and billing actions; password-hash exposure amplifies to credential stuffing across services.
- **Remediation (the required single-source-of-truth configuration — normative):** one module owns all lifetimes; everything else derives from it.

  | Quantity | Required rule |
  |---|---|
  | Access token lifetime | **≤ 15 min**, opaque or JWT — single constant `AUTH.accessTtl` |
  | Access cookie `maxAge` | **exactly** `AUTH.accessTtl` (same value, same unit, one helper) |
  | Refresh token lifetime | **≤ 30 days**, single constant `AUTH.refreshTtl`, rotated on use |
  | Refresh cookie `maxAge` | **exactly** `AUTH.refreshTtl` |
  | Redis/session TTL | **exactly** `AUTH.refreshTtl`, set on **every** write path |
  | Logout | revokes the **server-side session row first** (`session.revoked_at`), then deletes the cache key; JWTs carry a session id that is checked against the session store, so an issued token dies with the session |
  | Sliding renewal | only via explicit refresh endpoint, never as per-request middleware |

  Target model: `session` table + namespaced Redis cache (`DATABASE_SCHEMA_AND_ERD.md` §2.1); no tokens in bodies (reverses V6); no user documents in Redis (reverses V7); keys `sess:{sha256(token)}` (reverses V22).
- **Regression test:** `SEC-03.t` (details §4.2) — asserts one config source, cookie `maxAge` === JWT `exp`, TTL present on every Redis write, logout kills replay of a previously issued token.
- **Acceptance criteria:** no response body contains a token or password field; a logged-out token is rejected on the next request; a single file defines all TTLs and CI fails if a second literal appears.

### SEC-04 — Workspace cross-tenant access
- **Severity:** P1 (design). **Status: DESIGN RISK** — no workspaces exist in current code (verified absence); the future multi-tenant model must not ship without these controls.
- **Design assumption:** every tenant row carries `workspace_id`; composite FKs `(workspace_id, parent_id)` reject cross-tenant references at the DB level (`DATABASE_SCHEMA_AND_ERD.md` §1.1); repositories require the workspace id as an explicit argument (`API_CONTRACT_AND_MODULES.md` §5.5).
- **Attack scenario:** a service bug, raw SQL, console script or future migration writes/reads a row across workspaces (e.g. comment on another tenant's version, list another tenant's projects).
- **Impact:** full cross-tenant data disclosure and tampering — the defining failure of a SaaS.
- **Remediation:** two independent layers — forced `WHERE workspace_id = $ctx` in every repository call **and** composite FKs; platform admin never widens tenant queries; socket rooms workspace-prefixed.
- **Regression test:** `TESTING_AND_QUALITY_STRATEGY.md` §3 (DB-1): insert a cross-tenant child row and assert the **database** rejects it; API-level 403 tests for every `/workspaces/:wsId/…` route.
- **Acceptance criteria:** DB-1 passes; a non-member request never reaches a repository; revoking membership removes socket rooms (`session.revoked`).

### SEC-05 — IDOR (insecure direct object reference)
- **Severity:** P1. **Status: EXPLOITABLE NOW** (current marketplace), with design controls for the target.
- **Evidence:** `GET /v1/videos/get-video/:id` has **no auth middleware** (`server/routes/video.route.ts:12`); playback OTP mints credentials for any video id (`video.route.ts:31` — V11, `video.controller.ts:491-511`); order/analytics routes return objects by id with role checks only on some paths.
- **Attack scenario:** enumerate/guess ids → read any video's metadata and playback OTP without login; in the target model, supply another workspace's version id and receive its content if scoping is app-only and buggy.
- **Impact:** content piracy, unauthorized playback, cross-tenant reads.
- **Remediation:** every route: session → membership → role, before any id lookup; playback tokens only for authenticated members, 5-minute TTL (`VIDEO_PROCESSING_ARCHITECTURE.md` §5); ids are uuids (not enumerable ObjectIds) in the target schema.
- **Regression test:** unauthenticated and cross-member access to each object route → 401/403; OTP endpoint without session → 401 (`TESTING_AND_QUALITY_STRATEGY.md` §4).
- **Acceptance criteria:** no route resolves an object by id without workspace context; VP-5 passes.

### SEC-06 — Mass assignment
- **Severity:** P1. **Status: EXPLOITABLE NOW.**
- **Evidence:** `updateVideo` writes raw `req.body` via `$set` (`server/controllers/video.controller.ts:63-71`); `createVideo` passes the raw body to `create` (`server/services/video.service.ts:6-8`).
- **Attack scenario:** PUT extra fields (`price`, `purchased`, `role`-like attributes, `isVerified`) in the body → privilege or price manipulation.
- **Impact:** data tampering, price changes (compounds SEC-07), possible privilege fields on user-like documents.
- **Remediation:** zod schemas with explicit field allow-lists at every route boundary; body pick-lists only (`API_CONTRACT_AND_MODULES.md` §1.4); `repository` methods take typed DTOs, never `req.body`.
- **Regression test:** send a body containing an extra privileged field → persisted object unchanged; contract test scans schemas for passthrough objects.
- **Acceptance criteria:** zero route handlers forward `req.body` directly to a write; CI fails on `.create(req.body)` / `$set: req.body` patterns.

### SEC-07 — Stripe payment manipulation (Finding A, P0)
- **Severity: P0. Status: EXPLOITABLE NOW. OPEN.**
- **Evidence:** `server/controllers/order.controller.ts:137` — `stripe.paymentIntents.create({ amount: req.body.amount, currency: "inr" })`. `createOrder` checks only `paymentIntent.status === "succeeded"` (`:25-31`) and never compares the paid amount to anything. The authoritative price is `video.price` (`server/models/video.model.ts:37`, schema at `:93`) and it **is** used for the confirmation e-mail (`order.controller.ts:63`) but never for payment.
- **Financial impact:** the customer chooses the price. Create a PaymentIntent for **1 paise**, pay it, `createOrder` accepts it → full-price video delivered (`user.videos.push`, `:89`; `purchased + 1`, `:101`). Loss = (video price − 1 paise) per transaction, unbounded, repeatable, and invisible in Stripe reconciliation because the intent genuinely succeeded. Every price point on the platform is effectively free.
- **Attack scenario:** (1) direct: `POST /orders/new-payment {amount: 1}` → pay → `POST /orders` with the intent id → access granted. (2) variant: legitimate small amount + manipulated `videoId`. (3) replay: reuse a succeeded intent id for another order — `createOrder` does not consume or bind the intent to an order/user/video.
- **Remediation — trusted pricing model (normative):**
  1. **Server-side amount derivation.** The PaymentIntent amount = `video.price` converted to the **minor unit** of the target currency, computed on the server. `req.body.amount` is never read.
  2. **Currency validation.** One canonical currency per platform (today: `inr`, hardcoded at `:138`). `video.price` is stored in minor units of that currency; a mismatch between plan/currency config and the charge → reject before intent creation. Multi-currency is out of scope until a price-table + FX decision exists (registered, not silently added).
  3. **Order validation.** `createOrder` must verify, in one transaction: intent `status === "succeeded"` **and** `paymentIntent.amount === expectedMinorUnits(video.price)` **and** `paymentIntent.currency === canonical` **and** the intent's `metadata.order_binding` (set at creation to `{videoId, userId}`) matches the request **and** the intent has not been used by a previous order (`payment_intent` uniqueness enforced by the order row, not by trust).
  4. **Idempotency.** Intent creation keyed by `Idempotency-Key` (Stripe idempotency key = deterministic key per `(user, video, price-version)`); order creation keyed by intent id — one succeeded intent creates exactly one order; replays return the original order (`idempotency_record`, `DATABASE_SCHEMA_AND_ERD.md` §2.1, and unique binding in the order record).
  5. **Never trust the client for price display either** — the checkout screen reads `video.price` from the API and the server re-derives it at charge time.
- **Regression test:** `SEC-07.t` (spec §4.1) — client sends `amount: 1`; assert the created PaymentIntent amount equals server price; assert `createOrder` rejects a succeeded intent whose amount ≠ price; assert one intent → at most one order.
- **Acceptance criteria:** `grep "req.body.amount"` in payment paths returns nothing; a paid-below-price intent can never produce an order (test in CI); Stripe dashboard totals reconcile to `video.price` per order. **Remains OPEN until the source is fixed and the test passes independently of the fix's author.**

### SEC-08 — Malicious uploads
- **Severity:** P1. **Status: EXPLOITABLE NOW.**
- **Evidence:** "upload" = base64 data-URI inside a 50 MB JSON body (`server/server.ts:24`, `express.json({limit:"50mb"})`) pushed to Cloudinary with **no type/size/content validation** (`server/controllers/video.controller.ts:17-36`).
- **Attack scenario:** upload polyglot files (HTML/JS disguised as video), oversized payloads for DoS, malware hosting for third-party distribution, or a crafted file that exploits downstream processors.
- **Impact:** malware distribution from your domain, storage/cost exhaustion, processor compromise, XSS if any asset is served inline (SEC-10).
- **Remediation:** resumable direct-to-storage upload with allow-listed MIME+extension (`video/mp4`, `video/quicktime`, `video/webm`, `video/x-matroska`), plan size caps, server-side sha256 verification, ffprobe-style validation before transcode, `failed/invalid_media` on suspicion (`VIDEO_PROCESSING_ARCHITECTURE.md` §3.2); serving assets with `Content-Disposition: attachment` or sandboxed domain; concurrent-upload cap.
- **Regression test:** polyglot file, wrong extension, oversize, checksum mismatch → each rejected before any provider call; bytes never traverse the API process (VP-4).
- **Acceptance criteria:** VP-4 and VP-6 pass; no endpoint accepts arbitrary body bytes as a file.

### SEC-09 — SSRF (server-side request forgery)
- **Severity:** P1 (design). **Status: DESIGN RISK** — current code does not fetch caller-supplied URLs (verified: upload is data-URI, not URL), but Cloudinary receives arbitrary caller data (`video.controller.ts:17-36`) and every future integration (thumbnail import, caption import, webhook targets) is an SSRF candidate.
- **Attack scenario:** an endpoint accepts `https://internal/…` as an image/video URL → server fetches cloud metadata (`169.254.169.254`), internal admin panels, or file:// resources.
- **Impact:** credential theft from metadata endpoints, internal network pivot, data exfiltration.
- **Remediation:** **no URL ingestion in v1** (`VIDEO_PROCESSING_ARCHITECTURE.md` §3.2 — "No URL ingestion: endpoints never accept a remote URL to fetch"); all bytes flow browser → storage via presigned URLs we issue; if URL fetch is ever added: scheme allow-list (https only), DNS resolution + private-range block list, fixed egress proxy, response size/time caps.
- **Regression test:** any endpoint given an internal/metadata URL → 422, zero outbound requests (assert at the HTTP stub layer).
- **Acceptance criteria:** repository-wide scan finds no code path that fetches a caller-supplied URL; VP-4 passes.

### SEC-10 — XSS and CSRF
- **Severity:** P1. **Status: PARTIALLY EXPLOITABLE NOW / DESIGN RISK.**
- **Evidence:** cookie auth without CSRF tokens (no CSRF dependency; state-changing routes accept cookie auth); cookies set `sameSite: "lax"` (`server/utils/jwt.ts:21,27`) which blocks classic cross-site POSTs but is the **only** CSRF defence; `secure` is set only when `NODE_ENV === "production"` (`jwt.ts:39-42`) — dev/staging cookies are plain HTTP; error responses echo internal messages (V19) that can carry reflected content; future review UI renders user comments and AI text.
- **Attack scenario:** CSRF — a crafted page triggers a state-changing request (login CSRF, future: approve/publish) on any endpoint reachable via a lax-exempt method or a same-site/subdomain context. XSS — stored payload in a comment/transcript rendered without escaping → session cookie theft (mitigated by HttpOnly, but full account actions in-session).
- **Impact:** unauthorized state changes (approve, publish, delete), session riding, data theft.
- **Remediation:** double-submit CSRF token header `X-CSRF-Token` on every mutating request (`API_CONTRACT_AND_MODULES.md` §1.1); `Secure` always in staging+production; CSP with no `unsafe-inline`; React default escaping + explicit sanitization for any `dangerouslySetInnerHTML` (captions/SEO previews); output encoding for AI text (SEC-12).
- **Regression test:** mutating request without/with wrong CSRF header → 403 `CSRF_FAILED`; XSS fixture comment renders inert (DOM assertion).
- **Acceptance criteria:** CSRF test matrix passes for every mutating route; CSP deployed; V19 leak test passes (SEC-16).

### SEC-11 — Unauthenticated realtime events
- **Severity:** P1. **Status: EXPLOITABLE NOW.**
- **Evidence:** `server/socketServer.ts:9-14` — every `notification` payload is broadcast via `io.emit` to **all** connected clients; no handshake authentication, no rooms.
- **Attack scenario:** connect any socket → receive every user's notification stream; inject fake `notification` events to all clients (phishing within the product).
- **Impact:** platform-wide data leak and content spoofing; in the target model: cross-tenant event leakage of approval/publish/comment events.
- **Remediation:** `io.use()` session-cookie handshake — reject unauthenticated sockets before any room join; canonical rooms `ws:{workspaceId}[:prj|:ver:…]` (`API_CONTRACT_AND_MODULES.md` §3.15); membership re-checked on join and on revocation; events are notifications of fact only, clients re-fetch REST; per-user connection caps (10/user, 100/workspace).
- **Regression test:** unauthenticated connect → rejected; a member of workspace A joining `ws:{B}` → refused; broadcast of another tenant's event never delivered (socket test harness).
- **Acceptance criteria:** no event reaches a socket without an authenticated session **and** room membership; `session.revoked` fires on membership removal.

### SEC-12 — AI prompt injection & unsafe outputs
- **Severity:** P1 (design). **Status: DESIGN RISK** — no AI code exists (V16). Controls are specified in `AI_PROVIDER_ARCHITECTURE.md` §7.1 and normative there.
- **Evidence/design assumption:** workspace content (transcripts, comments, titles) is untrusted input to models; model output is untrusted text that flows into captions, titles, descriptions, thumbnails and (Phase 9) the YouTube description.
- **Attack scenario:** a transcript contains "ignore previous instructions and…"; or a poisoned title instructs the model to emit harmful/illegal content, an exfiltration URL, or HTML/script for the review UI. Cost attack: injected instruction inflates output tokens to drain the workspace quota.
- **Impact:** unsafe published content (brand/legal), XSS via unescaped AI text, outbound requests (none permitted), quota/cost exhaustion, cross-workspace leakage if isolation fails.
- **Remediation:** content-is-data prompt boundary; **no tools/function-calling/code execution in v1**; no outbound URL fetch from model output; model output never used as a path/storage key/channel id; zod-validated structured output only; secrets never in prompts; explicit `workspace_id` on every gateway call; per-job token cap (**OD-07**) + monthly cap checked pre-enqueue.
- **Regression test:** prompt-injection fixture (instruction-like transcript) → normal structured output, **zero** outbound requests, zero file writes, zero credential reads, job cost within cap (`AI_PROVIDER_ARCHITECTURE.md` AI-6, run in CI).
- **Acceptance criteria:** AI-6 passes; every rendered AI string passes through the standard escape path (XSS test shares the fixture).

### SEC-13 — YouTube token theft
- **Severity:** P1 (design). **Status: DESIGN RISK** (no YouTube code — V16). Full design: `YOUTUBE_PUBLISHING_ARCHITECTURE.md` §2.1.
- **Evidence/design assumption:** a refresh token grants **permanent** upload rights to a channel until revoked; current code's habit of returning tokens in bodies (V6) is the anti-pattern to break.
- **Attack scenario:** token exfiltrated via response body, log line, error message, DB dump or a compromised server process → attacker uploads to (or deletes from) the victim's channel indefinitely.
- **Impact:** channel compromise, reputational damage, quota burn.
- **Remediation:** AES-256-GCM envelope encryption at rest; never selected into response shapes (invariant, `DATABASE_SCHEMA_AND_ERD.md` §2.8); worker-only refresh; `audit_event` on grant/revoke/refresh-failure; owner-only connect/disconnect; revoke-at-Google on workspace deletion.
- **Regression test:** contract test asserts no response schema contains `*_token*` fields (automated, `TESTING_AND_QUALITY_STRATEGY.md` §4); YT-1, YT-7.
- **Acceptance criteria:** YT-1/YT-7 pass; a DB dump alone cannot yield a usable token without the master key (key not in the DB).

### SEC-14 — Duplicate publishing
- **Severity:** P1 (design). **Status: DESIGN RISK.**
- **Evidence/design assumption:** uploads take minutes and fail ambiguously; the current code has no job/idempotency model at all (verified absence), so the future model must be built correctly the first time.
- **Attack scenario:** retry storms, double-click, worker crash after YouTube accepted bytes → second upload → two public videos for one approval; or an attacker with `editor` rights spamming publish attempts.
- **Impact:** duplicate public content, quota burn (SEC quota), confused approvals, brand damage.
- **Remediation:** permanent `publish_job.idempotency_key = workspace:version:channel` (no attempt counter, `API_CONTRACT_AND_MODULES.md` §1.5); `Idempotency-Key` header on the enqueue endpoint with 24 h `idempotency_record` window; frozen `package_snapshot`; reconciliation-before-retry for `outcome_unknown` (`YOUTUBE_PUBLISHING_ARCHITECTURE.md` §5.4); rate limit 30 publish creates/hour/workspace.
- **Regression test:** CT-11 (§TESTING_AND_QUALITY_STRATEGY.md §4) — double enqueue, worker double-delivery, crash-and-resume each end with exactly **one** `publish_job` row and at most one YouTube video.
- **Acceptance criteria:** YT-3/YT-4/YT-5 pass; a duplicate insert is rejected by the unique key at the DB level.

### SEC-15 — Unauthorized publishing
- **Severity:** P1 (design). **Status: DESIGN RISK.**
- **Evidence/design assumption:** publishing is the highest-risk write in the product; approval of an immutable version is the gate. Current code has no publish path (V16), and the current role system is corrupted by SEC-02.
- **Attack scenario:** an `editor` (or a compromised editor session) publishes content the owner never approved; or a package is edited after approval to change what actually ships.
- **Impact:** unapproved public content, policy strikes on the channel, contractual damage.
- **Remediation:** three independent gates — (1) role: enqueue/validate = `owner`/`admin` only (`API_CONTRACT_AND_MODULES.md` §3.13); (2) data: DB constraint trigger `publish_job_requires_approved_version` rejects any job whose approval is not `decision='approved'` for the same version (`DATABASE_SCHEMA_AND_ERD.md` §2.8); (3) process: `package_snapshot` frozen at enqueue, so post-approval edits supersede rather than mutate. Every transition writes `audit_event`.
- **Regression test:** contract test inserts a `publish_job` against an unapproved version and asserts the **DB trigger** rejects it (DB-2, `TESTING_AND_QUALITY_STRATEGY.md` §4); role matrix test: editor → 403 on validate/enqueue/retry.
- **Acceptance criteria:** DB-2 and the role matrix pass; no code path creates a publish job without an `approval_id` FK.

### SEC-16 — Secrets exposure
- **Severity:** P0 (parts) / P1. **Status: EXPLOITABLE NOW.**
- **Evidence:** secrets live in working-tree env files (`server/.env`, `client/.env`) and `server/` has **no `.gitignore`** (V18 — whether committed to a remote is unverified: no git repository exists at workspace root); Redis session holds the password hash and is served to the client (V7); error middleware returns raw `err.message` (`server/middleware/error.ts:33-36` — V19); registration response contains `activeToken` (V4); tokens in bodies (V6); `console.log` of operational data in socket server (`socketServer.ts:8`).
- **Attack scenario:** leaked env file (backup, sync, accidental commit later) exposes `STRIPE_SECRET_KEY`, `VDOCIPHER_API_KEY`, `DB_URL`, `REDIS_URL` (which itself contains a Upstash password — verified present in `server/.env:26`); error messages reveal stack/SQL/host details to attackers; password hash in Redis widens any cache read into credential theft.
- **Impact:** full infrastructure compromise, payment fraud, data breach.
- **Remediation:** `server/.gitignore` covering `.env*`; rotate every credential that has ever sat in a working tree; secrets only via environment/secret manager; structured logs with a redaction allow-list; error responses return `INTERNAL` + `requestId` only (`API_CONTRACT_AND_MODULES.md` §1.2); no password material in Redis (session stores ids, `DATABASE_SCHEMA_AND_ERD.md` §2.1); CI secret scanning (gitleaks-class).
- **Regression test:** error middleware test: an internal error yields `{"error":{"code":"INTERNAL"}}` with **no** `err.message` (V19 regression); response-schema scan: no token/password fields (V4/V6/V7 class, `TESTING_AND_QUALITY_STRATEGY.md` §4); secret scanner in CI.
- **Acceptance criteria:** V19 test passes; secret scan clean; no `.env` inside any served directory; Redis contains no password material (inspection test).

---

## 4. Finding closure criteria & regression tests (A, B, C)

**All three findings are OPEN.** This section is the normative test specification referenced from `CREATORFLOW_MASTER_ARCHITECTURE.md` §0.2. Each test must be written, run green in CI, and confirmed by someone other than the fix's author before the finding may be marked CLOSED.

### 4.1 Finding A — Stripe payment manipulation (P0, SEC-07)

| # | Test | Assertion |
|---|---|---|
| A-1 | `payment amount derived server-side` | POST the payment-creation endpoint with `{amount: 1, amount: 999999}` (and no amount): the created PaymentIntent's `amount` equals `video.price` minor units in every case |
| A-2 | `order rejects underpayment` | build a succeeded PaymentIntent for amount ≠ price → `createOrder` returns 4xx, **no** order row, no `user.videos.push` |
| A-3 | `currency mismatch rejected` | succeeded intent with `currency ≠` canonical → rejected before any write |
| A-4 | `intent binding` | intent created without matching `metadata` binding for this `(user, video)` → rejected |
| A-5 | `one intent → one order` | second order with the same succeeded intent id → replayed original response (idempotency), never a second entitlement |
| A-6 | `no client amount` | static check: no `req.body.amount` (or equivalent) reachable in payment code paths |

Exit gate: A-1…A-6 green **and** manual verification that a real test-mode 1-paise intent cannot produce an order.

### 4.2 Finding B — token lifetime mismatch (P1, SEC-03)

| # | Test | Assertion |
|---|---|---|
| B-1 | `single TTL source` | all token/cookie/Redis TTLs resolve from one config module; a grep/lint rule fails the build if a second lifetime literal appears in auth code |
| B-2 | `cookie equals JWT` | access cookie `maxAge` (ms) === access JWT `exp − iat` (ms); same for refresh |
| B-3 | `TTL on every Redis write` | every `redis.set` of session data sets a TTL equal to the refresh TTL; login path included (fails today: `jwt.ts:36`, `order.controller.ts:91`) |
| B-4 | `logout revokes` | after logout, replaying the previously issued access token → 401 (server-side revocation), not 200 until natural expiry |
| B-5 | `no sliding forever` | N authenticated requests do not extend the session beyond the configured refresh window; refresh only via the explicit refresh path |
| B-6 | `no tokens in bodies` | login/refresh/`/me` responses contain no `accessToken`/`refreshToken` fields (schema scan) |
| B-7 | `no user document in Redis` | Redis session payload contains no `password` field (inspection test) |

Exit gate: B-1…B-7 green; documented TTL table (SEC-03) matches the shipped config exactly.

### 4.3 Finding C — frontend/backend boundary violation (P1)

Owned by `TESTING_AND_QUALITY_STRATEGY.md` §5 (import boundary), referenced here for register completeness:

| # | Test | Assertion |
|---|---|---|
| C-1 | `import boundary lint` | ESLint `no-restricted-imports` fails any `client/**` import from `server/**` and vice versa; the current violation at `client/redux/features/videos/videosApi.ts:1` is the seed case |
| C-2 | `client typecheck has no out-of-root errors` | CI fails when any client `tsc --noEmit` error references a path outside `client/` (10 `TS2339` errors under `../server/controllers/video.controller.ts` today) |
| C-3 | `shared package only` | cross-boundary types come from `shared/` (vendor-free, side-effect-free); a test asserts `shared/` imports nothing from either tree |

Exit gate: the dead import removed, C-1…C-3 green.

---

## 5. Acceptance checklist (gate for Phase 0 exit)

- [ ] Every SEC-01…SEC-16 area has a regression test that runs in CI (design-risk areas: their controls are implemented before the feature ships, tests written in the same PR).
- [ ] Findings A, B, C closed per §4 (source changed + tests green + independent confirmation) — **not met today; all OPEN**.
- [ ] `npx tsc --noEmit` green in `server/` and `client/` (V13/V14).
- [ ] CI exists and runs typecheck + lint + tests (V15).
- [ ] No hardcoded e-mail/role bypass anywhere (V1, V3); no identity from the client (V2).
- [ ] No token or password material in any response body or Redis payload (V4, V6, V7).
- [ ] Rate limiting live on auth and upload endpoints (V8).
- [ ] Socket.io authenticated and room-scoped (V9).
- [ ] Mass-assignment paths closed (V10); upload validation live (V12).
- [ ] Error responses leak nothing (V19); secret scan clean; `server/.gitignore` present (V18).
- [ ] VdoCipher/playback credentials require an authenticated member (V11, VP-5).

Until every box is checked with test evidence, **feature development does not start** (`MIGRATION_AND_IMPLEMENTATION_ROADMAP.md` Phase 0 exit gate).
