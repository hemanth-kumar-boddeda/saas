// The single list of edit operations. REST, MCP and the agent are all generated from this array,
// so there is exactly one place where an operation's arguments and behaviour are defined.
import { z } from "zod";
import * as ops from "./ops";
import { Timeline } from "./schema";

export interface OpContext {
  silences(sourceId: string): Promise<{ start: number; end: number }[]>;
  words(sourceId: string): Promise<{ w: string; roman?: string; start: number; end: number; speaker?: string; lang?: string }[]>;
}
export interface EditOp {
  name: string;
  description: string;
  args: z.ZodTypeAny;
  run: (t: Timeline, a: any, c: OpContext) => Promise<Timeline> | Timeline;
}

const id = z.string().min(1);
const sec = z.number().finite().min(0);
export const EDIT_OPS: EditOp[] = [
  { name: "trim_clip", description: "Set a media clip's source in/out points", args: z.object({ clipId: id, in: sec.optional(), out: sec.optional() }), run: (t, a) => ops.trimClip(t, a.clipId, a) },
  { name: "split_clip", description: "Split a clip (and linked clips) at a timeline time", args: z.object({ clipId: id, at: sec }), run: (t, a) => ops.splitClip(t, a.clipId, a.at) },
  { name: "remove_range", description: "Delete a timeline range and close the gap on all tracks", args: z.object({ from: sec, to: sec }), run: (t, a) => ops.removeRange(t, a.from, a.to) },
  { name: "remove_silences", description: "Cut measured silences from a source", args: z.object({ sourceId: id, minSilence: sec.optional(), pad: sec.optional() }),
    run: async (t, a, c) => ops.removeSilences(t, a.sourceId, await c.silences(a.sourceId), a) },
  { name: "move_segment", description: "Move a timeline range to another position without deleting anything (e.g. hook to the start; at=0)", args: z.object({ from: sec, to: sec, at: sec.optional() }), run: (t, a) => ops.moveSegment(t, a.from, a.to, a.at) },
  { name: "reorder_clips", description: "Reorder clips on a track; linked clips follow", args: z.object({ trackId: id, orderedIds: z.array(id).min(1) }), run: (t, a) => ops.reorderClips(t, a.trackId, a.orderedIds) },
  { name: "reframe_vertical", description: "Crop to 9:16 around a horizontal subject position (0..1)", args: z.object({ subjectX: z.number().min(0).max(1).optional() }), run: (t, a) => ops.reframeVertical(t, a.subjectX) },
  { name: "add_captions", description: "Build captions from the source's transcript", args: z.object({ sourceId: id, script: z.enum(["native", "roman"]).optional(), maxWords: z.number().int().min(1).max(12).optional() }),
    run: async (t, a, c) => ops.addCaptions(t, a.sourceId, await c.words(a.sourceId), { script: a.script, maxWords: a.maxWords }) },
  { name: "edit_caption_word", description: "Correct one caption word", args: z.object({ cueId: id, index: z.number().int().min(0), text: z.string().min(1), field: z.enum(["w", "roman"]).optional() }), run: (t, a) => ops.editCaptionWord(t, a.cueId, a.index, a.text, a.field) },
  { name: "set_clip_audio", description: "Gain, fades and dialogue enhancement for a clip", args: z.object({ clipId: id, gainDb: z.number().min(-60).max(24).optional(), fadeIn: sec.optional(), fadeOut: sec.optional(), enhance: z.enum(["dialogue"]).optional() }),
    run: (t, a) => ops.setClipAudio(t, a.clipId, { gainDb: a.gainDb ?? 0, fadeIn: a.fadeIn ?? 0, fadeOut: a.fadeOut ?? 0, enhance: a.enhance }) },
  { name: "switch_camera", description: "Switch the video to another source from `at` until `until`", args: z.object({ at: sec, toSourceId: id, until: sec.optional() }), run: (t, a) => ops.switchCamera(t, a.at, a.toSourceId, a.until) },
  { name: "add_text_overlay", description: "Add a text overlay", args: z.object({ text: z.string().min(1).max(200), start: sec, duration: z.number().positive() }), run: (t, a) => ops.addTextOverlay(t, a.text, a.start, a.duration) },
  { name: "set_transition", description: "Set a clip transition", args: z.object({ clipId: id, type: z.enum(["cut", "fade", "xfade"]), duration: sec }), run: (t, a) => ops.setTransition(t, a.clipId, { type: a.type, duration: a.duration }) },
];
export const opByName = (n: string) => EDIT_OPS.find((o) => o.name === n);
