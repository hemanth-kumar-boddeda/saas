# ReelFlow: AI editing engine spec (v1 draft)

## 1. Canonical timeline (`schemaVersion: 1`)

```ts
Timeline {
  schemaVersion: 1
  project: string; version: number; parent: number | null
  approved: boolean            // approved rows are immutable
  output: { width: 1080; height: 1920; fps: 30 }   // also 1920x1080, 1080x1080
  sources: { [sourceId]: { storageKey, duration, hasAudio, language? } }
  tracks: Track[]
}
Track = { id, kind: "video" | "audio" | "caption" | "overlay", clips: Clip[] }
Clip  = { id, sourceId?, start, duration,        // position on timeline, seconds
          in?, out?,                              // source range, seconds
          transform?: { x, y, scale, rotation, crop? },
          keyframes?: { t, prop, value, ease }[],
          transition?: { type: "cut"|"fade"|"xfade", duration },
          audio?: { gainDb, fadeIn, fadeOut, enhance?: "dialogue" },
          caption?: { words: {w,start,end,speaker?}[], script: "native"|"roman", style },
          text?: { value, style }, group?: string }
```

Invariants checked by `validate(timeline)`: clips on one track do not overlap, `in < out <= source.duration`, `duration = (out-in)/speed`, ids unique, referenced sources exist, caption word times inside clip, total duration > 0. Validation failure rejects the operation; nothing partial is saved.

## 2. Edit operations (pure: `(timeline, args) => {timeline, diff}`)

`trimClip`, `splitClip`, `removeRange` (ripple), `removeSilences(threshold, minGap)`, `reorderClips`, `switchCamera(at, toSource)`, `reframeVertical(subjectTrack)`, `setTransform`, `addKeyframe`, `setTransition`, `addCaptions(transcript, style, script)`, `editCaptionWord`, `setAudio(gain, enhance)`, `addOverlay`, `addBroll(source, at, duration)`. Each returns a new row with `parent` set; the old row is untouched.

Natural-language edits ("change camera at 00:12, lower music at 00:18") become a list of these ops through the agent (§5). Ops with unresolvable references fail validation instead of guessing.

## 3. Render provider

```ts
interface RenderProvider {
  name: string
  render(t: Timeline, o: { quality: "preview"|"final"; format }): Promise<{ jobId }>
  status(jobId): Promise<{ state, progress, outputKey?, error?, cost? }>
}
```
Adapters: `ffmpeg` (first), `shotstack` (evaluate: map canonical timeline to its JSON, compare cost and quality on the same timeline before adopting). Provider output is a storage key; Node then registers a `ProjectVersion`.

ffmpeg plan: per-clip `trim`/`atrim` + `setpts`, `crop`+`scale` for 9:16, `concat`/`xfade`, caption PNG sequence via `overlay=enable='between(t,a,b)'`, audio `afftdn` then `loudnorm=I=-16:TP=-1.5`. Preview 720p CRF 28, final 1080p CRF 20.

## 4. Media service contract (`/v1`, bearer service token, JSON)

| Endpoint | In | Out |
|---|---|---|
| `POST /probe` | `{jobId, storageKey}` | `{duration, streams, loudness, silences[], scenes[]}` |
| `POST /transcribe` | `{jobId, storageKey, provider?, languageHint?, diarize, script}` | job; webhook delivers `Transcript` |
| `POST /analyze-visual` | `{jobId, storageKey, sampleEvery}` | `{frames[{t,faces,shotType}]}` |
| `POST /render` | `{jobId, timeline, quality}` | job; output written to storage |
| `GET /jobs/{id}` | | `{state, progress, result?, error?}` |
| `POST /quality-check` | `{jobId, storageKey, expected}` | `{checks[{name,pass,measured}]}` (real ffprobe/loudness measurements) |
| `GET /health` | | `{ok, ffmpeg, filters[]}` |

Webhook to Node: `POST /internal/reel/webhook`, header `X-Reel-Signature: HMAC-SHA256(body, secret)` and `X-Reel-Timestamp` (reject if older than 5 min). Job states: `queued, running, succeeded, failed, needs_approval, cancelled`; retry with backoff, max attempts per type.

## 5. Agent

Loop: plan (structured JSON, zod-validated) → select tools → run operations as jobs → observe results → continue or ask for approval. Provider via existing `askJson`/`aiProviders`. Plans, tool calls, results and approvals are stored as `AgentRun` history. Destructive, publishing and cost-heavy steps pause in `needs_approval`.

Skills (`server/reel/skills/*.md`): creative-director, telugu-editor, tenglish-editor, story-editor, talking-head-editor, multicamera-editor, caption-specialist, audio-engineer, broll-specialist, motion-graphics, quality-controller, publishing-specialist. Each holds editorial rules and which operations to call. Skills never execute anything.

## 6. Regional language (Telugu / Tenglish)

Transcript = `{provider, language, words[{w,start,end,conf,speaker?,lang?}]}`. Caption script is a render option: native Telugu script or Roman. Code-switch tagging per word. Provider port: `transcribe(audio, opts) → Transcript`. Candidates: Sarvam, Google STT, faster-whisper.

Benchmark (required before choosing a default): at least 10 consented creator recordings, 5 min each, human-corrected references, measure WER/CER on Telugu and Tenglish, word-timing error (ms) against hand-marked boundaries, and cost per minute. No quality number is published that was not measured on this set.

## 7. Quality control (real measurements only)

Checks run on the rendered file: resolution and fps, duration vs timeline, audio integrated loudness (LUFS), true peak, silent gaps, caption word-time vs ASR word-time delta, black-frame detection. A check reports `measured` and `threshold`. If a tool cannot measure something, the check is `not_measured`, never a pass.

## 8. Publishing package

Three title options, description, hashtags, SEO tags, thumbnail frame candidates (from scored real frames), per-platform export presets (Reels 9:16, Shorts 9:16, YouTube 16:9). Existing `publishKitLogic.ts` is the base. No claim of predicted reach or virality.

## 9. Acceptance test mapping

The 17 steps in the brief map to: auth (exists) → `createProject` → upload + `registerMedia` → `/transcribe` → story/hook selection (agent) → `removeSilences` → `reframeVertical` → `addCaptions` → `setAudio(enhance)` → timeline row → `/render` → preview via HLS → existing comments → MCP `reviseTimeline` → new `ProjectVersion` → existing approve → export + publish kit. Passing requires a real recording, a real ASR key and a real render. Nothing is mocked in the acceptance run.
