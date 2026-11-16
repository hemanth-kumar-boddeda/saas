// Review domain: projects, versions, comments, share links, approval log.
import mongoose, { Schema, Types } from "mongoose";

const ref = (name: string, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required });

const projectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    owner: ref("User"),
    editors: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["in_review", "changes_requested", "approved", "published"],
      default: "in_review",
    },
    currentVersion: { type: Number, default: 0 },
    channel: { type: Schema.Types.ObjectId, ref: "Channel" },
    // What the owner wants changed, plus reference videos for the editor.
    brief: { type: String, maxlength: 5000, default: "" },
    references: [{
      kind: { type: String, enum: ["link", "upload"], required: true },
      title: { type: String, maxlength: 120 },
      url: String, sourceKey: String, hlsKey: String,
      processing: { type: String, enum: ["pending", "ready", "failed"], default: "ready" },
    }],
    // Editors invited by e-mail; they open a magic link, no account needed.
    editorInvites: [{ _id: false, email: String, linkId: Schema.Types.ObjectId, invitedAt: Date }],
  },
  { timestamps: true }
);

const versionSchema = new Schema(
  {
    project: { ...ref("Project"), index: true },
    number: { type: Number, required: true },
    kind: { type: String, enum: ["upload", "link"], required: true },
    // upload: private key under STORAGE_DIR; never exposed to clients.
    sourceKey: String,
    hlsKey: String,
    externalUrl: String,
    processing: { type: String, enum: ["pending", "ready", "failed"], default: "pending" },
    duration: Number,
    uploadedBy: ref("User", false),
    uploadedByName: String,
    note: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);
versionSchema.index({ project: 1, number: 1 }, { unique: true });

const commentSchema = new Schema(
  {
    project: { ...ref("Project"), index: true },
    version: { ...ref("ProjectVersion"), index: true },
    parentId: { type: Schema.Types.ObjectId, ref: "ReviewComment", default: null },
    timecode: { type: Number, required: true, min: 0 },
    // Text is optional when the comment is a voice note.
    body: { type: String, required: function (this: any) { return !this.audioKey; }, maxlength: 2000, default: "" },
    annotation: Schema.Types.Mixed, // { strokes: [{ tool, color, points }] } validated by zod before saving
    audioKey: String, // private path under STORAGE_DIR, never sent to clients
    audioDuration: Number,
    // Speech-to-text of the voice note, filled in after saving. "none" = no transcriber configured.
    transcript: { type: String, maxlength: 4000 },
    transcriptStatus: { type: String, enum: ["pending", "ready", "failed", "none"] },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    // Either a user or a named guest (guestName + link).
    author: { type: Schema.Types.ObjectId, ref: "User" },
    guestName: { type: String, maxlength: 60 },
    authorKey: { type: String, required: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedByName: String,
    // Owner notes stay private drafts until "Send feedback".
    draft: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const linkSchema = new Schema(
  {
    project: { ...ref("Project"), index: true },
    tokenHash: { type: String, required: true, unique: true },
    passwordHash: String,
    expiresAt: Date,
    revoked: { type: Boolean, default: false },
    role: { type: String, enum: ["guest", "editor"], default: "guest" },
    email: String,
    // Editor links only: encrypted raw token so later digests can include the same magic link.
    rawEnc: String,
    createdBy: ref("User"),
  },
  { timestamps: true }
);

const approvalSchema = new Schema(
  {
    project: { ...ref("Project"), index: true },
    version: ref("ProjectVersion"),
    versionNumber: { type: Number, required: true },
    user: ref("User"),
    action: { type: String, enum: ["approve", "request_changes"], required: true },
    note: { type: String, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const model = <T>(name: string, schema: Schema) =>
  (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);

export const Project = model<any>("Project", projectSchema);
export const ProjectVersion = model<any>("ProjectVersion", versionSchema);
export const ReviewComment = model<any>("ReviewComment", commentSchema);
export const ReviewLink = model<any>("ReviewLink", linkSchema);
export const Approval = model<any>("Approval", approvalSchema);
export type Id = Types.ObjectId | string;
