"use client";
import React, { useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  errMsg, useAddReferenceMutation, useDeleteReferenceMutation, useReferenceStreamQuery, useSetBriefMutation,
} from "../../../redux/features/review/reviewApi";
import Player from "./Player";
import { LinkPreview } from "./Embed";

const card = "cf-glass p-5";
const input = "cf-input";

function RefPlayer({ projectId, r }: { projectId: string; r: any }) {
  const { data, isFetching, error } = useReferenceStreamQuery({ id: projectId, rid: r._id }, { skip: r.kind !== "upload" || r.processing !== "ready" });
  if (r.kind === "link") return <LinkPreview url={r.url} />;
  if (r.processing === "pending") return <p className="text-sm text-cf-muted" role="status">Processing reference…</p>;
  if (r.processing === "failed") return <p className="text-sm text-red-300">This reference could not be processed.</p>;
  if (isFetching) return <p className="text-sm text-cf-muted">Loading…</p>;
  if (error) return <p className="text-sm text-red-300">{errMsg(error)}</p>;
  return data?.url ? <Player src={data.url} /> : null;
}

/** Owner's notes for the editor plus reference videos (links or uploads). Everyone on the project can read it. */
export default function Brief({ projectId, role, brief, references }: { projectId: string; role: string; brief: string; references: any[] }) {
  const owner = role === "owner";
  const [text, setText] = useState(brief || "");
  const [dirty, setDirty] = useState(false);
  const [setBrief, { isLoading: saving }] = useSetBriefMutation();
  const [addRef, { isLoading: adding }] = useAddReferenceMutation();
  const [del] = useDeleteReferenceMutation();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<string | null>(null);

  const save = async () => {
    try { await setBrief({ id: projectId, brief: text }).unwrap(); setDirty(false); toast.success("Notes saved"); } catch (e) { toast.error(errMsg(e)); }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = file.current?.files?.[0];
    try {
      if (f) { const fd = new FormData(); fd.append("video", f); if (title) fd.append("title", title); await addRef({ id: projectId, body: fd }).unwrap(); }
      else await addRef({ id: projectId, body: { url, ...(title ? { title } : {}) } }).unwrap();
      setUrl(""); setTitle(""); if (file.current) file.current.value = "";
    } catch (er) { toast.error(errMsg(er)); }
  };

  return (
    <section className={`${card} mb-6`} aria-label="Brief and references">
      <h2 className="text-lg font-semibold">Brief for the editor</h2>
      {owner ? (
        <>
          <p className="mt-1 text-xs text-cf-muted">Describe what you want: style, pacing, music, things to fix. The editor sees this first. Add exact moments as comments on the video.</p>
          <label htmlFor="brief" className="sr-only">Brief</label>
          <textarea id="brief" className={`${input} mt-2 h-28`} maxLength={5000} value={text} onChange={(e) => { setText(e.target.value); setDirty(true); }} placeholder="e.g. Trim the intro to 5 seconds, add captions, upbeat music from 0:30, keep the same colour grade." />
          <button className="cf-btn cf-btn-primary mt-2 text-sm" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save notes"}</button>
        </>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm">{brief || <span className="text-cf-muted">The owner has not added notes yet. Check the comments on the video.</span>}</p>
      )}

      <h3 className="mt-6 font-medium">References</h3>
      <p className="text-xs text-cf-muted">Videos to match in style or pacing: YouTube or Instagram links, other links, or an uploaded file.</p>
      <ul className="mt-2 space-y-2">
        {references.map((r) => (
          <li key={r._id} className="rounded-xl border border-cf-line bg-black/20 p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="cf-badge border-cf-line text-cf-muted">{r.kind === "upload" ? "Upload" : "Link"}</span>
              <span className="flex-1 truncate">{r.title || r.url}</span>
              <button className="underline text-xs" onClick={() => setOpen(open === r._id ? null : r._id)}>{open === r._id ? "Hide" : "Watch"}</button>
              {owner && <button className="underline text-xs text-red-300" onClick={() => del({ id: projectId, rid: r._id })}>Remove</button>}
            </div>
            {open === r._id && <div className="mt-3"><RefPlayer projectId={projectId} r={r} /></div>}
          </li>
        ))}
        {references.length === 0 && <li className="text-sm text-cf-muted">No references yet.</li>}
      </ul>
      {owner && (
        <form onSubmit={add} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className={input} aria-label="Reference link" placeholder="https://youtu.be/… or instagram.com/reel/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className={input} aria-label="Reference title" placeholder="What to copy from it (optional)" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="cf-btn cf-btn-secondary text-sm" disabled={adding}>{adding ? "Adding…" : "Add"}</button>
          <input ref={file} type="file" accept="video/*" aria-label="Or upload a reference video" className="text-xs text-cf-muted sm:col-span-3" />
        </form>
      )}
    </section>
  );
}
