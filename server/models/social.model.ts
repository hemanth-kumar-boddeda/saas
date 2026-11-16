// Connected platform accounts (tokens encrypted at rest) and publications.
import mongoose, { Schema } from "mongoose";

const accountSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["youtube", "instagram"], required: true },
    externalId: { type: String, required: true },
    name: String,
    accessToken: { type: String, required: true }, // AES-GCM blob, never sent to clients
    refreshToken: String,
    expiresAt: Date,
    needsReconnect: { type: Boolean, default: false },
  },
  { timestamps: true }
);
accountSchema.index({ user: 1, provider: 1, externalId: 1 }, { unique: true });

const publicationSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    kit: { type: Schema.Types.ObjectId, ref: "PublishKit", required: true },
    account: { type: Schema.Types.ObjectId, ref: "SocialAccount", required: true },
    provider: { type: String, enum: ["youtube", "instagram"], required: true },
    status: { type: String, enum: ["queued", "publishing", "scheduled", "published", "failed"], default: "queued" },
    privacy: String,
    scheduledAt: Date,
    externalId: String,
    url: String,
    error: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const model = <T>(name: string, schema: Schema) =>
  (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);
export const SocialAccount = model<any>("SocialAccount", accountSchema);
export const Publication = model<any>("Publication", publicationSchema);
