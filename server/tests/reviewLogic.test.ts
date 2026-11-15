import { describe, it, expect } from "vitest";
import {
  can,
  decideApproval,
  statusAfterNewVersion,
  statusAfterPublish,
  nextVersionNumber,
  commentInput,
  validateNewComment,
  filterComments,
  CommentLike,
} from "../services/reviewLogic";

describe("roles", () => {
  it("only owner approves and publishes", () => {
    expect(can("owner", "approve")).toBe(true);
    expect(can("editor", "approve")).toBe(false);
    expect(can("guest", "publish")).toBe(false);
  });
  it("guests comment but cannot resolve or upload", () => {
    expect(can("guest", "comment")).toBe(true);
    expect(can("guest", "resolve")).toBe(false);
    expect(can("guest", "upload_version")).toBe(false);
  });
});

describe("approval", () => {
  it("owner approves latest version", () => {
    expect(decideApproval("in_review", "approve", "owner", true)).toBe("approved");
    expect(decideApproval("in_review", "request_changes", "owner", true)).toBe("changes_requested");
  });
  it("editor and guest cannot decide", () => {
    expect(() => decideApproval("in_review", "approve", "editor", true)).toThrow();
    expect(() => decideApproval("in_review", "approve", "guest", true)).toThrow();
  });
  it("rejects old versions and finished projects", () => {
    expect(() => decideApproval("in_review", "approve", "owner", false)).toThrow();
    expect(() => decideApproval("approved", "approve", "owner", true)).toThrow();
    expect(() => decideApproval("published", "approve", "owner", true)).toThrow();
  });
  it("can re-decide after changes requested", () => {
    expect(decideApproval("changes_requested", "approve", "owner", true)).toBe("approved");
  });
});

describe("status machine", () => {
  it("new version restarts review, published is locked", () => {
    expect(statusAfterNewVersion("changes_requested")).toBe("in_review");
    expect(statusAfterNewVersion("approved")).toBe("in_review");
    expect(() => statusAfterNewVersion("published")).toThrow();
  });
  it("publish only from approved", () => {
    expect(statusAfterPublish("approved")).toBe("published");
    expect(() => statusAfterPublish("in_review")).toThrow();
  });
});

describe("versions", () => {
  it("numbers increment from the max", () => {
    expect(nextVersionNumber([])).toBe(1);
    expect(nextVersionNumber([1, 2, 3])).toBe(4);
    expect(nextVersionNumber([3, 1])).toBe(4);
  });
});

describe("comment validation", () => {
  const version = { _id: "v1", duration: 60 };
  it("schema trims and rejects empty/negative", () => {
    expect(commentInput.parse({ body: "  hi ", timecode: 3 }).body).toBe("hi");
    expect(() => commentInput.parse({ body: "   ", timecode: 3 })).toThrow();
    expect(() => commentInput.parse({ body: "x", timecode: -1 })).toThrow();
    expect(() => commentInput.parse({ body: "x", timecode: NaN })).toThrow();
  });
  it("rejects timecode past duration", () => {
    expect(() => validateNewComment({ body: "x", timecode: 99 }, version)).toThrow();
    expect(() => validateNewComment({ body: "x", timecode: 60 }, version)).not.toThrow();
  });
  it("reply must target a top-level comment on the same version", () => {
    const root: CommentLike = { _id: "c1", versionId: "v1", timecode: 1, status: "open", authorKey: "u1" };
    const reply: CommentLike = { ...root, _id: "c2", parentId: "c1" };
    const input = { body: "x", timecode: 1, parentId: "c1" };
    expect(() => validateNewComment(input, version, root)).not.toThrow();
    expect(() => validateNewComment(input, version, reply)).toThrow();
    expect(() => validateNewComment(input, version, { ...root, versionId: "v2" })).toThrow();
    expect(() => validateNewComment(input, version, null)).toThrow();
  });
});

describe("comment filters", () => {
  const mk = (id: string, t: number, status: "open" | "resolved", who: string, parentId?: string): CommentLike => ({
    _id: id, versionId: "v1", timecode: t, status, authorKey: who, parentId,
  });
  const all = [
    mk("a", 5, "open", "u1"),
    mk("b", 20, "resolved", "u2"),
    mk("c", 30, "open", "u2"),
    mk("r1", 5, "open", "u2", "a"),
    mk("r2", 20, "open", "u1", "b"),
  ];
  it("filters by status, keeping replies of kept roots only", () => {
    const ids = filterComments(all, { status: "open" }, "u1").map((c) => c._id);
    expect(ids).toEqual(["a", "c", "r1"]);
  });
  it("filters mine and time range", () => {
    expect(filterComments(all, { mine: true }, "u2").map((c) => c._id)).toEqual(["b", "c", "r2"]);
    expect(filterComments(all, { fromTime: 10, toTime: 25 }, "u1").map((c) => c._id)).toEqual(["b", "r2"]);
  });
  it("no filter returns everything", () => {
    expect(filterComments(all, {}, "u1")).toHaveLength(5);
  });
});
