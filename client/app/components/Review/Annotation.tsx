"use client";
import React, { useRef, useState } from "react";

export type Stroke = { tool: "pen" | "arrow"; color: string; points: [number, number][] };
const COLORS = ["#ff3b30", "#ffd60a", "#34c759", "#ffffff"];
const ASPECT = 16 / 9; // arrow heads are drawn for a 16:9 frame so they do not look squashed

const arrowHead = ([x1, y1]: [number, number], [x2, y2]: [number, number]) => {
  const a = Math.atan2((y2 - y1), (x2 - x1) * ASPECT);
  const len = 0.045;
  const p = (ang: number): [number, number] => [x2 - (Math.cos(ang) * len) / ASPECT, y2 - Math.sin(ang) * len];
  return [p(a - 0.45), [x2, y2], p(a + 0.45)] as [number, number][];
};
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x * 100},${y * 100}`).join(" ");

/** Read-only drawing over the video. Coordinates are 0-1 so it fits any player size. */
export function AnnotationView({ strokes }: { strokes: Stroke[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {strokes.map((s, i) => {
        const last = s.points[s.points.length - 1];
        return s.tool === "arrow" ? (
          <g key={i} stroke={s.color} fill="none" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
            <polyline points={pts([s.points[0], last])} vectorEffect="non-scaling-stroke" />
            <polyline points={pts(arrowHead(s.points[0], last))} vectorEffect="non-scaling-stroke" />
          </g>
        ) : (
          <polyline key={i} points={pts(s.points)} stroke={s.color} fill="none" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        );
      })}
    </svg>
  );
}

/** Draw pens and arrows on the paused frame. Calls onDone with the strokes to attach to the comment. */
export function DrawLayer({ initial = [], onDone, onCancel }: { initial?: Stroke[]; onDone: (s: Stroke[]) => void; onCancel: () => void }) {
  const [strokes, setStrokes] = useState<Stroke[]>(initial);
  const [tool, setTool] = useState<"pen" | "arrow">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const box = useRef<HTMLDivElement>(null);
  const live = useRef<Stroke | null>(null);
  const [, bump] = useState(0);

  const at = (e: React.PointerEvent): [number, number] => {
    const r = box.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const down = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); live.current = { tool, color, points: [at(e)] }; bump((n) => n + 1); };
  const move = (e: React.PointerEvent) => { const l = live.current; if (l && l.points.length < 400) { l.points.push(at(e)); bump((n) => n + 1); } };
  const up = () => {
    const l = live.current; live.current = null;
    if (l && l.points.length >= 2 && strokes.length < 40) setStrokes((s) => [...s, l.tool === "arrow" ? { ...l, points: [l.points[0], l.points[l.points.length - 1]] } : l]);
    else bump((n) => n + 1);
  };
  const shown = live.current ? [...strokes, live.current.tool === "arrow" && live.current.points.length > 1 ? { ...live.current, points: [live.current.points[0], live.current.points[live.current.points.length - 1]] as [number, number][] } : live.current] : strokes;

  return (
    <div ref={box} className="absolute inset-0 z-20 cursor-crosshair rounded-2xl ring-2 ring-cf-violet" style={{ touchAction: "none" }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="application" aria-label="Drawing canvas">
      <AnnotationView strokes={shown as Stroke[]} />
      <div className="absolute left-2 top-2 flex flex-wrap items-center gap-2 rounded-xl bg-black/75 p-2 text-xs backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
        {(["pen", "arrow"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tool === t} className={`rounded-lg px-2 py-1 ${tool === t ? "bg-cf-violet text-white" : "bg-white/10"}`} onClick={() => setTool(t)}>{t === "pen" ? "✏ Pen" : "➚ Arrow"}</button>
        ))}
        {COLORS.map((c) => (
          <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color === c} className={`h-5 w-5 rounded-full border-2 ${color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} onClick={() => setColor(c)} />
        ))}
        <button type="button" className="rounded-lg bg-white/10 px-2 py-1" disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}>Undo</button>
        <button type="button" className="rounded-lg bg-white/10 px-2 py-1" onClick={onCancel}>Cancel</button>
        <button type="button" className="rounded-lg bg-cf-violet px-2 py-1 font-medium text-white disabled:opacity-50" disabled={!strokes.length} onClick={() => onDone(strokes)}>Attach to comment</button>
      </div>
    </div>
  );
}
