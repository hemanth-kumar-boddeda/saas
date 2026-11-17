# ReelFlow stage 3 report: live validation

Date: 2026-11-17. **Not production-ready.** Live ASR and live planning could not be run: no `SARVAM_API_KEY`, `GEMINI_API_KEY` or `GROQ_API_KEY` exists in `server/.env` or the environment, and no consented Telugu/Tenglish recording was provided. Nothing was mocked to fill that gap.

## Objectives

| # | Objective | Result |
|---|---|---|
| 1 | Live Sarvam Saaras v4 on Telugu audio | **Not run** (no key, no consented audio). `smoke.ts` exits 3 `NOT CONFIGURED`, confirmed |
| 2 | Fix parser from observed responses | **Blocked.** `parseSarvam` is still unverified against the real API |
| 3 | Native Telugu and Tenglish transcription | **Not run.** No transcript quality number exists |
| 4 | Gemini plan quality | **Not run.** Plan machinery is tested with a scripted transport only; says nothing about Gemini |
| 5 | Phase F acceptance | **Not run** (needs 1 and 4). Script ready: `reel/acceptance/run.ts` |
| 6 | Browser verification of the AI Editor | **Done** with Playwright against a throwaway stack (see below) |
| 7 | Non-destructive hook repositioning | **Done** (`move_segment`), unit, integration and real-pixel tests |
| 8 | Tests for every discovered issue | **Done** for all issues found (291 tests pass, `tsc` clean) |

## Bugs found by live use, all fixed with regression tests

1. **`/v1/reel` returned 429 on a normal page load.** It shared the 10/min auth limiter (also shared with login). Now `reelIpLimiter` (600/min/IP) plus `reelPlanLimiter` (30/h per principal). The old plan limiter keyed on `req.user`, which is empty for API tokens, so every token user shared one bucket. Test: `reelRateLimit.test.ts`.
2. **Transcribe and render returned 500.** BullMQ rejects custom job ids containing `:`. My tests mocked the queue, which hid it. Fixed with `queueJobId`; test asserts no colon. Lesson: mocked queue tests do not prove queueing works.
3. **IPv6 key-generator warning** in the new limiters; now uses `ipKeyGenerator`.
4. **Timeline UX:** clicking a clip jumped the cursor to the clip start, so a clip could not be split at a chosen point. Now the cursor goes where you click. Cursor values are rounded to 0.01 s (they were 1.9900249376558603).
5. **Mobile:** horizontal page overflow at 390 px (grid children and long op text). Fixed; overflow check now passes. The timeline scrolls inside its own container by design.
6. **Dock overlapped the bottom controls**; bottom padding added.
7. **Telugu caption font stack** (found in stage 2) is guarded by a test.

## Browser results (Chromium via Playwright, real API, real Mongo/Redis, real ffmpeg)

Passed: login, create project, "Open AI editor" link, upload a 12 s test clip (server probes it, builds v1), timeline display, split at a clicked time (2 clips, v2), mark-in and delete range (v3), vertical 9:16 (v4), render preview job to `succeeded`, rendered video loads in the player at 1080x1920 and 10.07 s, first frame red as expected, approve and lock (shows "Approved"), version history shows chain `v4 ← v3 ← v2 ← v1`, "not configured" shown for Transcribe (`failed · sarvam is not configured: set SARVAM_API_KEY`) and for Plan (toast naming `GEMINI_API_KEY`).

Not covered: plan card interactions (apply, reject, per-op checkboxes) with a real plan, captions on screen, playback of audio, drag editing (there is none), accessibility audit, browsers other than Chromium.

## Usability findings (not fixed)

- Editing is button-driven: no drag to trim, no numeric time entry, no snapping, no undo/redo buttons (history is a version list you click).
- "review v1" in the preview caption is confusing: the render became review version 1 while timeline is v4.
- Preview always shows the last render, not live edits; users must press Render preview after each change.
- After a failed transcribe the UI shows the error text but offers no link to configure the provider.
- Caption editing, caption styling and audio controls from the original brief are not in the UI yet.

## Transcript, editing and render quality

- **Transcript quality:** unknown. No measurement exists.
- **Editing quality:** edit operations are correct in tests and in the browser (durations, linked audio, versions). AI editorial quality (story and hook choice) is unknown.
- **Render quality:** measured, real. Output resolution and duration match the timeline; `moveSegment` verified by pixel colour (blue, red, green in the expected order); loudness measured with ebur128. Subjective visual quality, caption legibility on real footage and long-clip render time were not assessed.

## Hook repositioning

New registry operation `move_segment {from, to, at}` re-cuts and re-places clips on every track (video, linked audio, captions, overlays) with no deletion and no source change; output is a new unapproved timeline version. The story skill now emits it when the chosen hook is not first (`moveHook: false` keeps source order) and warns that the story may no longer make sense. Limitation: only the hook is moved; other kept phrases keep source order; a caption cue straddling a cut is split into two cues.

## Remaining production blockers

1. Live Sarvam verification and a Telugu/Tenglish benchmark on consented recordings (WER, timing error).
2. Live Gemini plan quality review on real transcripts.
3. Phase F acceptance run with real providers, including the Claude-through-MCP step.
4. MCP OAuth 2.1 and a public https URL for hosted Claude connectors.
5. Object storage, a separate render worker, and render time/cost accounting; render runs inside the API process.
6. Editor UI gaps above; no browser test suite runs in CI (scripts are in `reel/acceptance/browser/`).
7. Billing, org-level permissions, usage metering exposure.

## To unblock

Set the keys in `server/.env`, then: `ts-node --transpile-only -P tsconfig.json reel/benchmark/smoke.ts <consented file> sarvam native te --raw /tmp/sarvam.json`. Share the raw file structure so the parser can be fixed against the real response, then run `reel/acceptance/run.ts`.
