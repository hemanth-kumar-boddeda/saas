// Instagram Graph API (Reels) via Facebook Login. Works in Meta test mode with app roles/testers.
import ErrorHandler from "./ErrorHandler";

const V = "v21.0";
const G = `https://graph.facebook.com/${V}`;
const need = (n: string) => {
  const v = process.env[n];
  if (!v) throw new ErrorHandler(503, `Instagram is not configured (${n} missing)`);
  return v;
};
export const redirectUri = () => `${(process.env.PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "")}/v1/social/instagram/callback`;

export const authUrl = (state: string) =>
  `https://www.facebook.com/${V}/dialog/oauth?` +
  new URLSearchParams({
    client_id: need("META_APP_ID"), redirect_uri: redirectUri(), state,
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
  });

const graph = async (path: string, params: Record<string, string>, method = "GET") => {
  const qs = new URLSearchParams(params);
  const r = await fetch(method === "GET" ? `${G}${path}?${qs}` : `${G}${path}`, { method, body: method === "GET" ? undefined : qs });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new ErrorHandler(502, `Instagram ${path} failed: ${j.error?.message ?? r.status}`);
  return j;
};

/** Code -> long-lived (~60 day) user token -> first Instagram business account on the user's Pages. */
export const exchangeCode = async (code: string) => {
  const short = await graph("/oauth/access_token", { client_id: need("META_APP_ID"), client_secret: need("META_APP_SECRET"), redirect_uri: redirectUri(), code });
  const long = await graph("/oauth/access_token", {
    grant_type: "fb_exchange_token", client_id: need("META_APP_ID"), client_secret: need("META_APP_SECRET"), fb_exchange_token: short.access_token,
  });
  const pages = await graph("/me/accounts", { fields: "name,instagram_business_account{id,username}", access_token: long.access_token });
  const page = (pages.data ?? []).find((p: any) => p.instagram_business_account);
  if (!page) throw new ErrorHandler(409, "No Instagram professional account is linked to a Facebook Page on this login");
  return {
    accessToken: String(long.access_token), expiresIn: Number(long.expires_in) || 60 * 24 * 3600,
    externalId: String(page.instagram_business_account.id), name: String(page.instagram_business_account.username ?? page.name),
  };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const publishReel = async (a: { token: string; igId: string; videoUrl: string; coverUrl?: string; caption: string }) => {
  const c = await graph(`/${a.igId}/media`, {
    media_type: "REELS", video_url: a.videoUrl, caption: a.caption, share_to_feed: "true",
    ...(a.coverUrl ? { cover_url: a.coverUrl } : {}), access_token: a.token,
  }, "POST");
  for (let i = 0; i < 120; i++) { // up to ~10 min
    const s = await graph(`/${c.id}`, { fields: "status_code,status", access_token: a.token });
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new ErrorHandler(502, `Instagram could not process the video: ${s.status ?? s.status_code}`);
    await sleep(5000);
    if (i === 119) throw new ErrorHandler(504, "Instagram took too long to process the video");
  }
  const p = await graph(`/${a.igId}/media_publish`, { creation_id: c.id, access_token: a.token }, "POST");
  const m = await graph(`/${p.id}`, { fields: "permalink", access_token: a.token }).catch(() => ({}));
  return { id: String(p.id), url: m.permalink as string | undefined };
};
