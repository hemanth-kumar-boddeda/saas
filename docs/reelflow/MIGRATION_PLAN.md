# ReelFlow: migration plan

Rule: every step leaves the app working and the 202 existing tests green. Additive first. Verify with `cd server && npm test` after each step.

## Steps

| # | Step | Touches | Exit check |
|---|---|---|---|
| 1 | `server/reel/schema.ts` timeline v1 + `ops.ts` pure operations + unit tests | new files | tests pass, no existing file changed |
| 2 | `Job`, `MediaAsset`, `Timeline`, `Transcript`, `UsageEvent` models | `server/reel/models.ts` | model tests |
| 3 | Storage driver interface (local first) | `utils/storage.ts` only gains an interface | existing storage tests green |
| 4 | `RenderProvider` + ffmpeg adapter (PNG captions, `loudnorm`, trim/concat, 9:16 crop) | `utils/transcode.ts` extended | a hand-written timeline renders to a playable mp4, checked with ffprobe |
| 5 | Python `media-service/` (health, probe, transcribe, render) + Dockerfile | new dir | contract tests against the service |
| 6 | Operation layer (create project, register media, transcribe, plan, apply edit, render, revise, approve) | `server/reel/operations/*` | integration tests with real ffmpeg |
| 7 | `ApiToken` model + bearer middleware + `/v1/reel` routes | `middleware/`, `routes/` | authz tests: wrong owner, wrong scope, revoked token |
| 8 | Agent orchestrator + 12 skill files | `server/reel/agent`, `skills/*.md` | needs a model key to run for real |
| 9 | MCP server (tools = operations) | `server/mcp/` | MCP inspector call sequence |
| 10 | Studio UI: nav, AI Editor route, timeline, chat | `client/` | browser run |
| 11 | Rebrand CreatorFlow to ReelFlow in copy, metadata, mail templates, docs | many, text only | grep shows no stale brand in user-facing strings |
| 12 | Production: object storage driver, separate render worker, metering, observability | infra | load and failure tests |

Step 11 is deliberately late and needs approval (see decisions).

## Preserved untouched

Auth, user accounts, project access, versions, comments, approval log, publish kit, YouTube/Instagram publish, notifications and email, admin, rate limiting, helmet. New code calls these; it does not edit them except where a step above says so.

## Database

Stay on MongoDB through step 10. New models avoid Mongo-only features (no `$lookup`-dependent design, ids referenced explicitly). A Postgres move is a separate, later project with dual-write, backfill and cutover. It is not needed for the acceptance test.

## Rollback

Each step is its own commit. New routes are mounted under `/v1/reel` and behind env flag `REEL_ENABLED`, so removal is one flag.

## Decisions needed from you

1. **AI key.** Set `GEMINI_API_KEY` or `GROQ_API_KEY` (free). Without it, steps 6 (transcribe) and 8 cannot run for real.
2. **Rebrand now or later.** Default: later (step 11).
3. **Ai-Reel-Factory GitHub URL returns not found.** Local copy is a 99-line demo with nothing to port. Confirm the URL is private or wrong, or confirm local is the intended source.
4. **Telugu ASR.** Which provider keys do you have (Sarvam, Google)? Need real consented recordings for the benchmark.
5. **Hosting.** Where will the Python service and bucket run? Needed only for hosted MCP and cloud render.
