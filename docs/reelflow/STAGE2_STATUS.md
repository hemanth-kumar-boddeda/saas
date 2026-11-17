# ReelFlow stage 2 status

Checkpoint before stage 2: commit `1e0ccc6` (248 tests green). Stage 2 is uncommitted on top of it.

## Provider configuration (server/.env, never committed)

| Variable | Used for | Without it |
|---|---|---|
| `SARVAM_API_KEY` | Primary ASR. Optional `SARVAM_ASR_MODEL` (default `saaras:v4`), `SARVAM_ASR_MODE` | transcribe job fails with `providerStatus: not_configured` |
| `GROQ_API_KEY` | Fallback ASR (`provider: "groq"`) | same |
| `GEMINI_API_KEY` | Planner. Optional `GEMINI_PLANNER_MODEL` | `POST /plans` returns 503 `PROVIDER_NOT_CONFIGURED`; nothing stored |
| `REEL_ENABLED=false` | Turns off `/v1/reel`, `/mcp` and the reel worker | |

## Done and verified (282 tests pass, `tsc` clean, `next build` passes)

- **Phase A (partial).** Live smoke script `reel/benchmark/smoke.ts` (exit 3 = not configured). Caption font bug found by looking at rendered output and fixed: `Arial Unicode MS` in the stack broke Telugu conjunct shaping; stack is now Kohinoor Telugu / Telugu Sangam MN / Noto Sans Telugu (tested visually on macOS; a test guards the stack).
- **Phase B.** Gemini adapter; planner builds context from timeline, media facts, transcript, skill analyses; model reply must match a schema limited to registry operations; every op is dry-run on a copy; per-op `valid`, `error`, `warnings`, `target`, `rationale`. Plans are stored with history. Propose, approve (all valid or a subset), reject, execute are separate calls. Execute is idempotent, claims the plan atomically, checks the timeline version, and writes one version for the whole plan. Stale plans become `superseded`.
- **Phase C.** Three skills with rules, criteria, schemas, operations, escalation, eval cases, generated `SKILL.md` files: `telugu-tenglish-editor`, `talking-head-story-editor` (phrase selection to `remove_range` conversion is deterministic), `video-quality-controller` (real render measurements; unmeasurable = `not_measured`).
- **Phase D.** MCP over Streamable HTTP at `POST /mcp` (stateless, bearer `rf_` token, scopes, ownership). Edit tools are generated from `registry.ts`. Tests use the official SDK client over real HTTP.
- **Phase E.** `/projects/:id/editor` page: preview, timeline (select, cursor, split, delete range, reframe), AI chat with plan cards (per-op checkboxes, warnings, apply, reject), render progress, version history, approve. It only calls `/v1/reel`.
- **Parity.** A test drives the same plan through REST and through MCP on two projects and asserts identical timeline versions, version chain and plan history.

## Blockers (need you)

1. **No Sarvam key**: live ASR (Telugu, Roman, code-switch, timestamps) is NOT verified. `parseSarvam` was written from memory of the docs, and the `saaras:v4` id and `mode` are unconfirmed. Run `smoke.ts <consented file> sarvam native te --raw out.json`, then send me `out.json` (structure only is enough) and I fix the parser against the real shape.
2. **No Gemini key**: planning quality is NOT verified. Plan lifecycle tests use a scripted test transport (labelled in the test file) to exercise validation and approval; they say nothing about Gemini's output quality. A live Gemini test exists and runs when the key is set.
3. **Phase F not run.** `reel/acceptance/run.ts` performs steps 1 to 10 against a running server with real providers. It needs both keys, a running API with Mongo and Redis, and one consented Telugu/Tenglish recording.
4. **MCP OAuth missing.** Hosted Claude connectors need OAuth 2.1; today a client must send a bearer header. No public https URL either.
5. **UI not browser-tested.** It type-checks and builds; nobody has clicked through it.

## Known limits

Story selection keeps source order (hook not moved to the front; a warning says so). The MCP cannot upload binaries (use the web app or REST). Speaker labels are not requested from Sarvam. No object storage or separate worker yet. Billing and per-provider cost are not implemented.
