"use client";
// Minimal AI editor. Every action calls the server (/v1/reel); nothing here edits a timeline itself.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import Player from "../Review/Player";
import { errMsg, useGetProjectQuery, useStreamUrlQuery } from "../../../redux/features/review/reviewApi";
import {
  useReelApprovePlanMutation, useReelApproveTimelineMutation, useReelAssetsQuery, useReelCreatePlanMutation, useReelEditMutation, useReelExecutePlanMutation,
  useReelJobQuery, useReelPlansQuery, useReelRejectPlanMutation, useReelRenderMutation, useReelTimelineQuery, useReelTimelinesQuery, useReelTranscribeMutation, useReelUploadMutation,
} from "../../../redux/features/reel/reelApi";

const t2 = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const COLORS: Record<string, string> = { video: "bg-violet-500/60", audio: "bg-emerald-500/50", caption: "bg-amber-500/60", overlay: "bg-sky-500/60" };

function Timeline({ doc, cursor, onCursor, selected, onSelect }: { doc: any; cursor: number; onCursor: (t: number) => void; selected?: string; onSelect: (id: string) => void }) {
  const total = useMemo(() => Math.max(0.1, ...doc.tracks.flatMap((tr: any) => tr.clips.map((c: any) => c.start + c.duration))), [doc]);
  const at = (e: React.MouseEvent, el: Element) => { const r = el.getBoundingClientRect(); return +Math.max(0, Math.min(total, ((e.clientX - r.left) / r.width) * total)).toFixed(2); };
  const click = (e: React.MouseEvent<HTMLDivElement>) => onCursor(at(e, e.currentTarget));
  return (
    <div aria-label="Timeline" className="cf-card overflow-x-auto p-3">
      {doc.tracks.map((tr: any) => (
        <div key={tr.id} className="mb-1 flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs text-cf-muted">{tr.id}</span>
          <div className="relative h-8 min-w-[480px] flex-1 rounded bg-white/5" onClick={click}>
            {tr.clips.map((c: any) => (
              <button key={c.id} type="button" title={`${t2(c.start)} · ${c.duration.toFixed(1)} s`}
                onClick={(e) => { e.stopPropagation(); onSelect(c.id); onCursor(at(e, e.currentTarget.parentElement!)); }}
                className={`absolute top-0 h-8 overflow-hidden rounded px-1 text-left text-[10px] ${COLORS[tr.kind] || "bg-white/20"} ${selected === c.id ? "ring-2 ring-white" : ""}`}
                style={{ left: `${(c.start / total) * 100}%`, width: `${Math.max(0.6, (c.duration / total) * 100)}%` }}>
                {c.words ? c.words.map((w: any) => w.w).join(" ") : c.text?.value || ""}
              </button>
            ))}
            <div className="pointer-events-none absolute top-0 h-8 w-px bg-red-400" style={{ left: `${(cursor / total) * 100}%` }} />
          </div>
        </div>
      ))}
      <p className="mt-1 text-xs text-cf-muted">Cursor {t2(cursor)} of {t2(total)}. Click anywhere on a track to place the cursor; clicking a clip also selects it.</p>
    </div>
  );
}

