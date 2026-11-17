// Pure edit operations. Each takes a Timeline and returns a NEW one (version+1, parent=old,
// approved=false). The input is never mutated, so approved versions stay intact.
// Every result is validated; an invalid result throws and nothing is saved.
import { randomUUID } from "crypto";
import { Clip, Timeline, Track, Word, clipEnd, totalDuration, validate } from "./schema";

export class EditError extends Error {}
const fail = (m: string): never => { throw new EditError(m); };
const newId = () => randomUUID().slice(0, 8);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const finish = (old: Timeline, next: Timeline): Timeline => {
  next.version = old.version + 1;
  next.parent = old.version;
  next.approved = false;
  const issues = validate(next);
  if (issues.length) throw new EditError(`invalid timeline: ${issues.slice(0, 5).join("; ")}`);
  return next;
};
const track = (t: Timeline, id: string) => t.tracks.find((x) => x.id === id) ?? fail(`unknown track ${id}`);
const findClip = (t: Timeline, id: string) => {
  for (const tr of t.tracks) { const c = tr.clips.find((x) => x.id === id); if (c) return { tr, c }; }
  return fail(`unknown clip ${id}`);
};

/** Restricts a clip to the timeline range [a,b). Returns null if nothing remains. */
const slice = (c: Clip, a: number, b: number): Clip | null => {
  const lo = Math.max(a, c.start), hi = Math.min(b, clipEnd(c));
  if (hi - lo < 1e-6) return null;
  const o = clone(c);
  if (c.sourceId) { o.in = c.in! + (lo - c.start); o.out = o.in + (hi - lo); }
  if (c.words) {
    o.words = c.words.filter((w) => w.end > lo && w.start < hi).map((w) => ({ ...w, start: Math.max(w.start, lo), end: Math.min(w.end, hi) }));
    if (!o.words.length) return null;
  }
  if (c.keyframes) o.keyframes = c.keyframes.map((k) => ({ ...k, t: k.t - (lo - c.start) })).filter((k) => k.t >= 0 && k.t <= hi - lo);
  o.start = lo; o.duration = hi - lo;
  return o;
};
const shift = (c: Clip, d: number): Clip => ({ ...c, start: c.start + d, words: c.words?.map((w) => ({ ...w, start: w.start + d, end: w.end + d })) });

const cutRange = (t: Timeline, from: number, to: number) => {
  const d = to - from;
  for (const tr of t.tracks) {
    const out: Clip[] = [];
    for (const c of tr.clips) {
      if (clipEnd(c) <= from + 1e-9) { out.push(c); continue; }
      if (c.start >= to - 1e-9) { out.push(shift(c, -d)); continue; }
      const left = c.start < from ? slice(c, c.start, from) : null;
      const right = clipEnd(c) > to ? slice(c, to, clipEnd(c)) : null;
      if (left) out.push(left);
      if (right) out.push({ ...shift(right, -d), id: left ? newId() : c.id });
    }
    tr.clips = out;
  }
};

/**
 * Moves the timeline range [from,to) so it starts at `at` (a position in the timeline WITHOUT the segment;
 * 0 = the very start). Nothing is deleted: sources are untouched, clips are only re-cut and re-placed on
 * every track, so linked audio, captions and overlays move with the picture.
 */
export const moveSegment = (t: Timeline, from: number, to: number, at = 0): Timeline => {
  const total = totalDuration(t), d = to - from;
  if (!(d > 0) || from < 0 || to > total + 1e-6) return fail(`segment ${from}-${to}s is outside the ${total.toFixed(2)}s timeline`);
  if (at < 0 || at > total - d + 1e-6) return fail(`target ${at}s is outside 0-${(total - d).toFixed(2)}s`);
  if (Math.abs(at - from) < 1e-6) return fail("segment is already at that position");
  const atOrig = at < from ? at : at + d; // `at` expressed in the original timeline
  const cuts = [...new Set([from, to, atOrig].map((x) => +x.toFixed(6)))].filter((x) => x > 1e-6 && x < total - 1e-6).sort((a, b) => a - b);
  const bounds = [0, ...cuts, total];
  const place = (x: number) => { // original time of a piece start -> final time
    if (x >= from - 1e-9 && x < to - 1e-9) return at + (x - from);
    const r = x < from ? x : x - d; // position in the timeline without the segment
    return r >= at - 1e-9 ? r + d : r;
  };
  const n = clone(t);
  for (const tr of n.tracks) {
    const out: Clip[] = [];
    for (const c of tr.clips) {
      let first = true;
      for (let i = 0; i < bounds.length - 1; i++) {
        const a = bounds[i]!, b = bounds[i + 1]!;
        const piece = slice(c, a, b);
        if (!piece) continue;
        const moved = shift(piece, place(piece.start) - piece.start);
        if (!first) moved.id = newId();
        if (c.group) moved.group = `${c.group}_${i}`; // linked clips slice identically, so their pieces keep matching groups
        first = false;
        out.push(moved);
      }
    }
    tr.clips = out.sort((x, y) => x.start - y.start);
  }
  return finish(t, n);
};

