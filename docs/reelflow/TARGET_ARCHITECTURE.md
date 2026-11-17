# ReelFlow: target architecture

One engine, three interfaces (web, MCP, REST). All editing capability lives in a typed operation layer. No interface calls ffmpeg or a model directly.

```
Next.js studio ─┐
Claude via MCP ─┼─► operations (zod in/out, authz, job records) ─► engine
REST /v1/reel ──┘                                                  ├─ timeline + ops (pure, versioned)
Agent loop ────────► same operations                               ├─ analysis requests ─┐
                                                                    └─ RenderProvider ───┤
                                                                                         ▼
                     Node API (Express, Mongo/Postgres, Redis) ◄─ signed webhooks ─ Python media service (FastAPI)
                                   │                                                     │
                                   └──────────── shared object storage (S3/R2) ──────────┘
```

## Components

| Component | Responsibility | Tech |
|---|---|---|
| `client/` studio | Dashboard, projects, media, editor, review, publishing | Next.js 14 (existing) |
| `server/reel/` | Timeline schema, pure edit ops, operations, jobs, agent, skills | TypeScript, zod |
| `server/mcp/` | MCP tools = operations. Bearer/OAuth auth | `@modelcontextprotocol/sdk`, streamable HTTP |
| `media-service/` | ffprobe, silence/scene analysis, ASR, diarization, word alignment, render | Python 3.12, FastAPI, ffmpeg |
| Object storage | Source assets, renders, caption PNGs | Local disk driver now, S3-compatible driver later |
| Queue | Persistent jobs | BullMQ + Redis (existing) |

## Boundaries and contracts

- Node to Python: authenticated HTTP (shared HMAC or service token, rotated by env). Python to Node: signed webhook. No shared filesystem paths; both sides address media by **storage key** (`projects/<id>/assets/<assetId>/source.mp4`) and use presigned URLs or the shared bucket.
- Idempotency: every request carries `jobId`; the service returns the existing result on repeat.
- Contracts (JSON, versioned `v1`): `registerMedia`, `probe`, `transcribe`, `analyzeVisual`, `renderTimeline`, `getJob`, `qualityCheck`. Defined in `AI_EDITING_ENGINE_SPEC.md`.
- Python service holds no user data model and no auth for end users. Node owns identity, permissions, billing and versions.

## Data model additions

`MediaAsset` (key, kind, duration, probe, language), `Timeline` (project, `version` int, `schemaVersion`, `doc`, `approved` bool, `parent`), `Job` (type, state, progress, input/output refs, error, attempts, cost), `Transcript` (asset, provider, language, words[]), `ApiToken` (hash, scopes, org), `UsageEvent` (org, kind, units, cost). A `Timeline` row is write-once. An edit creates a new row. A render creates a `ProjectVersion`, which keeps comments, compare and approval working unchanged.

## Auth

Web keeps cookie JWT. Machine access uses scoped API tokens (hashed at rest), then OAuth 2.1 for hosted MCP. Every operation takes a principal `{userId, orgId, scopes}` and calls the existing `assertCan`. Org-level permissions are a new layer above project roles.

## Key decisions

1. **Keep MongoDB for the first slice.** The code is Mongo. Postgres migration is its own project (`MIGRATION_PLAN.md`). New collections are written with relational discipline (explicit ids, no deep nesting except the timeline doc) so they port.
2. **Timeline is the IP, renderer is a plug.** `RenderProvider { render(timeline, opts) }`; ffmpeg adapter first, Shotstack adapter evaluated later by translating the canonical timeline. Never store Shotstack JSON as the source of truth.
3. **Captions as PNG overlays** until ffmpeg with libass exists. Python service ships a Docker image with a full ffmpeg, which removes this limit for production.
4. **ASR behind a provider port.** Sarvam, Google STT, faster-whisper adapters. Chosen by benchmark (Stage 5), not by default.
5. **Approved timeline is immutable.** Approve marks a row `approved`; further edits fork a child.
6. **Cost accounting from day one.** Each job writes a `UsageEvent` (render seconds, ASR minutes, model tokens).
7. **Product split.** Studio and Developer are the same codebase; Developer is gated by token scopes and metered by `UsageEvent`.

## Navigation (Stage 1)

Dashboard, My Projects, Media Library, AI Editor, Review & Approval, Brand Kit, Publishing Studio, Analytics, Integrations, Billing. Existing review pages map to My Projects and Review & Approval. Billing, Brand Kit, Analytics, Integrations ship as honest "not yet available" pages until backed by real data.

## Deployment

Dev: Node, Redis, Mongo, Python service on localhost, local-disk storage. Hosted: Node + worker containers, Python service container(s) with full ffmpeg, S3-compatible bucket, Redis, managed DB, public https for MCP.
