# ReelFlow: existing system audit

Date: 2026-11-17. Scope: this repo (`server/`, `client/`, `docs/`) and the local copy of Ai-Reel-Factory (`~/Downloads/ai-reel-factory-working`). Extends `AUDIT.md` (same folder); where they differ, this file wins.

## 1. Where the code differs from the architecture docs

`docs/architecture/*` plans PostgreSQL + Prisma, Mux, rebuilt session auth and Argon2id. The running code is none of that. Plan against the code.

| Topic | Docs say | Code does |
|---|---|---|
| Database | PostgreSQL + Prisma primary | Mongoose / MongoDB (`server/models/*`, 4 files, 311 lines) |
| Video infra | Mux behind a `VideoProvider` port | multer upload, local disk (`utils/storage.ts`), ffmpeg to HLS (`utils/transcode.ts`) |
| Auth | Opaque session ids, Argon2id | Cookie JWT + Redis session (`utils/jwt.ts`, `utils/session.ts`), bcryptjs, magic links for editors/guests |
| Video controller | `video.controller.ts` | Gone. Replaced by `review.controller.ts` (556 lines) |
| Billing | Stripe | `stripe` is a dependency and env key only. No billing route, model or webhook exists. Nothing to preserve |

Consequence: the "PostgreSQL-compatible models" goal (Stage 9) is a migration, not an extension. See `MIGRATION_PLAN.md`.

## 2. Server (`server/`, Express 4 + TypeScript, ~4,000 lines)

| Area | Files | Notes |
|---|---|---|
| Auth | `middleware/auth.ts`, `utils/jwt.ts`, `utils/session.ts`, `controllers/user.controller.ts` (574) | Cookie JWT, Redis session, Google login, activation mail. No API tokens, no OAuth server |
| Authorization | `middleware/projectAccess.ts`, `services/reviewLogic.ts` | Roles: owner, editor (magic link), guest. Tested in `tests/authorization.test.ts` |
| Review domain | `models/review.model.ts` | Project, ProjectVersion (unique `project+number`), ReviewComment (text, voice, drawing, `timecode`), ReviewLink, Approval |
| Media | `utils/storage.ts`, `utils/transcode.ts`, `utils/thumbnail.ts`, `utils/reviewTokens.ts` | Storage keys traversal-checked (`resolveKey`). HLS and media served via signed tokens |
| AI | `utils/ai.ts`, `services/aiProviders.ts` | `askJson(zodSchema)` with re-ask, tiers `smart`/`fast`, providers Anthropic, Gemini, Groq. `transcribe()` returns timed segments (segment level, not word level) |
| Jobs | `jobs/publishKit.ts`, `jobs/publish.ts`, `jobs/autoKit.ts` | BullMQ, in-process `Worker`, concurrency 1. Per-feature, no shared job model |
| Publishing | `utils/youtube.ts`, `utils/instagram.ts`, `controllers/social.controller.ts`, `services/publishKitLogic.ts` | Kit = titles, description, tags, SRT |
| Notifications | `utils/notify.ts`, `mails/review-event.ejs`, `utils/sendMail.ts` | Email. Socket.io is a dependency; check usage before relying on it |
| Hardening | `middleware/rateLimit.ts`, helmet, `requestContext.ts`, `utils/logger.ts` | Keep and extend |
| Tests | `server/tests/*.test.ts`, 202 tests (vitest) | Hand-rolled `fakeModel`, no real Mongo |

Gaps (confirmed by search): no timeline/clip/track model, no render provider interface, no generic job record, no operation layer separate from controllers, no API tokens, no MCP, no resumable upload, no word-level timing, no diarization, no object storage.

## 3. Client (`client/`, Next.js 14 App Router)

Routes: `app/(app)`, `app/review`, `login`, `signup`, `about`, `policy`, `privacy`. Recent commits added a landing page, frosted dock nav and WebGL sections. There is no chat panel, timeline, or asset browser. `client/pages/api` is the NextAuth shim. Redux Toolkit is used for state.

## 4. Environment facts (measured on this machine)

- ffmpeg 9.0.2: libx264, aac, `loudnorm`, `afftdn`, `silenceremove`, `overlay`, `concat`, `xfade`, `amix`, `crop`, `scale`. **No `subtitles`, no `drawtext`** (no libass/freetype). Captions must be PNG overlays or a fuller ffmpeg.
- `server/.env`: no GEMINI, GROQ, ANTHROPIC or OPENAI key. Real transcription and planning cannot run until one is set.
- Node 20.20.

## 5. Ai-Reel-Factory

Local copy is `~/Downloads/ai-reel-factory-working`. It is not reachable at the GitHub URL given (`gh repo view` failed), so this audit covers the local copy only.

It is a 99-line `app/main.py`: RSS fetch, keyword scoring, SQLite, one `ffmpeg drawtext` call to render a 12 s 1080x1920 card, FastAPI `/run`, `/video/{id}`, `/health`, an n8n workflow. Deps: `fastapi`, `uvicorn`.

| Requested reusable part | Present? |
|---|---|
| FFmpeg processing | One `lavfi color` + `drawtext` command. Not reusable: no input media, and `drawtext` is exactly what local ffmpeg lacks |
| AI orchestration / provider abstraction | None |
| Caption generation | None |
| Render processing / job management | `BackgroundTasks` + SQLite row. Not a job system |
| Reusable | `Dockerfile` pattern (python:3.12-slim + ffmpeg + uvicorn), `/health` convention |

Conclusion: nothing worth porting. The FastAPI media service is new code, using the Dockerfile pattern. The Node ffmpeg helpers already in `utils/transcode.ts` are the real starting point for FFmpeg logic.

## 6. Reuse map

Reuse unchanged: `projectAccess`, `assertCan`, `ProjectVersion` immutability, comments and approval log, storage key safety, signed media tokens, `askJson`, `aiProviders`, publish kit, BullMQ pattern, rate limiting, 202 tests.
Extend: `utils/transcode.ts` (render helpers), `utils/ai.ts` (`transcribe` gains words/language), `utils/storage.ts` (object storage driver).
Build new: edit format, ops, render provider, job model, operation layer, API tokens, MCP server, agent, skills, studio UI, Python media service.

## 7. Risks

1. Docs/code drift: acting on the Postgres/Mux docs would rebuild working code.
2. Long renders in the API process block the server. Needs a separate worker before hosted use.
3. No AI key: the acceptance test cannot honestly pass until one exists.
4. Telugu ASR quality is unknown; no benchmark exists. Provider choice must follow measurement, not assumption.
5. Rebrand CreatorFlow to ReelFlow touches copy, metadata, email templates and docs.
