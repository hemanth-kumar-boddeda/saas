// Real Mongoose schema rules (validateSync needs no database). The fake model in other tests cannot enforce these.
import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { ReviewComment } from "../models/review.model";

const base = () => ({ project: new mongoose.Types.ObjectId(), version: new mongoose.Types.ObjectId(), timecode: 3, authorKey: "u:1" });

describe("ReviewComment schema", () => {
  it("text comments need a body", () => {
    expect(new ReviewComment({ ...base(), body: "" }).validateSync()?.errors.body).toBeTruthy();
    expect(new ReviewComment({ ...base(), body: "fix this" }).validateSync()).toBeUndefined();
  });
  it("voice comments may have no text, but only when audio is attached", () => {
    expect(new ReviewComment({ ...base(), body: "", audioKey: "projects/p/voice/c.m4a", audioDuration: 4 }).validateSync()).toBeUndefined();
    expect(new ReviewComment({ ...base(), audioDuration: 4 }).validateSync()?.errors.body).toBeTruthy();
  });
  it("drafts default to false so old comments stay visible", () => {
    expect(new ReviewComment({ ...base(), body: "x" }).draft).toBe(false);
  });
});