export const trimClip = (t: Timeline, clipId: string, o: { in?: number; out?: number }): Timeline => {
  const n = clone(t); const { c } = findClip(n, clipId);
  if (!c.sourceId) return fail("only media clips can be trimmed");
  const ni = o.in ?? c.in!, no = o.out ?? c.out!;
  if (no <= ni) return fail("out must be greater than in");
  // keep the clip's start; linked clips are trimmed to match
  const delta = ni - c.in!;
  for (const tr of n.tracks) for (const k of tr.clips) {
    if (k.id === clipId || (c.group && k.group === c.group && k.sourceId === c.sourceId)) {
      k.in = k.in! + delta; k.out = k.in + (no - ni); k.duration = no - ni;
    }
  }
  return finish(t, n);
};

export const splitClip = (t: Timeline, clipId: string, at: number): Timeline => {
  const n = clone(t); const { c } = findClip(n, clipId);
  if (at <= c.start + 1e-6 || at >= clipEnd(c) - 1e-6) return fail("split point must be inside the clip");
  const group = c.group;
  const newGroup = group ? newId() : undefined;
  for (const tr of n.tracks) {
    tr.clips = tr.clips.flatMap((k) => {
      const linked = k.id === clipId || (group && k.group === group && k.start <= at && clipEnd(k) > at);
      if (!linked) return [k];
      const a = slice(k, k.start, at), b = slice(k, at, clipEnd(k));
      if (!a || !b) return [k];
      b.id = newId();
      if (newGroup) b.group = newGroup;
      return [a, b];
    });
  }
  return finish(t, n);
};

export const removeRange = (t: Timeline, from: number, to: number): Timeline => {
  if (!(to > from) || from < 0) return fail("invalid range");
  if (to > totalDuration(t) + 1e-6) return fail(`range ends at ${to}s but the timeline is ${totalDuration(t).toFixed(2)}s long`);
  const n = clone(t); cutRange(n, from, to); return finish(t, n);
};

/** silences are in SOURCE time of sourceId. pad keeps a short breath on each side. */
export const removeSilences = (
  t: Timeline, sourceId: string, silences: { start: number; end: number }[],
  o: { minSilence?: number; pad?: number } = {}
): Timeline => {
  const min = o.minSilence ?? 0.5, pad = o.pad ?? 0.12;
  const lead = t.tracks.find((tr) => tr.clips.some((c) => c.sourceId === sourceId));
  if (!lead) return fail(`source ${sourceId} is not on the timeline`);
  const ranges: [number, number][] = [];
  for (const c of lead.clips.filter((x) => x.sourceId === sourceId))
    for (const s of silences) {
      if (s.end - s.start < min) continue;
      const a = Math.max(s.start + pad, c.in!), b = Math.min(s.end - pad, c.out!);
      if (b - a > 0.05) ranges.push([c.start + (a - c.in!), c.start + (b - c.in!)]);
    }
  ranges.sort((x, y) => y[0] - x[0]); // latest first so earlier times stay valid
  const n = clone(t);
  for (const [a, b] of ranges) cutRange(n, a, b);
  return finish(t, n);
};

