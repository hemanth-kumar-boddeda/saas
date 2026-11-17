// Plan schema and the deterministic validation layer. The model proposes; this file decides what is
// allowed. Only registry operations exist here. Nothing in a plan is ever a shell command or a path.
import { z } from "zod";
import { EDIT_OPS, OpContext, opByName } from "../registry";
import { EditError } from "../ops";
import { Timeline, totalDuration } from "../schema";
import { selectionSchema } from "../skills/talkingHead";

export const MAX_OPS = 20;
const opNames = EDIT_OPS.map((o) => o.name) as [string, ...string[]];

/** What the model is asked to return. Strings that are not registry names are rejected here. */
export const planReplySchema = z.object({
  summary: z.string().min(5).max(1000),
  storySelection: selectionSchema.optional(),
  ops: z.array(z.object({ op: z.enum(opNames), args: z.record(z.string(), z.unknown()).default({}), rationale: z.string().min(3).max(500) })).max(MAX_OPS),
});
export type PlanReply = z.infer<typeof planReplySchema>;

export interface PlanOp {
  id: string; op: string; args: Record<string, unknown>;
  target: { clipId?: string; trackId?: string; sourceId?: string; cueId?: string; at?: number } | null;
  rationale: string; source: "model" | "story_skill"; warnings: string[]; valid: boolean; error?: string; approved: boolean;
}

const TARGET_KEYS = ["clipId", "trackId", "sourceId", "cueId", "at"] as const;
export const targetOf = (args: Record<string, unknown>): PlanOp["target"] => {
  const t: Record<string, unknown> = {};
  for (const k of TARGET_KEYS) if (args[k] !== undefined) t[k] = args[k];
  return Object.keys(t).length ? (t as PlanOp["target"]) : null;
};

/** Operation catalog shown to the model: names, descriptions and JSON schemas generated from the registry. */
export const catalog = () => EDIT_OPS.map((o) => ({ op: o.name, description: o.description, args: z.toJSONSchema(o.args, { unrepresentable: "any" }) }));

/**
 * Dry-runs the ops in order on a copy. Each op gets valid/error/warnings. Invalid ops are skipped so
 * later ops are judged on the last good timeline. Nothing is persisted.
 */
export const validatePlan = async (base: Timeline, raw: { op: string; args: Record<string, unknown>; rationale: string; source: PlanOp["source"] }[], ctx: OpContext) => {
  const ops: PlanOp[] = [];
  let t = base;
  for (const [i, r] of raw.entries()) {
    const o: PlanOp = { id: `op${i + 1}`, op: r.op, args: r.args, target: targetOf(r.args), rationale: r.rationale, source: r.source, warnings: [], valid: false, approved: false };
    const def = opByName(r.op);
    if (!def) { o.error = `unknown operation ${r.op}`; ops.push(o); continue; }
    const a = def.args.safeParse(r.args);
    if (!a.success) { o.error = `bad arguments: ${a.error.issues[0]?.path.join(".")} ${a.error.issues[0]?.message}`; ops.push(o); continue; }
    o.args = a.data as Record<string, unknown>; o.target = targetOf(o.args);
    try {
      const next = await def.run(t, a.data, ctx);
      const before = totalDuration(t), after = totalDuration(next);
      if (before > 0 && (before - after) / before > 0.5) o.warnings.push(`removes ${(((before - after) / before) * 100).toFixed(0)}% of the current length`);
      if (after < 5) o.warnings.push(`leaves only ${after.toFixed(1)} s`);
      o.valid = true; t = next;
    } catch (e: any) {
      if (!(e instanceof EditError)) throw e;
      o.error = e.message;
    }
    ops.push(o);
  }
  return { ops, result: t, preview: { beforeSeconds: +totalDuration(base).toFixed(2), afterSeconds: +totalDuration(t).toFixed(2), opsValid: ops.filter((x) => x.valid).length, opsInvalid: ops.filter((x) => !x.valid).length } };
};

/** Defensive parse of a model reply: strips code fences, then validates. */
export const parsePlanReply = (text: string): { ok: true; data: PlanReply } | { ok: false; error: string } => {
  let s = text.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (fence) s = fence[1]!.trim();
  let j: unknown;
  try { j = JSON.parse(s); } catch { return { ok: false, error: "reply is not valid JSON" }; }
  const r = planReplySchema.safeParse(j);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: `${r.error.issues[0]?.path.join(".") || "reply"}: ${r.error.issues[0]?.message}` };
};
