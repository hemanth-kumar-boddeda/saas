// Channel profile (injected into every AI prompt) and the AI publish kit per project version.
import mongoose, { Schema } from "mongoose";

const channelSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    niche: { type: String, maxlength: 200, default: "" },
    tone: { type: String, maxlength: 200, default: "" },
    brand: { primary: String, secondary: String, accent: String },
  },
  { timestamps: true }
);

const kitSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    version: { type: Schema.Types.ObjectId, ref: "ProjectVersion", required: true },
    status: { type: String, enum: ["queued", "running", "ready", "failed"], default: "queued" },
    step: { type: String, default: "queued" },
    error: String,
    transcript: String,
    segments: [{ _id: false, start: Number, end: Number, text: String }],
    titles: [String],
    chosenTitle: { type: Number, default: 0 },
    description: String,
    chapters: [{ _id: false, start: Number, title: String }],
    hashtags: [String],
    tags: [String],
    srt: String,
    // key: path under STORAGE_DIR (never sent to clients); score: 0-100 from frame ranking.
    thumbnails: [{ _id: false, key: String, label: String, text: String, score: Number }],
    chosenThumbnail: { type: Number, default: 0 },
    edited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const model = <T>(name: string, schema: Schema) =>
  (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);

export const Channel = model<any>("Channel", channelSchema);
export const PublishKit = model<any>("PublishKit", kitSchema);
