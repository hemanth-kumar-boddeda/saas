// Local-disk storage behind a tiny surface so S3/R2 can replace it later.
import path from "path";
import fs from "fs";

export const storageRoot = () => path.resolve(process.env.STORAGE_DIR || "storage");
export const tmpDir = () => {
  const d = path.join(storageRoot(), "tmp");
  fs.mkdirSync(d, { recursive: true });
  return d;
};
export const versionDir = (projectId: string, versionNumber: number) =>
  path.join(storageRoot(), "projects", projectId, `v${versionNumber}`);
/** Resolves a key under the storage root; throws on traversal. */
export const resolveKey = (key: string) => {
  const full = path.resolve(storageRoot(), key);
  if (!full.startsWith(storageRoot() + path.sep)) throw new Error("bad storage key");
  return full;
};
