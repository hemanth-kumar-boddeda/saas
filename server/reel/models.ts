// Reel domain models. Kept relational in shape (explicit ids, no deep nesting except the timeline
// doc) so a later Postgres move is a copy, not a redesign.
import mongoose, { Schema } from "mongoose";

const ref = (name: string, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required });
const model = <T>(name: string, schema: Schema) =>
  (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);

const assetSchema = new Schema(
  {
    project: { ...ref("Project"), index: true },
    owner: ref("User"),
    kind: { type: String, enum: ["video", "audio", "image"], required: true },
    storageKey: { type: String, required: true }, // private; never sent to clients
    originalName: { type: String, maxlength: 200 },
    duration: Number, width: Number, height: Number, hasAudio: Boolean,
    probe: Schema.Types.Mixed, // measured ffprobe/loudness/silence data
  },
  { timestamps: true }
);

// One row per timeline version. Rows are never updated except `approved` (false -> true once)
// and `renders`. An edit writes a NEW row.
const timelineSchema = new Schema(
  {
    project: { ...ref("Project"), index: true },
    version: { type: Number, required: true, immutable: true },
    parent: { type: Number, default: null, immutable: true },
    doc: { type: Schema.Types.Mixed, required: true, immutable: true }, // validated Timeline
    approved: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: ref("User", false),
    summary: { type: String, maxlength: 500 },
    renders: [{ _id: false, quality: String, storageKey: String, projectVersion: Number, at: Date }],
  },
  { timestamps: true }
);
timelineSchema.index({ project: 1, version: 1 }, { unique: true });

const transcriptSchema = new Schema(
  {
    asset: { ...ref("MediaAsset"), index: true },
    project: ref("Project"),
    provider: { type: String, required: true },
    model: String,
    language: String,
    script: { type: String, enum: ["native", "roman", "latin"], default: "native" },
    text: String,
    words: [{ _id: false, w: String, roman: String, start: Number, end: Number, conf: Number, speaker: String, lang: String }],
  },
  { timestamps: true }
);

export const JOB_TYPES = ["probe", "transcribe", "render", "plan", "quality"] as const;
export const JOB_STATES = ["queued", "running", "succeeded", "failed", "needs_approval", "cancelled"] as const;
const jobSchema = new Schema(
  {
    project: { ...ref("Project"), index: true },
    owner: ref("User"),
    type: { type: String, enum: JOB_TYPES, required: true },
    state: { type: String, enum: JOB_STATES, default: "queued", index: true },
    input: Schema.Types.Mixed,
    result: Schema.Types.Mixed,
    error: String,
    progress: { type: Number, default: 0, min: 0, max: 1 },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 2 },
    // status shown when a provider key is missing; not a failure of the user's request
    providerStatus: { type: String, enum: ["ok", "not_configured"], default: "ok" },
    startedAt: Date, finishedAt: Date,
  },
  { timestamps: true }
);

const tokenSchema = new Schema(
  {
    owner: { ...ref("User"), index: true },
    name: { type: String, required: true, maxlength: 60 },
    tokenHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true }, // first chars, shown in the UI
    scopes: [{ type: String, enum: ["reel:read", "reel:write", "reel:render"] }],
    revoked: { type: Boolean, default: false },
    expiresAt: Date,
    lastUsedAt: Date,
  },
  { timestamps: true }
);

const usageSchema = new Schema(
  {
    owner: { ...ref("User"), index: true },
    project: ref("Project", false),
    kind: { type: String, enum: ["render_seconds", "asr_seconds", "model_tokens", "storage_bytes"], required: true },
    units: { type: Number, required: true },
    costUsd: Number, // null when the provider price is unknown; never guessed
    provider: String,
    jobId: { type: Schema.Types.ObjectId, ref: "ReelJob" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const MediaAsset = model<any>("MediaAsset", assetSchema);
export const ReelTimeline = model<any>("ReelTimeline", timelineSchema);
export const Transcript = model<any>("Transcript", transcriptSchema);
export const ReelJob = model<any>("ReelJob", jobSchema);
export const ApiToken = model<any>("ApiToken", tokenSchema);
export const UsageEvent = model<any>("UsageEvent", usageSchema);
