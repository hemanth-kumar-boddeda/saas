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
    uploadedBy: ref("User"),
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
    body: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    // Either a user or a named guest (guestName + link).
    author: { type: Schema.Types.ObjectId, ref: "User" },
    guestName: { type: String, maxlength: 60 },
    authorKey: { type: String, required: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
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
