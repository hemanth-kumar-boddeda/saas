"use client";
import React, { useRef, useState } from "react";
import Player, { PlayerHandle } from "./Player";
import { useStreamUrlQuery } from "../../../redux/features/review/reviewApi";

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function Side({ projectId, version, label, handle, muted, onTime }: { projectId: string; version: any; label: string; handle: React.Ref<PlayerHandle>; muted?: boolean; onTime?: (t: number) => void }) {
  const stream = useStreamUrlQuery({ id: projectId, vid: version._id });
  return (
    <div className="min-w-0">
      <p className="mb-1 text-sm font-medium">{label}</p>
      {stream.data?.kind === "hls" ? <Player ref={handle} src={stream.data.url} muted={muted} onTime={onTime} /> : <div className="cf-skeleton aspect-video" aria-busy="true" />}
    </div>
  );
}

/**
 * Two versions side by side with shared play/pause and one scrubber.
 * Only the right video has sound. ponytail: a single seek per play press; long playback can drift by
 * a few frames, press Play again to realign.
 */
export default function Compare({ projectId, versions, onClose }: { projectId: string; versions: any[]; onClose: () => void }) {
  const playable = versions.filter((v) => v.kind === "upload" && v.processing === "ready");
  const [a, setA] = useState(playable[playable.length - 2]?._id || playable[0]?._id);
  const [b, setB] = useState(playable[playable.length - 1]?._id);
  const left = useRef<PlayerHandle>(null);
  const right = useRef<PlayerHandle>(null);
  const [now, setNow] = useState(0);
  const va = playable.find((v) => v._id === a);
  const vb = playable.find((v) => v._id === b);
  const max = Math.min(...[va?.duration, vb?.duration].filter((d): d is number => !!d), 1e9);
  const seek = (t: number) => { left.current?.seek(t); right.current?.seek(t); setNow(t); };
  const pick = (v: any) => `Version ${v.number}`;
  const select = (value: string, set: (s: string) => void, label: string) => (
    <select aria-label={label} className="cf-input !w-auto" value={value} onChange={(e) => set(e.target.value)}>
      {playable.map((v) => <option key={v._id} value={v._id}>{pick(v)}</option>)}
    </select>
  );
  return (
    <section className="cf-glass mb-4 p-4" aria-label="Compare versions">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Compare versions</h2>
        {select(a, setA, "Left version")}<span className="text-cf-muted">vs</span>{select(b, setB, "Right version")}
        <button className="cf-btn cf-btn-secondary ml-auto text-sm" onClick={onClose}>Close compare</button>
      </div>
      {!va || !vb ? <p className="text-sm text-cf-muted">Pick two processed uploads.</p> : a === b ? <p className="text-sm text-amber-300">Pick two different versions.</p> : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Side key={a} projectId={projectId} version={va} label={pick(va)} handle={left} muted />
            <Side key={b} projectId={projectId} version={vb} label={`${pick(vb)} (sound)`} handle={right} onTime={setNow} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button className="cf-btn cf-btn-primary text-sm" onClick={() => { const t = right.current?.time() ?? 0; seek(t); left.current?.play(); right.current?.play(); }}>Play both</button>
            <button className="cf-btn cf-btn-secondary text-sm" onClick={() => { left.current?.pause(); right.current?.pause(); }}>Pause both</button>
            <input type="range" aria-label="Scrub both videos" className="flex-1" min={0} max={Math.max(1, Math.floor(max))} step={0.1} value={Math.min(now, max)} onChange={(e) => seek(Number(e.target.value))} />
            <span className="text-xs text-cf-muted tabular-nums">{mmss(now)}</span>
          </div>
        </>
      )}
    </section>
  );
}
