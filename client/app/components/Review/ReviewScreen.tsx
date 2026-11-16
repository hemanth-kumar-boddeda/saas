"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import Player, { PlayerHandle } from "./Player";
import PublishKit from "./PublishKit";
import YouTubePlayer, { youtubeId } from "./YouTubePlayer";
import Brief from "./Brief";
import { AnnotationView, DrawLayer, Stroke } from "./Annotation";
import VoiceRecorder, { VoicePlayer } from "./VoiceNote";
import { InstagramEmbed, instagramId } from "./Embed";
import {
  errMsg, useAddCommentMutation, useAddVoiceCommentMutation, useInviteEditorMutation, useSendFeedbackMutation, useAddVersionMutation, useApprovalsQuery, useCreateLinkMutation, useDecideMutation,
  useGetProjectQuery, useListCommentsQuery, useListLinksQuery, useRevokeLinkMutation, useSetCommentStatusMutation,
  useStreamUrlQuery,
} from "../../../redux/features/review/reviewApi";

const STATUS: Record<string, { label: string; cls: string }> = {
  in_review: { label: "In review", cls: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  changes_requested: { label: "Changes requested", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  approved: { label: "Approved", cls: "bg-green-500/10 text-green-300 border-green-500/30" },
  published: { label: "Published", cls: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
};
export const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS[status] || STATUS.in_review;
  return <span className={`cf-badge ${s.cls}`}>{s.label}</span>;
};

export const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const parseTime = (s: string) => {
  const [m, sec] = s.includes(":") ? s.split(":") : ["0", s];
  const v = Number(m) * 60 + Number(sec);
  return Number.isFinite(v) && v >= 0 ? v : NaN;
};
const card = "cf-glass p-4";
const btn = "cf-btn text-sm";
const btnPrimary = `${btn} cf-btn-primary`;
const btnGhost = `${btn} cf-btn-secondary`;
const input = "cf-input";

const Notice = () => (
  <p className="text-xs text-cf-muted">
    Preview-only streaming deters casual downloading. It cannot stop screen recording.
  </p>
);

export default function ReviewScreen({ projectId, guest }: { projectId: string; guest: boolean }) {
  const [busy, setBusy] = useState(false);
  const { data, isLoading, error } = useGetProjectQuery(projectId, { pollingInterval: busy ? 3000 : 0 });
  const [picked, setPicked] = useState<string | null>(null);
  const versions: any[] = data?.versions || [];
  const vid = picked || versions[versions.length - 1]?._id;
  const version = versions.find((v) => v._id === vid);
  const ytId = version?.kind === "link" ? youtubeId(version.externalUrl) : null;
  const ig = version?.kind === "link" && !ytId && !!instagramId(version.externalUrl);
  const pending = versions.some((v) => v.processing === "pending");
  if (pending !== busy) setBusy(pending);
  const [ytDuration, setYtDuration] = useState(0);
  const project = data?.project;
  const role: string = project?.role || "guest";
  const isLatest = version && version.number === project?.currentVersion;

  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const player = useRef<PlayerHandle>(null);
  const [now, setNow] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById("comment-box");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setComposerVisible(e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  });
  const [attached, setAttached] = useState<Stroke[]>([]);
  const [shownAnn, setShownAnn] = useState<{ t: number; strokes: Stroke[] } | null>(null);

  const [pollComments, setPollComments] = useState(0);
  const { data: cdata, isFetching: loadingComments } = useListCommentsQuery(
    { id: projectId, vid: vid!, status: status || undefined, mine },
    { skip: !vid, pollingInterval: pollComments }
  );
  // Voice transcripts arrive a few seconds after saving: poll only while one is pending.
  useEffect(() => { setPollComments(cdata?.comments?.some((c: any) => c.transcriptStatus === "pending") ? 4000 : 0); }, [cdata]);
  const stream = useStreamUrlQuery({ id: projectId, vid: vid! }, { skip: !vid || version?.processing !== "ready" });

  if (isLoading)
    return (
      <div className="mx-auto max-w-7xl p-6" aria-busy="true" aria-label="Loading project">
        <div className="cf-skeleton mb-4 h-9 w-64" />
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]"><div className="cf-skeleton aspect-video" /><div className="cf-skeleton h-96" /></div>
      </div>
    );
  if (error || !project)
    return (
      <div className="p-8" role="alert">
        <p className="text-red-300">{errMsg(error) || "Project not found."}</p>
        {!guest && <Link href="/projects" className="underline text-sm">Back to projects</Link>}
      </div>
    );

  const comments: any[] = cdata?.comments || [];
  const roots = comments.filter((c) => !c.parentId);
  const duration: number = version?.duration || ytDuration || 0;

  return (
    <div className="mx-auto max-w-7xl p-4 pb-24 sm:p-6 text-cf-text">
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          {!guest && <Link href="/projects" className="cf-chip hover:text-cf-text">← Projects</Link>}
          <StatusBadge status={project.status} />
          <select aria-label="Version" className={`${input} !w-auto ml-auto`} value={vid || ""} onChange={(e) => setPicked(e.target.value)}>
            {versions.map((v) => (
              <option key={v._id} value={v._id}>Version {v.number}{v.number === project.currentVersion ? " (latest)" : ""}</option>
            ))}
          </select>
        </div>
        <h1 className="cf-hero-gradient mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{project.title}</h1>
        {!guest && <Stepper status={project.status} />}
      </header>

      <Brief projectId={projectId} role={role} brief={project.brief || ""} references={project.references || []} />

      {!version ? (
        <div className={`${card} text-center`}>
          <p className="mb-2">No video yet.</p>
          {role !== "guest" && <p className="text-sm text-cf-muted">Upload the first version below.</p>}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <section>
            {version.processing === "pending" && <div className={`${card} flex items-center gap-3`} role="status"><span className="cf-skeleton h-3 w-3 !rounded-full" />Processing your video. The preview appears here automatically.</div>}
            {version.processing === "failed" && <div className={`${card} text-red-300`}>Processing failed. Upload this version again.</div>}
            {version.kind === "link" && !ytId && !ig && (
              <div className={card}>
                <a className="underline break-all" href={version.externalUrl} target="_blank" rel="noreferrer noopener">{version.externalUrl}</a>
                <p className="text-xs text-cf-muted mt-1">This link cannot be embedded here. Open it in a new tab and enter timecodes by hand. YouTube links play inside CreatorFlow with automatic timecodes; Instagram links play but need timecodes typed in.</p>
              </div>
            )}
            {stream.isFetching && <div className={card}>Loading player…</div>}
            <div className="relative">
            {stream.data?.kind === "hls" && <Player ref={player} src={stream.data.url} onTime={setNow} />}
            {ig && <InstagramEmbed url={version.externalUrl} />}
            {ytId && <YouTubePlayer ref={player} videoId={ytId} onTime={setNow} onDuration={setYtDuration} />}
            {drawing && <DrawLayer initial={attached} onCancel={() => setDrawing(false)} onDone={(st) => { setAttached(st); setDrawing(false); }} />}
            {!drawing && shownAnn && Math.abs(now - shownAnn.t) < 2 && <AnnotationView strokes={shownAnn.strokes} />}
            </div>
            {stream.isError && <p className="text-red-300 text-sm">{errMsg(stream.error)}</p>}

            {duration > 0 && (
              <div
                className="group relative mt-3 h-8 cursor-pointer rounded-full bg-white/10"
                role="slider" aria-label="Comment timeline: click to jump" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(now)}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  player.current?.seek(Math.max(0, Math.min(duration, ((e.clientX - r.left) / r.width) * duration)));
                }}
              >
                <div className="absolute inset-y-0 left-0 rounded-full bg-cf-violet/30" style={{ width: `${Math.min(100, (now / duration) * 100)}%` }} />
                {roots.map((c) => (
                  <button
                    key={c._id}
                    title={`${fmt(c.timecode)} ${c.authorName}: ${c.body}`}
                    onClick={(e) => { e.stopPropagation(); player.current?.seek(c.timecode); }}
                    style={{ left: `${Math.min(100, (c.timecode / duration) * 100)}%` }}
                    className={`absolute top-1/2 -ml-2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-black transition-transform duration-300 hover:scale-125 ${c.status === "resolved" ? "bg-green-400" : "bg-amber-400"}`}
                  />
                ))}
                <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: `${Math.min(100, (now / duration) * 100)}%` }} />
                <span className="pointer-events-none absolute -bottom-5 left-0 text-[11px] text-cf-muted">{fmt(now)}</span>
                <span className="pointer-events-none absolute -bottom-5 right-0 text-[11px] text-cf-muted">{fmt(duration)}</span>
              </div>
            )}
            <div className="mt-7"><Notice /></div>
            {!isLatest && <p className="mt-2 text-sm text-amber-300">You are viewing an older version. Comments here belong to this version only.</p>}
          </section>

          <aside className={`${card} flex flex-col max-h-[80vh]`}>
            <div className="flex items-center gap-2 mb-2">
              <select aria-label="Filter" className={`${input} !w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="resolved">Done</option>
              </select>
              <label className="text-sm flex items-center gap-1">
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Mine
              </label>
            </div>
            {roots.filter((c) => !c.draft).length > 0 && (() => {
              const sent = roots.filter((c) => !c.draft); const done = sent.filter((c) => c.status === "resolved").length;
              return (
                <div className="mb-3" aria-label={`${done} of ${sent.length} changes done`}>
                  <div className="mb-1 flex justify-between text-xs text-cf-muted"><span>Change checklist</span><span>{done} of {sent.length} done</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-green-400 transition-all duration-500" style={{ width: `${(done / sent.length) * 100}%` }} /></div>
                </div>
              );
            })()}
            {role === "owner" && <SendFeedback projectId={projectId} vid={vid} drafts={comments.filter((c) => c.draft).length} />}
            <div className="overflow-y-auto flex-1 space-y-3">
              {loadingComments && <p className="text-sm text-cf-muted">Loading comments…</p>}
              {!loadingComments && roots.length === 0 && <p className="text-sm text-cf-muted">No comments yet. Pause the video and add the first one.</p>}
              {roots.map((c) => (
                <Thread key={c._id} c={c} replies={comments.filter((r) => r.parentId === c._id)} projectId={projectId} vid={vid} role={role} seek={(t: number, ann?: Stroke[]) => { player.current?.seek(t); player.current?.pause(); setShownAnn(ann?.length ? { t, strokes: ann } : null); }} />
              ))}
            </div>
            <NewComment projectId={projectId} vid={vid} now={now} manual={version.kind === "link" && !ytId} onFocus={() => player.current?.pause()} duration={duration} attached={attached} onClearDrawing={() => setAttached([])} onDraw={() => { player.current?.pause(); setDrawing(true); }} />
          </aside>
        </div>
      )}

      {(role === "owner" || role === "editor") && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <UploadVersion projectId={projectId} />
          {guest && <p className="text-sm text-cf-muted self-center">Finished editing? Upload your new cut (or paste a link) here. The owner is notified.</p>}
          {role === "owner" && version && isLatest && <ApprovalBox projectId={projectId} vid={vid} status={project.status} />}
          {role === "owner" && <ShareLinks projectId={projectId} />}
          {role === "owner" && <InviteEditor projectId={projectId} invites={project.editorInvites || []} />}
          {!guest && <ApprovalLog projectId={projectId} />}
        </div>
      )}
      {version && !drawing && !composerVisible && (
        <button
          type="button"
          className="cf-btn cf-btn-primary fixed bottom-4 left-1/2 z-30 -translate-x-1/2 px-5 py-3 text-sm shadow-2xl shadow-black/60 lg:hidden"
          onClick={() => { player.current?.pause(); const t = document.getElementById("comment-box"); t?.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => t?.focus(), 350); }}
        >
          {version.kind === "link" && !ytId ? "Add comment" : `Comment at ${fmt(now)}`}
        </button>
      )}
      {!guest && (project.status === "approved" || project.status === "published") && (
        <PublishKit projectId={projectId} role={role} channel={project.channel} />
      )}
    </div>
  );
}

function Thread({ c, replies, projectId, vid, role, seek }: any) {
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const [add, { isLoading }] = useAddCommentMutation();
  const [setStatus] = useSetCommentStatusMutation();
  const canResolve = role === "owner" || role === "editor";
  return (
    <div className={`rounded-xl border p-3 bg-black/20 ${c.status === "resolved" ? "opacity-70 border-green-500/40" : "border-cf-line"}`}>
      <div className="flex items-center gap-2 text-xs text-cf-muted">
        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-cf-violet/30 text-[11px] font-semibold text-violet-100">{String(c.authorName || "?").slice(0, 1).toUpperCase()}</span>
        <span className="text-cf-text">{c.authorName}</span>
        <button className="cf-badge border-cf-violet/40 bg-cf-violet/10 font-mono text-violet-200 hover:bg-cf-violet/20" onClick={() => seek(c.timecode, c.annotation?.strokes)}>{fmt(c.timecode)}{c.annotation ? " ✏" : ""}</button>
        {c.draft && <span className="cf-badge border-amber-500/30 bg-amber-500/10 text-amber-300">Draft, not sent</span>}
        {c.status === "resolved" && <span className="text-green-300">✓ done{c.resolvedByName ? ` by ${c.resolvedByName}` : ""}</span>}
      </div>
      {c.body && <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>}
      {c.audioUrl && <VoicePlayer url={c.audioUrl} seconds={c.audioDuration} transcript={c.transcript} transcriptStatus={c.transcriptStatus} />}
      {replies.map((r: any) => (
        <p key={r._id} className="text-sm ml-3 mt-1 pl-2 border-l border-cf-line">
          <span className="text-xs text-cf-muted">{r.authorName}: </span>{r.body}
          {r.audioUrl && <VoicePlayer url={r.audioUrl} seconds={r.audioDuration} transcript={r.transcript} transcriptStatus={r.transcriptStatus} />}
        </p>
      ))}
      <div className="flex gap-3 mt-1 text-xs">
        <button className="underline" onClick={() => setOpen(!open)}>Reply</button>
        {canResolve && (
          <button className="underline" onClick={() => setStatus({ id: projectId, cid: c._id, status: c.status === "open" ? "resolved" : "open" }).unwrap().catch((e) => toast.error(errMsg(e)))}>
            {c.status === "open" ? (role === "editor" ? "Mark done" : "Resolve") : "Reopen"}
          </button>
        )}
      </div>
      {open && (
        <form
          className="flex gap-2 mt-1"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await add({ id: projectId, vid, body: reply, timecode: c.timecode, parentId: c._id }).unwrap();
              setReply(""); setOpen(false);
            } catch (er) { toast.error(errMsg(er)); }
          }}
        >
          <input className={input} value={reply} maxLength={2000} onChange={(e) => setReply(e.target.value)} placeholder="Reply" />
          <button className={btnPrimary} disabled={isLoading || !reply.trim()}>Send</button>
        </form>
      )}
    </div>
  );
}

function NewComment({ projectId, vid, now, manual, duration, onFocus, attached, onClearDrawing, onDraw }: any) {
  const [body, setBody] = useState("");
  const [time, setTime] = useState("0:00");
  const [add, { isLoading }] = useAddCommentMutation();
  const [addVoice, { isLoading: sendingVoice }] = useAddVoiceCommentMutation();
  const sendVoice = async (blob: Blob) => {
    const t = manual ? parseTime(time) : now;
    if (Number.isNaN(t)) return void toast.error("Enter time as m:ss");
    const form = new FormData();
    form.append("audio", blob, "voice-note");
    form.append("timecode", String(t));
    if (body.trim()) form.append("body", body.trim());
    if (attached?.length) form.append("annotation", JSON.stringify({ strokes: attached }));
    try { await addVoice({ id: projectId, vid, form }).unwrap(); setBody(""); onClearDrawing?.(); toast.success("Voice note added"); } catch (er) { toast.error(errMsg(er)); }
  };
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const t = manual ? parseTime(time) : now;
        if (Number.isNaN(t)) return toast.error("Enter time as m:ss");
        try {
          await add({ id: projectId, vid, body, timecode: t, ...(attached?.length ? { annotation: { strokes: attached } } : {}) }).unwrap();
          setBody(""); onClearDrawing?.();
        } catch (er) { toast.error(errMsg(er)); }
      }}
    >
      <div className="flex items-center gap-2 text-sm">
        {manual ? (
          <input aria-label="Timecode" className={`${input} !w-24`} value={time} onChange={(e) => setTime(e.target.value)} />
        ) : (
          <span className="cf-badge border-cf-violet/40 bg-cf-violet/10 text-violet-200 font-mono">{fmt(now)}</span>
        )}
        {duration > 0 && <span className="text-cf-muted">of {fmt(duration)}</span>}
      </div>
      {!manual && (
        <div className="flex items-center gap-2">
          <button type="button" className="cf-btn cf-btn-secondary text-xs" onClick={onDraw}>✏ {attached?.length ? "Edit drawing" : "Draw on this frame"}</button>
          {attached?.length > 0 && <button type="button" className="text-xs underline text-cf-muted" onClick={onClearDrawing}>Remove drawing ({attached.length})</button>}
        </div>
      )}
      <textarea id="comment-box" className={input} rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Pause the video, then write your note for this exact moment" onFocus={onFocus} />
      <button className={`${btnPrimary} w-full`} disabled={isLoading || !body.trim()}>{manual ? "Add comment" : `Comment at ${fmt(now)}`}</button>
      <VoiceRecorder onStart={onFocus} onSend={sendVoice} sending={sendingVoice} label={manual ? "Record voice note" : `Record voice note at ${fmt(now)}`} />
    </form>
  );
}

function UploadVersion({ projectId }: { projectId: string }) {
  const [add, { isLoading }] = useAddVersionMutation();
  const [url, setUrl] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = file.current?.files?.[0];
    try {
      if (f) {
        const form = new FormData();
        form.append("video", f);
        if (note) form.append("note", note);
        await add({ id: projectId, form }).unwrap();
      } else {
        await add({ id: projectId, form: { externalUrl: url, note: note || undefined } }).unwrap();
      }
      toast.success("New version added");
      setUrl(""); setNote("");
      if (file.current) file.current.value = "";
    } catch (er) { toast.error(errMsg(er)); }
  };
  return (
    <form onSubmit={submit} className={card}>
      <h2 className="font-semibold mb-2">Upload a new version</h2>
      <input ref={file} type="file" accept="video/*,.mkv" className="text-sm mb-2" />
      <p className="text-xs text-cf-muted mb-2">or paste an unlisted https link</p>
      <input className={`${input} mb-2`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/…" />
      <input className={`${input} mb-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed? (optional)" maxLength={500} />
      <button className={btnPrimary} disabled={isLoading}>{isLoading ? "Uploading…" : "Add version"}</button>
    </form>
  );
}

