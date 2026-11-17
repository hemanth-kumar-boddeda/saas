// A skill is editorial knowledge plus deterministic analysis. It never executes anything: it reads
// measured facts, states rules, and names registry operations. Execution always goes through the plan
// pipeline (validate -> approve -> execute).
import { z } from "zod";
import { Timeline, Word } from "../schema";
import { Measured } from "../render/provider";

export interface AssetFacts { id: string; duration: number; silences: { start: number; end: number }[]; loudnessLufs?: number }
export interface SkillContext {
  timeline: Timeline;
  assets: AssetFacts[];
  transcript?: { assetId: string; language?: string; script?: string; words: Word[] };
  render?: Measured; // real measurements of a rendered file, when one exists
  preferences?: { captionScript?: "native" | "roman"; targetSeconds?: number; language?: string };
}
export interface EvalCase { name: string; input: SkillContext; expect: (out: any) => boolean | string }
export interface Skill<I = SkillContext, O = unknown> {
  name: string;
  description: string;
  responsibility: string;
  inputSchema: z.ZodTypeAny; // shape of the input documented for callers; `analyze` receives SkillContext
  outputSchema: z.ZodTypeAny;
  rules: string[];
  decisionCriteria: string[];
  operations: string[]; // registry names this skill may recommend
  escalation: string[]; // when to stop and ask a human instead of acting
  analyze(input: I): O;
  evalCases: EvalCase[];
}
export const recommendation = z.object({ op: z.string(), args: z.record(z.string(), z.unknown()), why: z.string() });
export type Recommendation = z.infer<typeof recommendation>;
export const finding = z.object({ severity: z.enum(["info", "warn", "block"]), code: z.string(), message: z.string() });
export type Finding = z.infer<typeof finding>;