export const reorderClips = (t: Timeline, trackId: string, orderedIds: string[]): Timeline => {
  const n = clone(t); const tr = track(n, trackId);
  const have = new Set(tr.clips.map((c) => c.id));
  if (orderedIds.length !== have.size || !orderedIds.every((i) => have.has(i))) return fail("orderedIds must list every clip of the track exactly once");
  const base = Math.min(...tr.clips.map((c) => c.start));
  const byId = new Map(tr.clips.map((c) => [c.id, c]));
  const oldStart = new Map(tr.clips.map((c) => [c.id, c.start]));
  let pos = base;
  const moves = new Map<string, { group?: string; from: number; to: number }>();
  for (const id of orderedIds) {
    const c = byId.get(id)!;
    moves.set(id, { group: c.group, from: oldStart.get(id)!, to: pos });
    c.start = pos; pos += c.duration;
  }
  const pairs = [...moves.values()].filter((m) => m.group);
  for (const other of n.tracks) if (other.id !== trackId)
    other.clips = other.clips.map((k) => {
      const m = pairs.find((p) => p.group === k.group);
      return m ? { ...k, start: m.to + (k.start - m.from) } : k;
    });
  return finish(t, n);
};

const setOnClip = (t: Timeline, clipId: string, f: (c: Clip) => void): Timeline => {
  const n = clone(t); f(findClip(n, clipId).c); return finish(t, n);
};
export const setClipAudio = (t: Timeline, clipId: string, a: NonNullable<Clip["audio"]>) =>
  setOnClip(t, clipId, (c) => { c.audio = { ...c.audio, ...a }; });
export const setTransform = (t: Timeline, clipId: string, x: NonNullable<Clip["transform"]>) =>
  setOnClip(t, clipId, (c) => { c.transform = { ...c.transform, ...x }; });
export const addKeyframe = (t: Timeline, clipId: string, k: NonNullable<Clip["keyframes"]>[number]) =>
  setOnClip(t, clipId, (c) => { c.keyframes = [...(c.keyframes ?? []), k]; });
export const setTransition = (t: Timeline, clipId: string, tr: NonNullable<Clip["transition"]>) =>
  setOnClip(t, clipId, (c) => { c.transition = tr; });

/** Replaces the part of the video clip containing `at` with another camera. Uses source offsets for sync. */
export const switchCamera = (t: Timeline, at: number, toSourceId: string, until?: number): Timeline => {
  const to = t.sources[toSourceId] ?? fail(`unknown source ${toSourceId}`);
  const vtr = t.tracks.find((x) => x.kind === "video") ?? fail("no video track");
  const hit = vtr.clips.find((c) => c.start <= at && at < clipEnd(c)) ?? fail(`no video at ${at}s`);
  if (hit.sourceId === toSourceId) return fail("already on that camera");
  let n = hit.start < at - 1e-6 ? splitClip(t, hit.id, at) : clone(t);
  const pick = (tl: Timeline) => tl.tracks.find((x) => x.kind === "video")!.clips.find((c) => Math.abs(c.start - at) < 1e-6)!;
  let second = pick(n);
  if (until !== undefined && until > at + 1e-6 && until < clipEnd(second) - 1e-6) { n = splitClip(n, second.id, until); second = pick(n); }
  const from = n.sources[second.sourceId!]!;
  const common = second.in! - from.offset; // common timebase
  const ni = common + to.offset;
  if (ni < 0 || ni + second.duration > to.duration + 1e-6) return fail("other camera does not cover that range");
  const m = clone(n);
  const c = findClip(m, second.id).c;
  c.sourceId = toSourceId; c.in = ni; c.out = ni + c.duration; c.group = undefined; // audio stays on the primary source
  return finish(t, m);
};

/** Crops 16:9 sources to a 9:16 window around subjectX (0..1). */
export const reframeVertical = (t: Timeline, subjectX = 0.5): Timeline => {
  const n = clone(t);
  n.output = { width: 1080, height: 1920, fps: n.output.fps };
  for (const tr of n.tracks) if (tr.kind === "video") for (const c of tr.clips) {
    const s = n.sources[c.sourceId!]!;
    if (!s.width || !s.height) return fail(`source ${c.sourceId} has no dimensions`);
    const w = Math.min(1, (s.height * 9) / 16 / s.width);
    const x = Math.min(1 - w, Math.max(0, subjectX - w / 2));
    c.transform = { x: 0, y: 0, scale: 1, rotation: 0, ...c.transform, crop: { x, y: 0, w, h: 1 } };
  }
  return finish(t, n);
};