function PlanCard({ id, plan, latest }: { id: string; plan: any; latest: number }) {
  const [approve] = useReelApprovePlanMutation(); const [reject] = useReelRejectPlanMutation(); const [execute, { isLoading }] = useReelExecutePlanMutation();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  useEffect(() => setPicked(Object.fromEntries(plan.ops.map((o: any) => [o.id, o.valid]))), [plan._id, plan.id]);
  const open = plan.status === "proposed", stale = open && plan.baseVersion !== latest;
  const apply = async () => {
    try {
      const ids = plan.ops.filter((o: any) => picked[o.id] && o.valid).map((o: any) => o.id);
      await approve({ id, planId: plan.id, opIds: ids }).unwrap();
      const r = await execute({ id, planId: plan.id }).unwrap();
      toast.success(`Applied as timeline v${r.plan.resultVersion}`);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="cf-glass mb-3 p-3 text-sm">
      <div className="flex items-center justify-between"><strong>{plan.summary}</strong><span className="cf-badge">{plan.status}</span></div>
      <p className="mt-1 text-xs text-cf-muted">Based on v{plan.baseVersion} · {plan.preview?.beforeSeconds}s → {plan.preview?.afterSeconds}s · {plan.model?.provider}</p>
      <ul className="mt-2 space-y-1">
        {plan.ops.map((o: any) => (
          <li key={o.id} className={o.valid ? "" : "opacity-70"}>
            <label className="flex gap-2">
              <input type="checkbox" disabled={!open || !o.valid} checked={!!picked[o.id]} onChange={(e) => setPicked({ ...picked, [o.id]: e.target.checked })} />
              <span><code>{o.op}</code> <span className="break-all text-cf-muted">{JSON.stringify(o.args)}</span><br />{o.rationale}
                {o.error && <span className="block text-red-300">Cannot run: {o.error}</span>}
                {o.warnings?.map((w: string) => <span key={w} className="block text-amber-300">Warning: {w}</span>)}</span>
            </label>
          </li>
        ))}
        {!plan.ops.length && <li className="text-cf-muted">No operations proposed.</li>}
      </ul>
      {plan.rejectionReason && <p className="mt-2 text-xs text-cf-muted">Rejected: {plan.rejectionReason}</p>}
      {stale && <p className="mt-2 text-xs text-amber-300">The timeline has changed since this plan was made. Ask for a new plan.</p>}
      {open && !stale && (
        <div className="mt-3 flex gap-2">
          <button className="cf-btn cf-btn-primary px-4" disabled={isLoading || !Object.values(picked).some(Boolean)} onClick={apply}>{isLoading ? "Applying…" : "Apply selected"}</button>
          <button className="cf-btn cf-btn-secondary px-4" onClick={() => { const reason = window.prompt("Why reject?") ; if (reason) reject({ id, planId: plan.id, reason }).unwrap().catch((e) => toast.error(errMsg(e))); }}>Reject</button>
        </div>
      )}
    </div>
  );
}

export default function AiEditor({ projectId: id }: { projectId: string }) {
  const project = useGetProjectQuery(id);
  const assets = useReelAssetsQuery(id);
  const tls = useReelTimelinesQuery(id);
  const plans = useReelPlansQuery(id);
  const latest: number = tls.data?.timelines?.at(-1)?.version ?? 0;
  const [view, setView] = useState<number | undefined>();
  const shown = view ?? latest;
  const tl = useReelTimelineQuery({ id, version: shown || undefined }, { skip: !latest });
  const [cursor, setCursor] = useState(0); const [sel, setSel] = useState<string | undefined>(); const [inPt, setIn] = useState<number | null>(null);
  const [text, setText] = useState(""); const [script, setScript] = useState<"native" | "roman">("native");
  const [upload, up] = useReelUploadMutation(); const [transcribe] = useReelTranscribeMutation(); const [edit] = useReelEditMutation();
  const [createPlan, cp] = useReelCreatePlanMutation(); const [render] = useReelRenderMutation(); const [approveTl] = useReelApproveTimelineMutation();
  const [jobId, setJobId] = useState<string | null>(null); const [txJob, setTxJob] = useState<string | null>(null);
  const job = useReelJobQuery({ id, jobId: jobId! }, { skip: !jobId, pollingInterval: 1500 });
  const tx = useReelJobQuery({ id, jobId: txJob! }, { skip: !txJob, pollingInterval: 1500 });
  const file = useRef<HTMLInputElement>(null);
  const row = tls.data?.timelines?.find((r: any) => r.version === shown);
  const rendered = row?.renders?.at(-1);
  const versions: any[] = project.data?.versions || project.data?.project?.versions || [];
  const pv = rendered ? versions.find((v) => v.number === rendered.projectVersion) : undefined;
  const stream = useStreamUrlQuery({ id, vid: pv?._id }, { skip: !pv });
  const doc = tl.data?.timeline;
  const jobDone = job.data?.job?.state;
  useEffect(() => { if (jobDone === "succeeded") { tls.refetch(); project.refetch(); } }, [jobDone]);

  const run = (op: string, args: any) => edit({ id, op, args, baseVersion: latest }).unwrap().then(() => { setView(undefined); setSel(undefined); }).catch((e) => toast.error(errMsg(e)));
  const selClip = doc?.tracks.flatMap((t: any) => t.clips.map((c: any) => ({ ...c, track: t }))).find((c: any) => c.id === sel);
  const send = async () => {
    if (!text.trim()) return;
    try { await createPlan({ id, instruction: text.trim(), idempotencyKey: crypto.randomUUID(), captionScript: script }).unwrap(); setText(""); }
    catch (e: any) { toast.error(e?.data?.code === "PROVIDER_NOT_CONFIGURED" ? `Not configured: ${e.data.message}` : errMsg(e)); }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><Link href={`/projects/${id}`} className="text-sm text-cf-muted">← Review</Link><h1 className="text-2xl font-semibold">{project.data?.project?.title || "AI editor"}</h1></div>
        <div className="flex gap-2">
          <input ref={file} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const form = new FormData(); form.append("video", f); upload({ id, form }).unwrap().then(() => toast.success("Uploaded and analysed")).catch((er) => toast.error(errMsg(er))); e.target.value = ""; }} />
          <button className="cf-btn cf-btn-secondary px-4" disabled={up.isLoading} onClick={() => file.current?.click()}>{up.isLoading ? "Uploading…" : "Upload raw video"}</button>
        </div>
      </header>

      {!latest ? <div className="cf-card p-8 text-center text-cf-muted">Upload a raw video to start. The server probes it and builds the first timeline.</div> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <section className="min-w-0 space-y-4">
            <div className="cf-card p-3">
              {stream.data?.url ? <Player src={stream.data.url} /> : <div className="grid aspect-video place-items-center text-sm text-cf-muted">No render of v{shown} yet. Press “Render preview”.</div>}
              <p className="mt-2 text-xs text-cf-muted">Preview shows the last render of timeline v{shown}{rendered ? ` (review v${rendered.projectVersion})` : ""}.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button className="cf-btn cf-btn-primary px-4" disabled={!!jobId && ["queued", "running"].includes(jobDone)} onClick={() => render({ id, version: shown, quality: "preview" }).unwrap().then((r) => setJobId(r.job.id)).catch((e) => toast.error(errMsg(e)))}>Render preview</button>
              {job.data?.job && <span aria-live="polite">{job.data.job.state}{job.data.job.state === "running" ? ` ${Math.round(job.data.job.progress * 100)}%` : ""}{job.data.job.error ? `: ${job.data.job.error}` : ""}</span>}
              <button className="cf-btn cf-btn-secondary px-3" disabled={!rendered || row?.approved} onClick={() => approveTl({ id, version: shown }).unwrap().then(() => toast.success("Approved and locked")).catch((e) => toast.error(errMsg(e)))}>{row?.approved ? "Approved" : "Approve this version"}</button>
              <span className="mx-2 text-cf-muted">|</span>
              <button className="cf-btn cf-btn-secondary px-3" disabled={!assets.data?.assets?.[0]} onClick={() => transcribe({ id, assetId: assets.data.assets[0].id, script }).unwrap().then((r) => setTxJob(r.job.id)).catch((e) => toast.error(errMsg(e)))}>Transcribe</button>
              {tx.data?.job && <span aria-live="polite">{tx.data.job.state}{tx.data.job.providerStatus === "not_configured" ? ` · ${tx.data.job.error}` : tx.data.job.error ? `: ${tx.data.job.error}` : ""}</span>}
            </div>
            {doc && <Timeline doc={doc} cursor={cursor} onCursor={setCursor} selected={sel} onSelect={setSel} />}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button className="cf-btn cf-btn-secondary px-3" disabled={view !== undefined || !selClip || selClip.track.kind !== "video"} onClick={() => run("split_clip", { clipId: sel, at: cursor })}>Split at cursor</button>
              <button className="cf-btn cf-btn-secondary px-3" onClick={() => setIn(cursor)}>Mark in {inPt !== null ? `(${t2(inPt)})` : ""}</button>
              <button className="cf-btn cf-btn-secondary px-3" disabled={view !== undefined || inPt === null || cursor <= inPt} onClick={() => run("remove_range", { from: inPt, to: cursor }).then(() => setIn(null))}>Delete in → cursor</button>
              <button className="cf-btn cf-btn-secondary px-3" disabled={view !== undefined} onClick={() => run("reframe_vertical", { subjectX: 0.5 })}>Vertical 9:16</button>
              {view !== undefined && <button className="cf-btn cf-btn-primary px-3" onClick={() => setView(undefined)}>Back to latest (v{latest})</button>}
            </div>
          </section>

          <aside className="min-w-0 space-y-4">
            <div className="cf-card max-h-[420px] overflow-y-auto p-3" aria-label="AI editing assistant">
              <h2 className="mb-2 font-semibold">AI editing assistant</h2>
              {(plans.data?.plans || []).slice().reverse().map((p: any) => <PlanCard key={p.id} id={id} plan={p} latest={latest} />)}
              {!plans.data?.plans?.length && <p className="text-sm text-cf-muted">Describe the edit you want. You review the plan before anything changes.</p>}
            </div>
            <div className="cf-glass p-3">
              <label htmlFor="instr" className="sr-only">Editing instruction</label>
              <textarea id="instr" className="cf-input w-full" rows={3} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Make a 30 second vertical reel from the strongest part, with captions" />
              <div className="mt-2 flex items-center gap-2 text-sm">
                <select aria-label="Caption script" className="cf-input" value={script} onChange={(e) => setScript(e.target.value as any)}><option value="native">Native script</option><option value="roman">Roman script</option></select>
                <button className="cf-btn cf-btn-primary ml-auto px-4" disabled={cp.isLoading || !text.trim()} onClick={send}>{cp.isLoading ? "Planning…" : "Plan edit"}</button>
              </div>
            </div>
            <div className="cf-card p-3" aria-label="Version history">
              <h2 className="mb-2 font-semibold">Version history</h2>
              <ul className="space-y-1 text-sm">
                {(tls.data?.timelines || []).slice().reverse().map((r: any) => (
                  <li key={r.version}><button className={`w-full rounded px-2 py-1 text-left ${shown === r.version ? "bg-white/10" : ""}`} onClick={() => setView(r.version === latest ? undefined : r.version)}>
                    v{r.version}{r.parent ? ` ← v${r.parent}` : ""} {r.approved && "· approved"} {r.renders?.length ? "· rendered" : ""}<br /><span className="break-words text-xs text-cf-muted">{r.summary}</span></button></li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
