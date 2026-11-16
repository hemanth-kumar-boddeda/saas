// YouTube OAuth + Data API v3 over fetch (resumable upload, thumbnail, captions).
import fs from "fs";
import { Readable } from "stream";
import ErrorHandler from "./ErrorHandler";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.readonly",
];
const need = (n: string) => {
  const v = process.env[n];
  if (!v) throw new ErrorHandler(503, `YouTube is not configured (${n} missing)`);
  return v;
};
export const redirectUri = () => `${(process.env.PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "")}/v1/social/youtube/callback`;

export const authUrl = (state: string) =>
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: need("GOOGLE_CLIENT_ID"), redirect_uri: redirectUri(), response_type: "code", scope: SCOPES.join(" "),
    access_type: "offline", prompt: "consent", state,
  });

const token = async (params: Record<string, string>) => {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: need("GOOGLE_CLIENT_ID"), client_secret: need("GOOGLE_CLIENT_SECRET"), ...params }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorHandler(r.status === 400 ? 401 : 502, `Google token error: ${j.error || r.status}`);
  return j as { access_token: string; refresh_token?: string; expires_in: number };
};

export const exchangeCode = async (code: string) => {
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${t.access_token}` } });
  const j: any = await r.json().catch(() => ({}));
  const ch = j.items?.[0];
  if (!ch) throw new ErrorHandler(409, "This Google account has no YouTube channel");
  return { ...t, externalId: String(ch.id), name: String(ch.snippet?.title ?? "YouTube channel") };
};
export const refresh = (refreshToken: string) => token({ grant_type: "refresh_token", refresh_token: refreshToken });

const api = async (r: Response, what: string) => {
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorHandler(502, `YouTube ${what} failed (${r.status}): ${j.error?.message ?? ""}`.trim());
  return j;
};

export interface UploadArgs {
  accessToken: string; file: string; title: string; description: string; tags: string[];
  privacy: "public" | "unlisted" | "private"; publishAt?: Date;
}
/** Resumable upload. Scheduled videos upload as private with publishAt; YouTube flips them public. */
export const uploadVideo = async (a: UploadArgs): Promise<{ id: string }> => {
  const size = (await fs.promises.stat(a.file)).size;
  const status: any = { privacyStatus: a.publishAt ? "private" : a.privacy, selfDeclaredMadeForKids: false };
  if (a.publishAt) status.publishAt = a.publishAt.toISOString();
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${a.accessToken}`, "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size), "X-Upload-Content-Type": "video/*",
    },
    body: JSON.stringify({ snippet: { title: a.title, description: a.description, tags: a.tags }, status }),
  });
  if (!init.ok) await api(init, "upload start");
  const loc = init.headers.get("location");
  if (!loc) throw new ErrorHandler(502, "YouTube did not return an upload URL");
  const put = await fetch(loc, {
    method: "PUT",
    headers: { "Content-Length": String(size), "Content-Type": "video/*" },
    body: Readable.toWeb(fs.createReadStream(a.file)) as any,
    duplex: "half",
  } as any);
  return api(put, "upload");
};

export const setThumbnail = async (accessToken: string, videoId: string, jpeg: Buffer) =>
  api(
    await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "image/jpeg" }, body: jpeg,
    }),
    "thumbnail"
  );

export const uploadCaptions = async (accessToken: string, videoId: string, srt: string, language = "en") => {
  const b = "kit" + Date.now();
  const meta = JSON.stringify({ snippet: { videoId, language, name: "Captions", isDraft: false } });
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/octet-stream\r\n\r\n${srt}\r\n--${b}--`;
  return api(
    await fetch("https://www.googleapis.com/upload/youtube/v3/captions?uploadType=multipart&part=snippet", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${b}` }, body,
    }),
    "captions"
  );
};

/** Deletes an uploaded video (used to cancel a scheduled release). Already gone counts as done. */
export const deleteVideo = async (accessToken: string, videoId: string) => {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  if (r.status !== 404) await api(r, "delete");
};