function ApprovalBox({ projectId, vid, status }: any) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [decide, { isLoading }] = useDecideMutation();
  const done = status === "approved" || status === "published";
  const go = async (action: "approve" | "request_changes") => {
    try {
      const r = await decide({ id: projectId, action, versionId: vid, note: note || undefined }).unwrap();
      toast.success(action !== "approve" ? "Changes requested" : r.kitStarted ? "Approved. The AI publish kit is being generated below." : "Approved. Upload a video file (not a link) to generate the AI kit.");
      setOpen(false); setNote("");
    } catch (er) { toast.error(errMsg(er)); }
  };
  return (
    <div className={card}>
      <h2 className="font-semibold mb-2">Decision</h2>
      {done ? <p className="text-sm">This version is {status}.</p> : <button className={btnPrimary} onClick={() => setOpen(true)}>Review decision…</button>}
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg cf-glass p-5 text-cf-text">
            <h3 className="font-semibold mb-2">Decide on this version</h3>
            <textarea className={`${input} mb-3`} rows={3} maxLength={1000} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              <button className={btnGhost} disabled={isLoading} onClick={() => go("request_changes")}>Request changes</button>
              <button className={btnPrimary} disabled={isLoading} onClick={() => go("approve")}>Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareLinks({ projectId }: { projectId: string }) {
  const { data } = useListLinksQuery(projectId);
  const [create, { isLoading }] = useCreateLinkMutation();
  const [revoke] = useRevokeLinkMutation();
  const [password, setPassword] = useState("");
  const [days, setDays] = useState("7");
  const [fresh, setFresh] = useState("");
  return (
    <div className={card}>
      <h2 className="font-semibold mb-2">Guest review links</h2>
      <div className="flex gap-2 mb-2">
        <input className={input} type="password" placeholder="Password (optional)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className={`${input} !w-20`} aria-label="Days until expiry" value={days} onChange={(e) => setDays(e.target.value)} />
        <button
          className={btnPrimary}
          disabled={isLoading}
          onClick={async () => {
            try {
              const r = await create({ id: projectId, password: password || undefined, expiresInDays: days ? Number(days) : undefined }).unwrap();
              setFresh(`${window.location.origin}/review/${r.link.token}`);
              setPassword("");
            } catch (er) { toast.error(errMsg(er)); }
          }}
        >Create</button>
      </div>
      {fresh && (
        <p className="text-xs break-all mb-2">
          Copy now, it is shown once: <code>{fresh}</code>
        </p>
      )}
      <ul className="text-sm space-y-1">
        {(data?.links || []).map((l: any) => (
          <li key={l._id} className="flex justify-between">
            <span>
              {l.revoked ? "revoked" : l.expiresAt ? `expires ${new Date(l.expiresAt).toLocaleDateString()}` : "no expiry"}
              {l.hasPassword ? " · password" : ""}
            </span>
            {!l.revoked && <button className="underline" onClick={() => revoke({ id: projectId, lid: l._id })}>Revoke</button>}
          </li>
        ))}
        {data?.links?.length === 0 && <li className="text-cf-muted">No links yet.</li>}
      </ul>
    </div>
  );
}

function ApprovalLog({ projectId }: { projectId: string }) {
  const { data, isLoading } = useApprovalsQuery(projectId);
  const rows: any[] = data?.approvals || [];
  return (
    <div className={card}>
      <h2 className="font-semibold mb-2">Approval log</h2>
      {isLoading ? <p className="text-sm text-cf-muted">Loading…</p> : rows.length === 0 ? <p className="text-sm text-cf-muted">No decisions yet.</p> : (
        <ul className="text-sm space-y-1">
          {rows.map((r) => (
            <li key={r._id}>
              <b>{r.action === "approve" ? "Approved" : "Changes requested"}</b> v{r.versionNumber} by {r.by || "owner"} · {new Date(r.at).toLocaleString()}
              {r.note ? ` · ${r.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InviteEditor({ projectId, invites }: { projectId: string; invites: { email: string }[] }) {
  const [email, setEmail] = useState("");
  const [invite, { isLoading }] = useInviteEditorMutation();
  const [last, setLast] = useState<{ link: string; emailSent: boolean } | null>(null);
  const send = async (to: string) => {
    try {
      const r = await invite({ id: projectId, email: to.trim() }).unwrap();
      setLast({ link: r.link, emailSent: r.emailSent });
      toast.success(r.emailSent ? `Invite sent to ${to}` : "Link created. Email could not be sent, copy the link below.");
      setEmail("");
    } catch (er) { toast.error(errMsg(er)); }
  };
  return (
    <div className={card}>
      <h2 className="font-semibold mb-1">Editor</h2>
      <p className="text-xs text-cf-muted mb-2">Enter your editor&apos;s email once. They get a private link, no account needed. After this, &quot;Send feedback&quot; goes to them automatically.</p>
      <ul className="mb-2 space-y-1 text-sm">
        {invites.map((i) => (
          <li key={i.email} className="flex items-center justify-between rounded-lg border border-cf-line bg-black/20 px-3 py-1.5">
            <span>{i.email}</span>
            <button className="underline text-xs" disabled={isLoading} onClick={() => send(i.email)}>Resend link</button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(email); }}>
        <label htmlFor="editor-email" className="sr-only">Editor email</label>
        <input id="editor-email" type="email" required className={input} placeholder="editor@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className={btnPrimary} disabled={isLoading || !email.trim()}>Invite</button>
      </form>
      {last && (
        <p className="mt-2 break-all text-xs text-cf-muted">
          {last.emailSent ? "Email sent. " : "Email not sent. "}Private link (shown once): <span className="text-cf-text select-all">{last.link}</span>
        </p>
      )}
    </div>
  );
}

function SendFeedback({ projectId, vid, drafts }: { projectId: string; vid: string; drafts: number }) {
  const [send, { isLoading }] = useSendFeedbackMutation();
  if (!drafts) return <p className="mb-2 text-xs text-cf-muted">Your comments stay private until you press Send feedback.</p>;
  return (
    <button
      className={`${btnPrimary} mb-2 w-full`}
      disabled={isLoading}
      onClick={async () => {
        try {
          const r = await send({ id: projectId, vid }).unwrap();
          toast.success(`${r.count} change${r.count === 1 ? "" : "s"} sent to your editor${r.emailed ? "" : " (email not sent, they will see them on the link)"}`);
        } catch (er) { toast.error(errMsg(er)); }
      }}
    >
      {isLoading ? "Sending…" : `Send feedback to editor (${drafts})`}
    </button>
  );
}

const STEPS = ["Review", "Approved", "AI kit", "Published"];
function Stepper({ status }: { status: string }) {
  const at = status === "published" ? 3 : status === "approved" ? 2 : 0;
  return (
    <ol className="mt-4 flex flex-wrap items-center gap-2 text-xs" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i === at ? "step" : undefined}>
          <span className={`cf-badge ${i < at ? "border-green-500/30 bg-green-500/10 text-green-300" : i === at ? "border-cf-violet/50 bg-cf-violet/15 text-violet-200" : "border-cf-line text-cf-muted"}`}>{i + 1}. {label}</span>
          {i < STEPS.length - 1 && <span aria-hidden="true" className="hidden h-px w-5 bg-cf-line sm:block" />}
        </li>
      ))}
    </ol>
  );
}
