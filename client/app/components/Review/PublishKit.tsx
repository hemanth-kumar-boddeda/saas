"use client";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  errMsg, useCreateChannelMutation, useEditKitMutation, useGetKitQuery, useListChannelsQuery,
  useSetProjectChannelMutation, useStartKitMutation,
} from "../../../redux/features/review/reviewApi";
import Publish from "./Publish";

const card = "cf-glass p-5";
const btn = "cf-btn text-sm";
const primary = `${btn} cf-btn-primary`;
const ghost = `${btn} cf-btn-secondary`;
const input = "cf-input";
const STEPS: Record<string, string> = {
  queued: "Waiting in queue", transcribing: "Transcribing audio", ranking_frames: "Picking the best frames",
  writing_copy: "Writing titles, description and chapters", building_thumbnails: "Building thumbnails",
};
const stamp = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const parseStamp = (s: string) => s.split(":").reduce((a, p) => a * 60 + Number(p), 0);
const chaptersToText = (c: any[]) => (c || []).map((x) => `${stamp(x.start)} ${x.title}`).join("\n");
const textToChapters = (t: string) =>
  t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [time, ...rest] = l.split(" ");
    return { start: parseStamp(time), title: rest.join(" ") };
  });
const absolute = (u: string) => new URL(u, process.env.NEXT_PUBLIC_SERVER_URL).href;

function ChannelBox({ projectId, channel, owner }: { projectId: string; channel?: string; owner: boolean }) {
  const { data } = useListChannelsQuery(undefined, { skip: !owner });
  const [setChannel] = useSetProjectChannelMutation();
  const [create, { isLoading }] = useCreateChannelMutation();
  const [f, setF] = useState({ name: "", niche: "", tone: "", primary: "#111827", secondary: "#ffffff", accent: "#facc15" });
  const [adding, setAdding] = useState(false);
  if (!owner) return null;
  const channels: any[] = data?.channels || [];
  const add = async () => {
    try {
      const r = await create({ name: f.name, niche: f.niche, tone: f.tone, brand: { primary: f.primary, secondary: f.secondary, accent: f.accent } }).unwrap();
      await setChannel({ id: projectId, channelId: r.channel._id }).unwrap();
      setAdding(false);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="mb-4">
      <label className="text-sm font-medium">Channel profile (niche, tone and brand colors guide every AI prompt)</label>
      <div className="flex gap-2 mt-1">
        <select className={input} value={channel || ""} onChange={(e) => setChannel({ id: projectId, channelId: e.target.value || null }).unwrap().catch((x) => toast.error(errMsg(x)))}>
          <option value="">No channel (neutral tone, default colors)</option>
          {channels.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <button className={ghost} onClick={() => setAdding(!adding)}>New</button>
      </div>
      {adding && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className={input} placeholder="Channel name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className={input} placeholder="Niche (e.g. budget travel)" value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })} />
          <input className={input} placeholder="Tone (e.g. witty, calm)" value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })} />
          <div className="flex items-center gap-2 text-sm">
            {(["primary", "secondary", "accent"] as const).map((k) => (
              <label key={k} className="flex items-center gap-1">{k}<input type="color" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
            ))}
          </div>
          <button className={primary} disabled={isLoading || !f.name.trim()} onClick={add}>Save channel</button>
        </div>
      )}
    </div>
  );
}

