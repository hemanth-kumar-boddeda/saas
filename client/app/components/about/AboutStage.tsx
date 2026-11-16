"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BLOCKS, Block, HEADLINE, Row, SUBLINE } from "./aboutBlocks";

const ChromeBot = dynamic(() => import("./ChromeBot"), { ssr: false });
const SERIF = "font-[family-name:var(--font-newsreader)]";

const rowCls: Record<Row["kind"], string> = {
  head: "text-xs font-medium text-cf-muted",
  body: `${SERIF} w-[320px] text-[22px] font-light leading-[29px]`,
  list: `${SERIF} text-[18px]`,
  numeral: `${SERIF} text-[72px] font-light leading-none`,
  small: `${SERIF} w-[300px] text-[19px] font-light leading-[26px]`,
  quote: `${SERIF} w-[440px] text-[40px] font-light italic leading-[1.12]`,
  link: `${SERIF} text-[22px] font-light hover:opacity-50 transition-opacity duration-500`,
};
const rowGap = (kind: Row["kind"], i: number) => (i === 0 ? "" : kind === "list" ? "mt-[7px]" : kind === "head" ? "mt-2" : "mt-4");

const RowEl = ({ r, i, setRef }: { r: Row; i: number; setRef?: (el: HTMLElement | null) => void }) => {
  const cls = `block w-max max-w-full will-change-transform ${rowCls[r.kind]} ${rowGap(r.kind, i)}`;
  if (r.kind === "link") return <Link ref={setRef as any} href={r.href!} className={cls}>{r.text}</Link>;
  return <span ref={setRef} className={cls}>{r.text}</span>;
};

/** Stacked article: phones, reduced motion, no WebGL. Same content as the track. */
function Article() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-32 pt-20 md:px-8">
      <h1 className={`${SERIF} text-[34px] font-light leading-[1.18] tracking-[-0.01em]`}>{HEADLINE.join(" ")}</h1>
      <p className="mt-3 text-sm text-cf-muted">{SUBLINE}</p>
      <div className="mt-12 flex flex-col gap-10">
        {BLOCKS.map((b) => (
          <section key={b.id}>{b.rows.map((r, i) => <RowEl key={i} r={r} i={i} />)}</section>
        ))}
      </div>
    </main>
  );
}

type Meas = { el: HTMLElement; left: number; top: number; w: number; h: number };

