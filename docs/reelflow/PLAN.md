# ReelFlow phased implementation plan

Principle: one engine, three interfaces. All editing capability lives in a typed service layer (`server/reel/`). REST, the MCP server and the agent all call the same operations. Nothing is simulated: each operation runs ffmpeg, the transcriber or a configured model.

## Architecture

```
Web studio ─┐
Claude (MCP)┼─► typed operations (zod in/out, ownership checks, job records) ─► engine
REST API ───┘                                                                  ├─ edit format + ops (pure, tested)
Agent (provider-agnostic tool loop) ──► same operations                        ├─ analysis (probe, silence, transcript)
                                                                               └─ RenderProvider (ffmpeg adapter first)
```

- `server/reel/schema.ts`: canonical edit format v1 (zod). Sources, clips with source in/out, tracks (video, audio, caption, overlay), keyframes, transitions, effects, and an output-to-source map. Versioned with `schemaVersion` and a migration hook.
- `server/reel/ops.ts`: pure functions (trim, split, remove range, reorder, set caption style, set audio). Each returns a new edit plus a diff. Fully unit tested.
- `server/reel/render/provider.ts`: `RenderProvider { render(edit, opts) }`. `ffmpeg.ts` is the first adapter. The agent never imports ffmpeg.
- `server/reel/jobs.ts`: one `Job` collection (`queued`, `running`, `succeeded`, `failed`, `needs_approval`), progress, error, result refs. BullMQ runs them.
- `server/reel/operations/*`: the 20 named operations as plain async functions.
- `server/reel/agent/`: orchestrator, tool registry generated from operations, skill loader. Model through the existing `aiProviders` layer.
- `server/reel/skills/*.md`: the 12 specialist skills (instructions, decision rules, tool references).
- `server/mcp/`: streamable-HTTP MCP server exposing the operations as tools.

## Phases

| Phase | Delivers | Exit test |
|---|---|---|
| 0 | Audit, plan, decisions confirmed (this document) | Written and agreed |
| 1 | Edit format, ops, ffmpeg render adapter, job model, API tokens | Unit tests; a hand-written edit renders to a playable mp4 |
| 2 | Talking-head slice, services: analyze, transcribe, detect best segments, plan, captions, audio enhance, render preview, versions, revision, approve | Real run on real speech, see the demo below |
| 3 | REST API under `/v1/reel` with docs, confirmation gates for destructive and publishing actions | Integration tests, ownership tests |
| 4 | Agent orchestrator and the 12 skills, replaceable provider | Agent completes the demo from a natural-language brief |
| 5 | Hosted MCP server, OAuth or token auth, Claude skill package | Claude drives the demo end to end through MCP |
| 6 | Studio UI: media, chat, preview, editable timeline, manual controls, versions, comments, approval, publish | Browser run of the demo, manual trim in the timeline |
| 7 | Multicamera, podcast, b-roll, motion graphics, multilingual, search | Per-skill acceptance clips |

## Smallest working end-to-end slice (phases 1 and 2)

One talking-head video:

1. Upload, registers a media asset (existing upload, new asset record).
2. Analyze: `ffprobe`, `silencedetect`, audio loudness, scene stats.
3. Transcribe: real timed segments from the configured provider.
4. Select story: the model picks the segments that make a tight 30 to 60 second cut. Output validated by zod, rejected if timecodes fall outside the source.
5. Edit: the plan becomes an edit (cuts and ordering, silence trimmed).
6. Caption: captions from the transcript, drawn as PNG overlays (this ffmpeg has no `subtitles` or `drawtext`).
7. Enhance audio: `afftdn` then `loudnorm`.
8. Build timeline: the canonical edit.
9. Render preview: ffmpeg adapter, 720p mp4, HLS for the existing player.
10. Revision: instruction like "make it shorter and remove the intro" becomes a new edit version (new `ProjectVersion`).
11. Approve and export: existing approval, then download or publish package.

Test footage: macOS `say` generates real speech, combined with ffmpeg video, so the run is repeatable without third-party media.

## Decisions needed before Phase 1

1. A real model key (Gemini or Groq are free). Without it steps 3, 4 and 10 cannot run for real.
2. Naming: keep the CreatorFlow brand in the UI for now, or rename to ReelFlow everywhere.
3. MCP exposure: build locally first and test with the MCP inspector and Claude Desktop, then host (needs a public https URL).

## Out of scope for the first slice

Full NLE, multicamera, motion graphics library, multilingual dubbing, vendor render adapters other than ffmpeg, object storage, billing.
