"use client";
import React from "react";
import { youtubeId } from "./YouTubePlayer";

/** Instagram post/reel/tv id from a public link. */
export const instagramId = (url?: string): { kind: string; id: string } | null => {
  try {
    const u = new URL(url || "");
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null;
    const m = /^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/.exec(u.pathname);
    return m ? { kind: m[1] === "reels" ? "reel" : m[1], id: m[2] } : null;
  } catch {
    return null;
  }
};

/** Instagram's own embed. It cannot report playback time, so comments use manual timecodes. */
export function InstagramEmbed({ url }: { url: string }) {
  const ig = instagramId(url);
  if (!ig) return null;
  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl bg-white ring-1 ring-white/10 shadow-2xl shadow-black/60">
      <iframe title="Instagram video" src={`https://www.instagram.com/${ig.kind}/${ig.id}/embed`} className="h-[560px] w-full" loading="lazy" allow="encrypted-media; fullscreen" />
    </div>
  );
}

/** Reference or link preview: YouTube and Instagram play in place, anything else opens in a new tab. */
export function LinkPreview({ url }: { url: string }) {
  const yt = youtubeId(url);
  if (yt) return <iframe title="YouTube reference" src={`https://www.youtube.com/embed/${yt}?rel=0`} className="aspect-video w-full rounded-xl" allow="encrypted-media; fullscreen" loading="lazy" />;
  if (instagramId(url)) return <InstagramEmbed url={url} />;
  return <a className="break-all underline" href={url} target="_blank" rel="noreferrer noopener">{url}</a>;
}