export default function PublishKit({ projectId, role, channel }: { projectId: string; role: string; channel?: string }) {
  const owner = role === "owner";
  const [poll, setPoll] = useState(0);
  const { data, isLoading } = useGetKitQuery(projectId, { pollingInterval: poll });
  const [start, { isLoading: starting }] = useStartKitMutation();
  const [save, { isLoading: saving }] = useEditKitMutation();
  const kit = data?.kit;
  const busy = kit?.status === "queued" || kit?.status === "running";
  useEffect(() => setPoll(busy ? 3000 : 0), [busy]);

  const [draft, setDraft] = useState<any>(null);
  useEffect(() => {
    if (kit?.status === "ready") {
      setDraft({
        titles: kit.titles, chosenTitle: kit.chosenTitle, description: kit.description, chapters: chaptersToText(kit.chapters),
        hashtags: (kit.hashtags || []).join(", "), tags: (kit.tags || []).join(", "), chosenThumbnail: kit.chosenThumbnail,
      });
    }
  }, [kit?._id, kit?.updatedAt, kit?.status]);

  const go = () => start(projectId).unwrap().catch((e) => toast.error(errMsg(e)));
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const onSave = async () => {
    try {
      await save({ id: projectId, edit: {
        titles: draft.titles, chosenTitle: draft.chosenTitle, description: draft.description, chapters: textToChapters(draft.chapters),
        hashtags: list(draft.hashtags), tags: list(draft.tags), chosenThumbnail: draft.chosenThumbnail,
      } }).unwrap();
      toast.success("Saved");
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <section className={`${card} mt-6`} aria-label="AI publish kit">
      <h2 className="text-lg font-semibold">Publish kit</h2>
      <p className="text-xs text-cf-muted mb-3">
        AI-generated suggestions from your transcript and video frames. Review and edit everything. No title or thumbnail can promise views or virality.
      </p>
      <ChannelBox projectId={projectId} channel={channel} owner={owner} />
      {isLoading && <p>Loading…</p>}
      {!kit && !isLoading && (owner
        ? <button className={primary} disabled={starting} onClick={go}>Generate publish kit</button>
        : <p className="text-sm text-cf-muted">The owner can generate the kit.</p>)}
      {busy && <p role="status">{STEPS[kit.step] || "Working"}…</p>}
      {kit?.status === "failed" && (
        <div>
          <p className="text-red-300 text-sm mb-2">{kit.error || "Generation failed."}</p>
          {owner && <button className={primary} disabled={starting} onClick={go}>Try again</button>}
        </div>
      )}
      {kit?.status === "ready" && draft && (
        <div className="grid gap-4">
          <div>
            <h3 className="font-medium mb-1">Thumbnails</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {kit.thumbnails.map((t: any, i: number) => (
                <label key={i} className={`block rounded-xl border p-1.5 bg-black/20 ${draft.chosenThumbnail === i ? "border-cf-violet" : "border-cf-line"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={absolute(t.url)} alt={`${t.label}: ${t.text}`} className="w-full rounded" />
                  <span className="flex items-center gap-2 text-xs mt-1">
                    <input type="radio" name="thumb" disabled={!owner} checked={draft.chosenThumbnail === i} onChange={() => setDraft({ ...draft, chosenThumbnail: i })} />
                    {t.label} · frame score {t.score}/100
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-1">Title options</h3>
            {draft.titles.map((t: string, i: number) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <input type="radio" name="title" aria-label={`Use title ${i + 1}`} disabled={!owner} checked={draft.chosenTitle === i} onChange={() => setDraft({ ...draft, chosenTitle: i })} />
                <input className={input} disabled={!owner} maxLength={100} value={t} onChange={(e) => setDraft({ ...draft, titles: draft.titles.map((x: string, j: number) => (j === i ? e.target.value : x)) })} />
              </div>
            ))}
          </div>
          <label className="block"><span className="font-medium text-sm">Description</span>
            <textarea className={`${input} h-40`} disabled={!owner} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className="block"><span className="font-medium text-sm">Chapters (one per line: m:ss Title)</span>
            <textarea className={`${input} h-28 font-mono`} disabled={!owner} value={draft.chapters} onChange={(e) => setDraft({ ...draft, chapters: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="font-medium text-sm">Hashtags (comma separated)</span>
              <input className={input} disabled={!owner} value={draft.hashtags} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })} /></label>
            <label className="block"><span className="font-medium text-sm">Tags (comma separated)</span>
              <input className={input} disabled={!owner} value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            {owner && <button className={primary} disabled={saving} onClick={onSave}>Save edits</button>}
            <a className={ghost} href={absolute(`projects/${projectId}/kit/srt`)}>Download captions (.srt)</a>
            {owner && <button className={ghost} disabled={starting} onClick={go}>Regenerate (replaces edits)</button>}
          </div>
          {owner && <Publish projectId={projectId} />}
        </div>
      )}
    </section>
  );
}