/** Looping sideways track. Lines slide up or down out of the head's oval, nearest first, and settle back. */
function Stage({ onFail }: { onFail: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const blockEls = useRef<(HTMLDivElement | null)[]>([]);
  const rowEls = useRef<(HTMLElement | null)[][]>(BLOCKS.map(() => []));
  const headEl = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const st = stage.current!;
    let raf = 0, alive = true;
    let W = st.clientWidth, H = st.clientHeight;
    let offset = 0, target = 0, L = 1;
    let layout: { bx: number; w: number; restTop: number; rows: Meas[]; side: Block["side"] }[] = [];
    let headW = 0, headH = 0;
    const shifts = BLOCKS.map((b) => b.rows.map(() => 0));
    const wrap = (x: number) => ((((x + L / 2) % L) + L) % L) - L / 2;

    const measure = () => {
      W = st.clientWidth; H = st.clientHeight;
      const phone = W <= 640, cy = H / 2;
      headW = headEl.current!.offsetWidth; headH = headEl.current!.offsetHeight;
      let bx = W / 2 + (phone ? 70 : 200), end = 0;
      layout = BLOCKS.map((b, bi) => {
        const box = blockEls.current[bi]!;
        const w = box.offsetWidth, h = box.offsetHeight;
        const rows = b.rows.map((_, ri) => { const el = rowEls.current[bi][ri]!; return { el, left: el.offsetLeft, top: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }; });
        const restTop = b.side === "top" ? cy - 78 - h : cy + 78;
        const out = { bx, w, restTop, rows, side: b.side };
        end = bx + w;
        bx += Math.max(w * 0.62, 200) + 90;
        return out;
      });
      L = end + 260 + W / 2;
    };

    const tick = () => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      offset += (target - offset) * 0.12;
      const cx = W / 2, cy = H / 2, Rx = 190, Ry = 235, pad = 20;
      headEl.current!.style.transform = `translate3d(${cx + wrap(-headW / 2 - offset)}px,${cy - headH / 2}px,0)`;
      layout.forEach((b, bi) => {
        const x = cx + wrap(b.bx - offset);
        const box = blockEls.current[bi]!;
        box.style.transform = `translate3d(${x}px,${b.restTop}px,0)`;
        // Inner to outer: top blocks grow upward from the centre line, bottom blocks downward.
        const idx = b.rows.map((_, n) => n);
        const order = b.side === "top" ? idx.reverse() : idx;
        let inner = 0;
        order.forEach((ri, k) => {
          const m = b.rows[ri];
          const left = x + m.left, right = left + m.w;
          const d = cx >= left && cx <= right ? 0 : Math.min(Math.abs(left - cx), Math.abs(right - cx));
          let need = 0;
          if (d < Rx) {
            const hh = Ry * Math.sqrt(1 - (d / Rx) ** 2) + pad;
            const restTop = b.restTop + m.top;
            need = b.side === "top" ? Math.min(0, cy - hh - (restTop + m.h)) : Math.max(0, cy + hh - restTop);
          }
          need = b.side === "top" ? Math.min(need, inner) : Math.max(need, inner); // never overlap the line inside it
          const ease = Math.max(0.1, 0.14 - 0.012 * k);
          shifts[bi][ri] += (need - shifts[bi][ri]) * ease;
          inner = shifts[bi][ri];
          m.el.style.transform = `translate3d(0,${shifts[bi][ri].toFixed(2)}px,0)`;
        });
      });
    };

    const hide = () => { if (hint.current) hint.current.style.opacity = "0"; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); target += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; hide(); };
    let drag: { x: number } | null = null;
    const down = (e: PointerEvent) => { if ((e.target as HTMLElement).closest("a")) return; drag = { x: e.clientX }; };
    const move = (e: PointerEvent) => { if (!drag) return; target -= e.clientX - drag.x; drag.x = e.clientX; hide(); };
    const up = () => { drag = null; };
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowRight") { target += 240; hide(); } else if (e.key === "ArrowLeft") { target -= 240; hide(); } };
    st.addEventListener("wheel", wheel, { passive: false });
    st.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    const ro = new ResizeObserver(measure);
    ro.observe(st);

    document.fonts.ready.then(() => { if (!alive) return; measure(); tick(); });
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      st.removeEventListener("wheel", wheel); st.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("keydown", key);
    };
  }, []);

  return (
    <div ref={stage} className="relative h-[100svh] w-full cursor-grab select-none overflow-hidden active:cursor-grabbing" role="region" aria-label="About CreatorFlow. Scroll or press the arrow keys to move sideways.">
      <div ref={headEl} className="absolute left-0 top-0 w-max text-center will-change-transform">
        <h1 className={`${SERIF} text-[75px] font-light leading-[1.18] tracking-[-0.01em] max-[1024px]:text-[56px]`}>
          {HEADLINE.map((l) => <span key={l} className="block whitespace-nowrap">{l}</span>)}
        </h1>
        <p className="mt-10 text-sm font-medium">{SUBLINE}</p>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><ChromeBot onFail={onFail} /></div>

      {BLOCKS.map((b, bi) => (
        <div key={b.id} ref={(el) => { blockEls.current[bi] = el; }} className="absolute left-0 top-0 w-max will-change-transform">
          {b.rows.map((r, ri) => <RowEl key={ri} r={r} i={ri} setRef={(el) => { rowEls.current[bi][ri] = el; }} />)}
        </div>
      ))}

      <div ref={hint} className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[.22em] text-cf-muted transition-opacity duration-700" aria-hidden="true">
        Scroll →
      </div>
    </div>
  );
}

export default function AboutStage() {
  const [mode, setMode] = useState<"pending" | "stage" | "article">("pending");
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)"), calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMode(wide.matches && !calm.matches ? "stage" : "article");
    sync();
    wide.addEventListener("change", sync); calm.addEventListener("change", sync);
    return () => { wide.removeEventListener("change", sync); calm.removeEventListener("change", sync); };
  }, []);
  const fail = useCallback(() => setMode("article"), []);
  if (mode === "stage") return <Stage onFail={fail} />;
  return <div className={mode === "pending" ? "invisible" : undefined}><Article /></div>;
}
