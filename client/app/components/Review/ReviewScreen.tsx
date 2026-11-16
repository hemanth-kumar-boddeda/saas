"use client";
import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import Player, { PlayerHandle } from "./Player";
import PublishKit from "./PublishKit";
import {
  errMsg, useAddCommentMutation, useAddEditorMutation, useAddVersionMutation, useApprovalsQuery, useCreateLinkMutation, useDecideMutation,
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
  const { data, isLoading, error } = useGetProjectQuery(projectId);
  const [picked, setPicked] = useState<string | null>(null);
  const versions: any[] = data?.versions || [];
  const vid = picked || versions[versions.length - 1]?._id;
  const version = versions.find((v) => v._id === vid);
  const project = data?.project;
  const role: string = project?.role || "guest";
  const isLatest = version && version.number === project?.currentVersion;

  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const player = useRef<PlayerHandle>(null);
  const [now, setNow] = useState(0);

  const { data: cdata, isFetching: loadingComments } = useListCommentsQuery(
    { id: projectId, vid: vid!, status: status || undefined, mine },
    { skip: !vid }
  );
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
  const duration: number = version?.duration || 0;

  return (
    <div className="cf-rise mx-auto max-w-7xl p-4 sm:p-6 text-cf-text">
      <header className="flex flex-wrap items-center gap-3 mb-4">
        {!guest && <Link href="/projects" className="text-sm underline">← Projects</Link>}
        <h1 className="cf-hero-gradient text-2xl font-semibold tracking-tight sm:text-3xl">{project.title}</h1>
        <StatusBadge status={project.status} />
        <select
          aria-label="Version"
          className={`${input} !w-auto ml-auto`}
          value={vid || ""}
          onChange={(e) => setPicked(e.target.value)}
        >
          {versions.map((v) => (
            <option key={v._id} value={v._id}>
              Version {v.number}{v.number === project.currentVersion ? " (latest)" : ""}
            </option>
          ))}
        </select>
      </header>

      {!version ? (
        <div className={`${card} text-center`}>
          <p className="mb-2">No video yet.</p>
          {role !== "guest" && <p className="text-sm text-cf-muted">Upload the first version below.</p>}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <section>
            {version.processing === "pending" && <div className={card}>Processing video… this page updates when you reload.</div>}
            {version.processing === "failed" && <div className={`${card} text-red-300`}>Processing failed. Upload this version again.</div>}
            {version.kind === "link" && (
              <div className={card}>
                <a className="underline break-all" href={version.externalUrl} target="_blank" rel="noreferrer noopener">{version.externalUrl}</a>
                <p className="text-xs text-cf-muted mt-1">External link: open it in a new tab and enter timecodes by hand.</p>
              </div>
            )}
            {stream.isFetching && <div className={card}>Loading player…</div>}
            {stream.data?.kind === "hls" && <Player ref={player} src={stream.data.url} onTime={setNow} />}
            {stream.isError && <p className="text-red-300 text-sm">{errMsg(stream.error)}</p>}

            {duration > 0 && (
              <div className="relative h-6 mt-2 rounded bg-white/10" aria-label="Comment timeline">
                {roots.map((c) => (
                  <button
                    key={c._id}
                    title={`${fmt(c.timecode)} ${c.body}`}
                    onClick={() => player.current?.seek(c.timecode)}
                    style={{ left: `${Math.min(100, (c.timecode / duration) * 100)}%` }}
                    className={`absolute top-0 h-6 w-2 -ml-1 rounded ${c.status === "resolved" ? "bg-green-400" : "bg-amber-400"}`}
                  />
                ))}
              </div>
            )}
            <div className="mt-2"><Notice /></div>
            {!isLatest && <p className="mt-2 text-sm text-amber-300">You are viewing an older version. Comments here belong to this version only.</p>}
          </section>

          <aside className={`${card} flex flex-col max-h-[80vh]`}>
            <div className="flex items-center gap-2 mb-2">
              <select aria-label="Filter" className={`${input} !w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
              <label className="text-sm flex items-center gap-1">
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Mine
              </label>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3">
              {loadingComments && <p className="text-sm text-cf-muted">Loading comments…</p>}
              {!loadingComments && roots.length === 0 && <p className="text-sm text-cf-muted">No comments yet. Pause the video and add the first one.</p>}
              {roots.map((c) => (
                <Thread key={c._id} c={c} replies={comments.filter((r) => r.parentId === c._id)} projectId={projectId} vid={vid} role={role} seek={(t: number) => player.current?.seek(t)} />
              ))}
            </div>
            <NewComment projectId={projectId} vid={vid} now={now} manual={version.kind === "link"} duration={duration} />
          </aside>
        </div>
      )}

      {!guest && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <UploadVersion projectId={projectId} />
          {role === "owner" && version && isLatest && <ApprovalBox projectId={projectId} vid={vid} status={project.status} />}
          {role === "owner" && <ShareLinks projectId={projectId} />}
          {role === "owner" && <InviteEditor projectId={projectId} count={project.editors?.length || 0} />}
          <ApprovalLog projectId={projectId} />
        </div>
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
        <button className="font-mono underline" onClick={() => seek(c.timecode)}>{fmt(c.timecode)}</button>
        <span>{c.authorName}</span>
        {c.status === "resolved" && <span className="text-green-300">resolved</span>}
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>
      {replies.map((r: any) => (
        <p key={r._id} className="text-sm ml-3 mt-1 pl-2 border-l border-cf-line">
          <span className="text-xs text-cf-muted">{r.authorName}: </span>{r.body}
        </p>
      ))}
      <div className="flex gap-3 mt-1 text-xs">
        <button className="underline" onClick={() => setOpen(!open)}>Reply</button>
        {canResolve && (
          <button className="underline" onClick={() => setStatus({ id: projectId, cid: c._id, status: c.status === "open" ? "resolved" : "open" }).unwrap().catch((e) => toast.error(errMsg(e)))}>
            {c.status === "open" ? "Resolve" : "Reopen"}
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

function NewComment({ projectId, vid, now, manual, duration }: any) {
  const [body, setBody] = useState("");
  const [time, setTime] = useState("0:00");
  const [add, { isLoading }] = useAddCommentMutation();
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const t = manual ? parseTime(time) : now;
        if (Number.isNaN(t)) return toast.error("Enter time as m:ss");
        try {
          await add({ id: projectId, vid, body, timecode: t }).unwrap();
          setBody("");
        } catch (er) { toast.error(errMsg(er)); }
      }}
    >
      <div className="flex items-center gap-2 text-sm">
        {manual ? (
          <input aria-label="Timecode" className={`${input} !w-24`} value={time} onChange={(e) => setTime(e.target.value)} />
        ) : (
          <span className="font-mono">@ {fmt(now)}</span>
        )}
        {duration > 0 && <span className="text-cf-muted">of {fmt(duration)}</span>}
      </div>
      <textarea className={input} rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Comment at this moment" />
      <button className={btnPrimary} disabled={isLoading || !body.trim()}>Add comment</button>
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
      await decide({ id: projectId, action, versionId: vid, note: note || undefined }).unwrap();
      toast.success(action === "approve" ? "Approved" : "Changes requested");
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

function InviteEditor({ projectId, count }: { projectId: string; count: number }) {
  const [email, setEmail] = useState("");
  const [add, { isLoading }] = useAddEditorMutation();
  return (
    <form
      className={card}
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await add({ id: projectId, email: email.trim() }).unwrap();
          toast.success("Editor added");
          setEmail("");
        } catch (er) { toast.error(errMsg(er)); }
      }}
    >
      <h2 className="font-medium mb-1">Editors</h2>
      <p className="text-xs text-cf-muted mb-2">{count} editor{count === 1 ? "" : "s"}. Editors can upload versions and comment. They must have a CreatorFlow account.</p>
      <div className="flex gap-2">
        <label htmlFor="editor-email" className="sr-only">Editor email</label>
        <input id="editor-email" type="email" required className={input} placeholder="editor@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className={btnPrimary} disabled={isLoading || !email.trim()}>Add editor</button>
      </div>
    </form>
  );
}