/** Builds caption cues from SOURCE-time words, mapped onto kept video clips. Replaces the caption track. */
export const addCaptions = (
  t: Timeline, sourceId: string, words: Word[],
  o: { maxWords?: number; maxSeconds?: number; script?: "native" | "roman" } = {}
): Timeline => {
  const maxW = o.maxWords ?? 4, maxS = o.maxSeconds ?? 2.5;
  const lead = t.tracks.find((tr) => tr.kind === "video" && tr.clips.some((c) => c.sourceId === sourceId));
  if (!lead) return fail(`source ${sourceId} is not on a video track`);
  const mapped: Word[] = [];
  for (const w of words) {
    const c = lead.clips.find((k) => k.sourceId === sourceId && w.start >= k.in! - 1e-6 && w.end <= k.out! + 1e-6);
    if (c) mapped.push({ ...w, start: c.start + (w.start - c.in!), end: c.start + (w.end - c.in!) });
  }
  if (!mapped.length) return fail("no transcript words fall inside the kept footage");
  mapped.sort((a, b) => a.start - b.start);
  const cues: Clip[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    const s = cur[0]!.start, e = cur[cur.length - 1]!.end;
    cues.push({ id: newId(), start: s, duration: Math.max(e - s, 0.05), words: cur, captionStyle: { script: o.script ?? "native", font: "sans", size: 64, color: "#ffffff", highlight: "#ffd400", position: "bottom" } });
    cur = [];
  };
  for (const w of mapped) {
    if (cur.length && (cur.length >= maxW || w.end - cur[0]!.start > maxS || w.start < cur[cur.length - 1]!.end - 1e-6 || w.start - cur[cur.length - 1]!.end > 0.8)) flush();
    cur.push(w);
  }
  flush();
  // resolve small overlaps between cues
  for (let i = 1; i < cues.length; i++) {
    const p = cues[i - 1]!;
    if (clipEnd(p) > cues[i]!.start) { p.duration = cues[i]!.start - p.start; p.words = p.words!.map((w) => ({ ...w, end: Math.min(w.end, cues[i]!.start) })); }
  }
  const n = clone(t);
  n.tracks = n.tracks.filter((x) => x.kind !== "caption");
  n.tracks.push({ id: "captions", kind: "caption", clips: cues });
  return finish(t, n);
};

export const editCaptionWord = (t: Timeline, cueId: string, index: number, text: string, field: "w" | "roman" = "w") =>
  setOnClip(t, cueId, (c) => { const w = c.words?.[index] ?? fail("no such word"); w[field] = text; });

export const addTextOverlay = (t: Timeline, text: string, start: number, duration: number): Timeline => {
  const n = clone(t);
  let tr = n.tracks.find((x) => x.kind === "overlay");
  if (!tr) { tr = { id: "overlay", kind: "overlay", clips: [] } as Track; n.tracks.push(tr); }
  tr.clips.push({ id: newId(), start, duration, text: { value: text, size: 64, color: "#ffffff" } });
  return finish(t, n);
};

/** Starts a timeline from one source: linked video + audio clip covering [in,out]. */
export const fromSource = (
  project: string, sourceId: string,
  src: { storageKey: string; duration: number; width: number; height: number; hasAudio: boolean; language?: string },
  range?: { in: number; out: number }
): Timeline => {
  const i = range?.in ?? 0, o = range?.out ?? src.duration, group = newId();
  const mk = (id: string, kind: "video" | "audio"): Track => ({ id, kind, clips: [{ id: newId(), sourceId, start: 0, duration: o - i, in: i, out: o, group }] });
  const tracks: Track[] = [mk("v1", "video")];
  if (src.hasAudio) tracks.push(mk("a1", "audio"));
  const t: Timeline = {
    schemaVersion: 1, project, version: 1, parent: null, approved: false,
    output: { width: src.width, height: src.height, fps: 30 },
    sources: { [sourceId]: { ...src, offset: 0 } }, tracks,
  };
  const issues = validate(t);
  if (issues.length) throw new EditError(issues.join("; "));
  return t;
};
export { totalDuration };
