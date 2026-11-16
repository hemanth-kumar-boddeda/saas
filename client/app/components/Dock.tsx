"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

export type DockTab = { label: string; href: string; active?: boolean };
export type DockMenuItem = { label: string; meta?: string; href?: string; onClick?: () => void };

const EASE = "ease-[cubic-bezier(.16,1,.3,1)]";

/**
 * Frosted capsule fixed at the bottom centre: wordmark, numbered tabs (the active one grows an italic
 * serif label and its number becomes a superscript), and a dot that opens a menu upward.
 */
export default function Dock({ brand, tabs, menu, note }: {
  brand: { label: string; href: string; aria: string };
  tabs: DockTab[];
  menu: DockMenuItem[];
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", esc);
    document.addEventListener("pointerdown", away);
    return () => { document.removeEventListener("keydown", esc); document.removeEventListener("pointerdown", away); };
  }, [open]);

  return (
    <div ref={wrap} className="pointer-events-none fixed inset-x-0 bottom-[max(18px,env(safe-area-inset-bottom))] z-50 flex justify-center px-2">
      <div
        id="dock-menu"
        aria-hidden={!open}
        {...(open ? {} : { inert: "" as any })}
        className={`pointer-events-auto absolute bottom-[58px] w-[min(220px,calc(100vw-16px))] origin-bottom rounded-lg border border-cf-line bg-[rgba(22,22,24,.82)] p-3.5 backdrop-blur-[18px] transition-[opacity,transform,visibility] duration-500 ${EASE} ${open ? "visible translate-y-0 scale-100 opacity-100" : "invisible translate-y-1.5 scale-[.98] opacity-0"}`}
      >
        {note && <p className="mb-2 text-xs text-cf-muted">{note}</p>}
        <ul>
          {menu.map((m) => {
            const row = "flex min-h-[44px] w-full items-center justify-between border-t border-cf-line font-[family-name:var(--font-newsreader)] text-[17px] text-cf-text first:border-t-0 hover:text-cf-violet";
            const body = <><span>{m.label}</span>{m.meta && <span className="font-cf text-[11px] text-cf-muted">{m.meta}</span>}</>;
            return (
              <li key={m.label}>
                {m.href ? <Link href={m.href} className={row} onClick={() => setOpen(false)}>{body}</Link>
                  : <button className={row} onClick={() => { setOpen(false); m.onClick?.(); }}>{body}</button>}
              </li>
            );
          })}
        </ul>
      </div>

      <nav aria-label="Main" className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/[.06] bg-[rgba(28,28,30,.66)] p-[5px] shadow-[0_12px_40px_rgba(0,0,0,.45)] backdrop-blur-[16px]">
        <Link href={brand.href} aria-label={brand.aria} className="flex min-h-[44px] items-center rounded-md py-1.5 pl-2 pr-2.5 text-sm font-semibold tracking-tight sm:min-h-[34px]">
          {brand.label}
        </Link>
        <span aria-hidden="true" className="mx-1 h-[18px] w-px bg-white/10" />
        {tabs.map((t, i) => (
          <Link
            key={t.label}
            href={t.href}
            aria-label={t.label}
            aria-current={t.active ? "page" : undefined}
            className={`flex min-h-[44px] items-center rounded-md px-[9px] transition-colors sm:min-h-[34px] ${t.active ? "bg-white/10" : "hover:bg-white/[.06]"}`}
          >
            <span className={`overflow-hidden whitespace-nowrap font-[family-name:var(--font-newsreader)] text-[17px] italic leading-none transition-[max-width,margin,opacity] ${EASE} ${t.active ? "mr-[3px] max-w-[120px] opacity-100 duration-700" : "max-w-0 opacity-0 duration-700"}`}>{t.label}</span>
            <span className={`font-medium transition-[font-size,transform] duration-700 ${EASE} ${t.active ? "-translate-y-1.5 text-[10px]" : "-translate-y-px text-xs"}`}>{i + 1}</span>
          </Link>
        ))}
        <span aria-hidden="true" className="mx-1 h-[18px] w-px bg-white/10" />
        <button
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="dock-menu"
          onClick={() => setOpen(!open)}
          className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/[.06] sm:h-[34px] sm:w-[34px]"
        >
          <span aria-hidden="true" className={`block h-1 w-1 rounded-full bg-cf-text transition-transform duration-500 ${EASE} ${open ? "scale-[2.2]" : ""}`} />
        </button>
      </nav>
    </div>
  );
}
