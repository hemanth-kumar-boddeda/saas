"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useState } from "react";
import { ORBIT_ITEMS } from "./reviewItems";

const ReviewOrbit = dynamic(() => import("./ReviewOrbit"), { ssr: false, loading: () => <div className="h-[560px]" aria-busy="true" /> });

/** Wide screens get the WebGL sphere; phones and reduced-motion get a plain grid of the same clips. */
export default function OrbitSection() {
  const [mode, setMode] = useState<"pending" | "orbit" | "grid">("pending");
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const fail = useCallback(() => setMode("grid"), []);
  const pick = useCallback((i: number) => setOpen(i), []);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)"), calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMode(wide.matches && !calm.matches ? "orbit" : "grid");
    sync();
    wide.addEventListener("change", sync); calm.addEventListener("change", sync);
    return () => { wide.removeEventListener("change", sync); calm.removeEventListener("change", sync); };
  }, []);

  useEffect(() => {
    if (open === null) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, close]);

  const item = open === null ? null : ORBIT_ITEMS[open];

  return (
    <section id="orbit" className="cf-scroll-offset overflow-hidden py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="cf-measure">
          <span className="cf-chip">Every review, in one place</span>
          <h2 className="cf-section-heading mt-6 text-cf-text">
            Every video in flight, <span className="font-[family-name:var(--font-newsreader)] font-normal italic">none of them lost.</span>
          </h2>
          <p className="body-3 mt-4 text-cf-muted md:body-1">
            Each tile is a project at a different stage: waiting on you, waiting on the editor, approved, scheduled.
          </p>
        </div>

        <div className="mt-10">
          {mode === "orbit" && <ReviewOrbit onOpen={pick} onFail={fail} />}
          {mode === "grid" && (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {ORBIT_ITEMS.slice(0, 4).map((it, i) => (
                <li key={it.title}>
                  <button className="cf-card block w-full overflow-hidden text-left" onClick={() => pick(i)}>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video src={`/samples/clip${it.clip}.mp4`} muted loop playsInline autoPlay preload="metadata" className="aspect-video w-full object-cover" aria-hidden="true" />
                    <span className="block px-3 pt-2 text-[13px] font-medium">{it.title}</span>
                    <span className="block px-3 pb-3 font-[family-name:var(--font-newsreader)] text-[14px] text-cf-muted">{it.meta}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-4 caption-3 text-cf-muted">Sample clips and project names, made up for illustration.</p>
      </div>

      {item && (
        <div role="dialog" aria-modal="true" aria-label={item.title} className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,8,9,.86)] p-4 backdrop-blur-[14px]" onClick={close}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={`/samples/clip${item.clip}.mp4`} autoPlay muted loop playsInline className="aspect-video w-full rounded-md bg-black" />
            <div className="mt-4 flex items-baseline justify-between gap-4">
              <div>
                <span className="text-[15px] font-medium">{item.title}</span>{" "}
                <span className="font-[family-name:var(--font-newsreader)] text-[15px] text-cf-muted">{item.meta}</span>
              </div>
              <button autoFocus className="cf-btn cf-btn-secondary min-h-[44px] px-4 text-sm" onClick={close}>Close</button>
            </div>
            <p className="mt-2 max-w-[54ch] font-[family-name:var(--font-newsreader)] text-[17px] leading-snug text-[#cfcfcc]">{item.blurb}</p>
          </div>
        </div>
      )}
    </section>
  );
}
