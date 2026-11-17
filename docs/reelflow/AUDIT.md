# ReelFlow audit of the existing repository

Date: 2026-11-17. Repo: this monorepo (`server/` Express + Mongoose + BullMQ, `client/` Next.js 14). The product is currently branded CreatorFlow in code, copy and docs. "Preserve the existing ReelFlow website" is read as "keep this website".

## 1. Reusable as-is

| Area | Where | Reuse for ReelFlow |
|---|---|---|
| Access control and roles | `server/middleware/projectAccess.ts`, `services/reviewLogic.ts` | Every new endpoint and MCP tool reuses `projectAccess` and `assertCan`. Owner, editor (magic link) and guest roles already exist. |
| Projects, immutable numbered versions | `models/review.model.ts` | Each rendered edit becomes the next `ProjectVersion`, so compare, comments and approval work on AI edits unchanged. |
| Timestamped comments (text, voice, drawing), checklist, approval log | `controllers/review.controller.ts`, `Approval` model | `add_timestamped_comment`, `approve_version`, `create_revision` map onto these. |
| Media ingest and storage | multer upload (1 GB cap), `utils/storage.ts` (local disk, traversal-safe `resolveKey`), signed stream tokens in `utils/reviewTokens.ts` | Source assets and renders. Storage is behind a small surface so S3/R2 can replace it. |
| ffmpeg wrappers | `utils/transcode.ts`: probeDuration, toHls, extractAudio, sampleFrames, frameAt, toMp4, toVoiceM4a, makeSampleVideo | Extend with the render adapter and analysis helpers. |
| Transcription | `utils/ai.ts` `transcribe()` returns timed segments (Groq or OpenAI Whisper, or Gemini audio) | Word and segment timing for captions, story selection and search. |
| Replaceable model layer | `services/aiProviders.ts`, `utils/ai.ts` (Anthropic, Gemini free, Groq free), `askJson` with zod validation and re-ask | Agent planning and segment detection. Provider already swappable by env. |
| Publish kit and SRT | `services/publishKitLogic.ts`, `jobs/publishKit.ts` | `generate_publishing_package` wraps it. |
| Publishing | `jobs/publish.ts`, `utils/youtube.ts`, `utils/instagram.ts`, schedule and cancel | Export and publish step, with the existing confirmation rules. |
| Background jobs | BullMQ queues, in-process workers, Redis | Pattern to follow for render and analyze jobs. |
| Web app | Review screen, HLS player, Compare, change checklist, dock nav, landing | Becomes the studio shell. |
| Tests | 202 vitest tests, hand-rolled `fakeModel` | Same pattern for every new module. |

## 2. Verified environment facts

- ffmpeg 9.0.2 with libx264 and aac. Filters present: `loudnorm`, `afftdn`, `silenceremove`, `overlay`, `concat`, `xfade`, `acrossfade`, `atempo`, `amix`, `crop`, `scale`, `select`.
- Filters missing: `subtitles` and `drawtext` (no libass or freetype). Burned-in captions must be drawn as PNG overlays (sharp is installed) or ffmpeg replaced with a fuller build.
- No AI key is set (GEMINI, GROQ, ANTHROPIC, OPENAI all empty in `server/.env`). Real transcription and real planning cannot run until one is added.
- `@modelcontextprotocol/sdk` 1.32.x is available on npm and is not installed yet.
- Node 20.20, 14 CPU cores locally.

## 3. Missing infrastructure

1. **Canonical edit format.** No timeline, clip, track or caption model exists.
2. **Editing engine.** No pure edit operations, no validation, no render path from an edit to a video.
3. **Render provider interface.** Only direct ffmpeg calls inside controllers.
4. **Generic job tracking.** Jobs exist per feature (kit, publish) with no shared state model for analyze, render and agent steps.
5. **Typed operation layer.** Business logic sits inside Express controllers, so it cannot yet be shared by REST, MCP and the agent.
6. **Machine auth.** Auth is cookie JWT plus magic links. There are no API tokens or OAuth for MCP and developer API.
7. **MCP server.** Does not exist. Claude remote connectors need a public https URL and OAuth or bearer auth.
8. **Agent orchestrator and skill library.** Do not exist.
9. **Upload sessions.** Single multipart upload only. No resumable or chunked sessions, no per-asset registry.
10. **Footage search.** No index. Transcript text search is the realistic first version.
11. **Studio UI.** No chat panel, no editable timeline, no manual controls.
12. **Production infra.** Local-disk storage and in-process render are fine for the demo. Hosted use needs object storage and a separate render worker.

## 4. Risks

- Long renders must not run in the API process in production.
- Hosted MCP needs OAuth 2.1 flows, a public URL and abuse limits before real users.
- "No simulated AI" is blocked until a real model key exists.
- Rebranding CreatorFlow to ReelFlow touches copy, metadata, emails and docs. Not done in this plan unless approved.
