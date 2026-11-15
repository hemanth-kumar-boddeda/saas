// Pure review rules: roles, status machine, versions, comments.
// No DB or HTTP here so every rule is unit-testable (tests/reviewLogic.test.ts).
import { z } from "zod";
import ErrorHandler from "../utils/ErrorHandler";

export type ProjectRole = "owner" | "editor" | "guest";
export type ProjectStatus = "in_review" | "changes_requested" | "approved" | "published";
export type ApprovalAction = "approve" | "request_changes";
export type Permission =
  | "view"
  | "comment"
  | "resolve"
  | "upload_version"
  | "approve"
  | "publish"
  | "manage_links";

const PERMISSIONS: Record<ProjectRole, Permission[]> = {
  owner: ["view", "comment", "resolve", "upload_version", "approve", "publish", "manage_links"],
  editor: ["view", "comment", "resolve", "upload_version"],
  guest: ["view", "comment"],
};

export const can = (role: ProjectRole, permission: Permission): boolean =>
  PERMISSIONS[role].includes(permission);

export const assertCan = (role: ProjectRole, permission: Permission) => {
  if (!can(role, permission)) throw new ErrorHandler(403, "You are not allowed to do this");
};

/** Status after an owner decision. Only the latest version can be decided. */
export const decideApproval = (
  current: ProjectStatus,
  action: ApprovalAction,
  role: ProjectRole,
  isLatestVersion: boolean
): ProjectStatus => {
  assertCan(role, "approve");
  if (!isLatestVersion) throw new ErrorHandler(409, "Only the latest version can be decided");
  if (current === "published") throw new ErrorHandler(409, "Project is already published");
  if (current === "approved") throw new ErrorHandler(409, "Project is already approved");
  return action === "approve" ? "approved" : "changes_requested";
};

/** Uploading a new version restarts review. A published project is locked. */
export const statusAfterNewVersion = (current: ProjectStatus): ProjectStatus => {
  if (current === "published") throw new ErrorHandler(409, "Project is already published");
  return "in_review";
};

/** Publishing is only reachable from approved. */
export const statusAfterPublish = (current: ProjectStatus): ProjectStatus => {
  if (current !== "approved") throw new ErrorHandler(409, "Project must be approved before publishing");
  return "published";
};

export const nextVersionNumber = (existing: number[]): number =>
  existing.length ? Math.max(...existing) + 1 : 1;

export const commentInput = z.object({
  body: z.string().trim().min(1).max(2000),
  timecode: z.number().finite().min(0),
  parentId: z.string().optional(),
});
export type CommentInput = z.infer<typeof commentInput>;

export interface CommentLike {
  _id: string;
  versionId: string;
  parentId?: string | null;
  timecode: number;
  status: "open" | "resolved";
  authorKey: string;
}

/** Validates a new comment against its version and optional parent. */
export const validateNewComment = (
  input: CommentInput,
  version: { _id: string; duration?: number },
  parent?: CommentLike | null
) => {
  if (version.duration && input.timecode > version.duration + 0.5) {
    throw new ErrorHandler(422, "Timecode is beyond the end of the video");
  }
  if (input.parentId) {
    if (!parent || parent.versionId !== version._id) throw new ErrorHandler(404, "Parent comment not found");
    if (parent.parentId) throw new ErrorHandler(422, "Replies cannot be nested");
  }
};

export interface CommentFilter {
  status?: "open" | "resolved";
  mine?: boolean;
  fromTime?: number;
  toTime?: number;
}

/** Filters top-level threads; a thread matches if its root matches. */
export const filterComments = <T extends CommentLike>(
  list: T[],
  filter: CommentFilter,
  viewerKey: string
): T[] =>
  list.filter((c) => {
    if (c.parentId) return true; // replies follow their root, resolved below
    if (filter.status && c.status !== filter.status) return false;
    if (filter.mine && c.authorKey !== viewerKey) return false;
    if (filter.fromTime !== undefined && c.timecode < filter.fromTime) return false;
    if (filter.toTime !== undefined && c.timecode > filter.toTime) return false;
    return true;
  }).filter((c, _i, kept) => !c.parentId || kept.some((r) => String(r._id) === String(c.parentId)));
