"use client";
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { PlayerHandle } from "./Player";

/** Video id from youtu.be / youtube.com watch, embed, shorts and live links. */
export const youtubeId = (url?: string): string | null => {
  try {
    const u = new URL(url || "");
    const h = u.hostname.replace(/^(www|m)\./, "");
    if (h === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (h === "youtube.com" || h === "youtube-nocookie.com") {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = /^\/(embed|shorts|live)\/([\w-]{6,})/.exec(u.pathname);
      return m ? m[2] : null;
    }
  } catch {}
  return null;
};

let apiReady: Promise<any> | null = null;
const loadApi = () =>
  (apiReady ??= new Promise((resolve) => {
    const w = window as any;
    if (w.YT?.Player) return resolve(w.YT);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(w.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }));

/** Embedded YouTube player exposing the same handle as the HLS player, so comments get exact timecodes. */
const YouTubePlayer = forwardRef<PlayerHandle, { videoId: string; onTime?: (t: number) => void; onDuration?: (d: number) => void }>(
  ({ videoId, onTime, onDuration }, ref) => {
    const host = useRef<HTMLDivElement>(null);
    const player = useRef<any>(null);
    useImperativeHandle(ref, () => ({
      seek: (t) => player.current?.seekTo?.(t, true),
      time: () => player.current?.getCurrentTime?.() ?? 0,
      pause: () => player.current?.pauseVideo?.(),
      play: () => player.current?.playVideo?.(),
    }));
    useEffect(() => {
      let timer: any;
      let dead = false;
      loadApi().then((YT) => {
        if (dead || !host.current) return;
        const mount = document.createElement("div");
        host.current.appendChild(mount);
        player.current = new YT.Player(mount, {
          videoId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: () => {
              onDuration?.(player.current.getDuration?.() || 0);
              timer = setInterval(() => onTime?.(player.current?.getCurrentTime?.() ?? 0), 250);
            },
          },
        });
      });
      return () => {
        dead = true;
        clearInterval(timer);
        try { player.current?.destroy?.(); } catch {}
        player.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);
    return <div ref={host} className="aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-2xl shadow-black/60 [&_iframe]:h-full [&_iframe]:w-full" />;
  }
);
YouTubePlayer.displayName = "YouTubePlayer";
export default YouTubePlayer;
