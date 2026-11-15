# Phase 0 Execution Checklist

Status values: `NOT STARTED` · `IN PROGRESS` · `REMEDIATED (tests green, pending independent review)` · `CLOSED` · `OWNER ACTION` · `BLOCKED`

A finding is **CLOSED** only when source changed + regression tests pass + independent review confirmed (per DoD).

## Security findings

| ID | Scope | Status | Evidence |
|---|---|---|---|
| SEC-01 | Social authentication account takeover | REMEDIATED (tests green, pending independent review) | `server/tests/socialAuth.test.ts` (10 tests, pass); Google ID token verified server-side (`verifyIdToken` + `email_verified`); client sends `idToken` only; `next-auth` removed |
| SEC-02 | Administrator e-mail escalation | REMEDIATED (tests green, pending independent review) | `server/tests/authorization.test.ts` (7 tests, pass); e-mail bypass removed from `authorizeRoles`; `PLATFORM_ADMIN_EMAIL` bootstrap after verified login only; role whitelist on `updateUserRole` |
| SEC-03 | (merged into SEC-02 scope) | REMEDIATED (tests green, pending independent review) | same as SEC-02 |
| SEC-04 | Password hashes & token exposure | NOT STARTED | Batch 2 |
| SEC-05 | Socket.io authentication & isolation | NOT STARTED | Batch 3 |
| SEC-06 | Activation flow & rate limiting | NOT STARTED | Batch 2 |
| SEC-07 | Secrets protection | NOT STARTED | Batch 8 |
| VdoCipher / content authZ | Unauthenticated OTP, video access, IDOR | NOT STARTED | Batch 3 |

## Findings A / B / C

| ID | Scope | Status | Evidence |
|---|---|---|---|
| A | Stripe payment integrity | NOT STARTED | Batch 4 |
| B | Token lifetime consistency | NOT STARTED | Batch 2 |
| C | Client/server import boundary | NOT STARTED | Batch 5 |

## Build & quality gates

| Gate | Baseline (verified) | Status |
|---|---|---|
| Server `tsc --noEmit` | 5 errors (`order.controller` IVideo + 4× ErrorHandler order) | AT BASELINE (no new errors) — fixed in Batches 4/5 |
| Client `tsc --noEmit` | 14 errors (10× Finding C TS2339, 2 stale `.next/types`, 1 Set, 1 `user` prop) | AT BASELINE (no new errors) — Batch 5 |
| ESLint | broken config (`next/babel`) | NOT STARTED — Batch 6 |
| `next build` | not yet verified | NOT STARTED — Batch 6 |
| Unit/integration tests | none existed | IN PROGRESS — foundation laid; 17 passing (SEC-01/02) |
| CI (GitHub Actions) | none | NOT STARTED — Batch 8 |

## Batch log

| Batch | Scope | Date | Result |
|---|---|---|---|
| 1 | Authentication & administrator authorization (SEC-01/02) | Session day 1 | COMPLETE — 17/17 tests pass; server/client tsc at baseline |
| 2 | Password, token & session security (SEC-03/04/06, Finding B) | — | pending |
| 3 | Socket.io security & video access controls (SEC-05, VdoCipher, IDOR) | — | pending |
| 4 | Stripe payment integrity (Finding A) | — | pending |
| 5 | Client/server import boundary & TypeScript (Finding C) | — | pending |
| 6 | Linting & production build | — | pending |
| 7 | Test framework & regression tests | — | pending |
| 8 | CI, logging, infrastructure security, final verification, report | — | pending |

## Owner actions (transparent, not claimed done)

- [ ] Google OAuth consent screen verification — **OWNER ACTION REQUIRED**
- [ ] Add `GOOGLE_CLIENT_ID` (server) + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (client) — social login fails closed (503) until then
- [ ] Credential rotation runbook review (Batch 8)
- [ ] GitHub push to activate CI — no commits pushed per Phase 0 rules
