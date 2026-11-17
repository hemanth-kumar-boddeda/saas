"use client";

import React, { useEffect, useRef, useState } from "react";

// Notes on the sample clip (4s loop). Made up, but shaped like the real review screen.
const NOTES = [
  { at: 0.9, pin: 0.22, text: "Tighten the intro, the hook lands late.", who: "You · text" },
  { at: 2.0, pin: 0.5, text: "“Keep this framing.”  Voice note, 0:09", who: "You · voice" },
  { at: 3.0, pin: 0.75, text: "Logo circled: move it out of the corner.", who: "You · drawing" },
];

/** The product in motion: a looping clip, a playhead, and comment pins that land at their timestamps. */
export default function HeroStage() {
  const video = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(4);

  useEffect(() => {
    const v = video.current!;
    let raf = 0;
    const loop = () => { setT(v.currentTime); raf = requestAnimationFrame(loop); };
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) { v.pause(); setT(4); } else { raf = requestAnimationFrame(loop); }
    return () => cancelAnimationFrame(raf);
  }, []);

  const shown = NOTES.filter((n) => t >= n.at);
  const last = shown[shown.length - 1];
  const mm = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

  return (
    <figure className="relative overflow-hidden rounded-2xl border border-cf-line bg-black shadow-[0_40px_120px_-40px_rgba(124,92,255,.45)]">
      <video
        ref={video} src="/samples/clip1.mp4" autoPlay muted loop playsInline preload="auto"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 4)}
        className="aspect-video w-full object-cover" aria-label="Sample clip with review notes"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4 text-xs">
        <span className="rounded-full bg-black/55 px-3 py-1.5 font-medium backdrop-blur">Brand reel · v3</span>
        <span className="rounded-full bg-black/55 px-3 py-1.5 tabular-nums backdrop-blur">{mm(t)} / {mm(dur)}</span>
      </div>

      {last && (
        <div key={last.at} className="pointer-events-none absolute bottom-16 left-4 right-4 max-w-sm animate-[hs-pop_.5s_cubic-bezier(.16,1,.3,1)] rounded-xl border border-white/10 bg-black/65 p-3 backdrop-blur-md md:left-8">
          <p className="text-[11px] text-cf-muted">{last.who} · {mm(last.at)}</p>
          <p className="mt-0.5 font-[family-name:var(--font-newsreader)] text-[17px] leading-snug">{last.text}</p>
        </div>
      )}

      <div className="absolute inset-x-4 bottom-5 md:inset-x-8" aria-hidden="true">
        <div className="relative h-1.5 rounded-full bg-white/25">
          <div className="absolute inset-y-0 left-0 rounded-full bg-cf-violet" style={{ width: `${Math.min(100, (t / dur) * 100)}%` }} />
          {NOTES.map((n) => (
            <span key={n.at} className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-amber-400 transition-transform duration-500 ${t >= n.at ? "scale-100" : "scale-0"}`} style={{ left: `${n.pin * 100}%` }} />
          ))}
        </div>
      </div>
      <figcaption className="sr-only">A sample clip. Notes appear on the timeline at the seconds they refer to.</figcaption>
    </figure>
  );
}
