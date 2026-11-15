// SEC-04 — explicit safe user projection.
// The password hash must never leave the database: not in a response body,
// not in a Redis session, not in a log line. Every outward-facing user shape
// goes through this function.

export interface ISafeUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  avatar: { public_id?: string; url?: string };
  videos: Array<{ videoId: string }>;
}

const toId = (value: any): string =>
  value && typeof value.toString === "function" ? value.toString() : String(value ?? "");

export const toSafeUser = (user: any): ISafeUser => {
  const videos = Array.isArray(user?.videos)
    ? user.videos.map((entry: any) => ({
        // Legacy rows stored the purchased video id either under `videoId` or
        // as the sub-document `_id`; both are accepted, new writes use videoId.
        videoId: String(entry?.videoId ?? entry?._id ?? ""),
      }))
    : [];

  return {
    _id: toId(user?._id),
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "user",
    isVerified: Boolean(user?.isVerified),
    avatar: {
      public_id: user?.avatar?.public_id,
      url: user?.avatar?.url,
    },
    videos,
  };
};

// Ownership check that tolerates the legacy stored shapes (see toSafeUser).
export const userOwnsVideo = (user: any, videoId: string): boolean => {
  if (!user || !videoId) return false;
  const list = Array.isArray(user.videos) ? user.videos : [];
  const target = String(videoId);
  return list.some((entry: any) => {
    const stored = entry?.videoId ?? entry?._id;
    return stored !== undefined && String(stored) === target;
  });
};
