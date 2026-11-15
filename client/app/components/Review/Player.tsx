"use client";
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Hls from "hls.js";

export interface PlayerHandle {
  seek: (t: number) => void;
  time: () => number;
}

const apiOrigin = () => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000").origin;
  } catch {
    return "http://localhost:8000";
  }
};

/** Streaming-only player: no download control, no context menu. Deters casual saving only. */
const Player = forwardRef<PlayerHandle, { src: string; onTime?: (t: number) => void }>(({ src, onTime }, ref) => {
  const video = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => ({
    seek: (t) => {
      if (video.current) video.current.currentTime = t;
    },
    time: () => video.current?.currentTime ?? 0,
  }));

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const url = apiOrigin() + src;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(el);
      return () => hls.destroy();
    }
    el.src = url; // Safari plays HLS natively
  }, [src]);

  return (
    <video
      ref={video}
      controls
      playsInline
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)}
      className="w-full rounded-lg bg-black aspect-video"
    />
  );
});
Player.displayName = "Player";
export default Player;
