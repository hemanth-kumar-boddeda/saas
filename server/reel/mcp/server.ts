// MCP server. Tools are thin wrappers over the SAME operation/planning functions the REST API calls;
// edit tools are generated from registry.ts, so an operation is defined in exactly one place.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import ErrorHandler from "../../utils/ErrorHandler";
import { Scope } from "../apiTokens";
import { ProviderNotConfigured } from "../jobs";
import * as op from "../operations";
import * as planning from "../planning";
import { EDIT_OPS } from "../registry";
import { asrStatus } from "../asr";
import { publicTimeline } from "../routes";
import { planReplySchema } from "../planner/plan";

export interface McpDeps { enqueueJob(id: string): Promise<void>; enqueueKit(id: string): Promise<void> }
const id = z.string().min(1);
const pid = { projectId: id.describe("Project id") };

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] });
const fail = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

export const buildMcpServer = (principal: { userId: string; scopes: Scope[] }, deps: McpDeps) => {
  const server = new McpServer({ name: "reelflow", version: "1.0.0" });
  const who = { userId: principal.userId };

  /** Registers a tool that checks the token scope, runs the shared function, and turns errors into tool errors. */
  const tool = <S extends z.ZodRawShape>(name: string, description: string, scope: Scope, shape: S, run: (a: z.infer<z.ZodObject<S>>) => Promise<unknown>) =>
    server.registerTool(name, { description, inputSchema: z.object(shape) as any }, async (args: any) => {
      if (!principal.scopes.includes(scope)) return fail(`This token lacks the ${scope} scope`);
      try { return text(await run(args)); }
      catch (e: any) {
        if (e instanceof ProviderNotConfigured) return fail(`PROVIDER_NOT_CONFIGURED: ${e.message}`);
        if (e instanceof ErrorHandler && e.expose) return fail(e.message);
        return fail("Something went wrong. Please try again.");
      }
    });

  tool("get_capabilities", "List editing operations and speech-to-text provider status.", "reel:read", {}, async () => ({ operations: EDIT_OPS.map((o) => ({ name: o.name, description: o.description })), asr: asrStatus(), planner: { name: "gemini", configured: !!process.env.GEMINI_API_KEY, envVar: "GEMINI_API_KEY" } }));
  tool("list_projects", "List the projects you own or edit.", "reel:read", {}, () => op.listProjects(who));
  tool("create_project", "Create a project.", "reel:write", { title: z.string().min(1).max(120), brief: z.string().max(5000).optional() },
    async (a) => { const p: any = await op.createProject(who, a.title, a.brief); return { id: String(p._id), title: p.title }; });
  tool("list_assets", "List media assets of a project (upload happens in the web app or POST /v1/reel/projects/:id/assets).", "reel:read", pid, (a) => op.listAssets(who, a.projectId));
  tool("get_media_analysis", "Measured facts for an asset: duration, size, loudness (LUFS), silent spans.", "reel:read", { ...pid, assetId: id }, (a) => op.getMediaAnalysis(who, a.projectId, a.assetId));
  tool("transcribe", "Start speech-to-text for an asset (Sarvam primary, Groq fallback). Returns a job.", "reel:write",
    { ...pid, assetId: id, provider: z.enum(["sarvam", "groq"]).optional(), script: z.enum(["native", "roman"]).optional(), languageHint: z.string().max(8).optional() },
    async (a) => { const j: any = await op.startTranscribe(who, a.projectId, a.assetId, a); await deps.enqueueJob(String(j._id)); return op.jobJson(j); });
  tool("get_job", "Status, progress, result and error of a job.", "reel:read", { ...pid, jobId: id }, async (a) => op.jobJson(await op.getJob(who, a.projectId, a.jobId)));
  tool("get_transcript", "Timed words of the latest transcript of an asset.", "reel:read", { ...pid, assetId: id }, (a) => op.getTranscript(who, a.projectId, a.assetId));

  tool("create_plan", "Ask the ReelFlow planner (Gemini) for an editing plan. Proposes only; changes nothing.", "reel:write",
    { ...pid, instruction: z.string().min(3).max(4000), idempotencyKey: z.string().max(100).optional(), captionScript: z.enum(["native", "roman"]).optional(), targetSeconds: z.number().min(5).max(600).optional() },
    async (a) => planning.planJson(await planning.createPlan(who, a.projectId, a.instruction, { idempotencyKey: a.idempotencyKey, preferences: { captionScript: a.captionScript, targetSeconds: a.targetSeconds } })));
  tool("submit_plan", "Propose your own editing plan (registry operations only, optional storySelection by phrase id). Validated server-side exactly like a planner plan; changes nothing until approved and executed.", "reel:write",
    { ...pid, plan: planReplySchema, instruction: z.string().max(4000).optional(), idempotencyKey: z.string().max(100).optional() },
    async (a) => planning.planJson(await planning.submitPlan(who, a.projectId, a.plan, { instruction: a.instruction, idempotencyKey: a.idempotencyKey, agent: "claude" })));
  tool("validate_operations", "Dry-run operations against the latest timeline without saving anything.", "reel:read",
    { ...pid, operations: z.array(z.object({ op: z.string(), args: z.record(z.string(), z.unknown()).optional() })).min(1).max(40) }, (a) => planning.dryRunOps(who, a.projectId, a.operations));
  tool("list_plans", "List editing plans with status and history.", "reel:read", pid, async (a) => (await planning.listPlans(who, a.projectId)).map(planning.planJson));
  tool("get_plan", "One plan with per-operation validation, warnings and history.", "reel:read", { ...pid, planId: id }, async (a) => planning.planJson(await planning.getPlan(who, a.projectId, a.planId)));
  tool("approve_plan", "Approve a proposed plan (all valid operations, or the listed ids). Only do this with the creator's consent.", "reel:write", { ...pid, planId: id, opIds: z.array(z.string()).optional() },
    async (a) => planning.planJson(await planning.approvePlan(who, a.projectId, a.planId, a.opIds)));
  tool("reject_plan", "Reject a plan with a reason.", "reel:write", { ...pid, planId: id, reason: z.string().min(1).max(500) }, async (a) => planning.planJson(await planning.rejectPlan(who, a.projectId, a.planId, a.reason)));
  tool("execute_plan", "Execute an approved plan as ONE new timeline version. Safe to call twice.", "reel:write", { ...pid, planId: id }, async (a) => planning.planJson(await planning.executePlan(who, a.projectId, a.planId)));

  // One tool per registry operation, generated. baseVersion protects against concurrent edits.
  for (const o of EDIT_OPS) {
    const shape = (o.args as z.ZodObject<any>).shape ?? {};
    tool(`edit_${o.name}`, `${o.description}. Creates a new timeline version immediately; prefer plans for multi-step edits.`, "reel:write", { ...pid, baseVersion: z.number().int().optional(), ...shape },
      async (a: any) => { const { projectId, baseVersion, ...args } = a; return publicTimeline(await op.applyEdit(who, projectId, o.name, args, baseVersion)); });
  }

  tool("get_timeline", "A timeline version (latest by default), without storage paths.", "reel:read", { ...pid, version: z.number().int().optional() }, async (a) => publicTimeline(await op.getTimeline(who, a.projectId, a.version)));
  tool("list_timelines", "Version history of the timeline with renders and approval.", "reel:read", pid, (a) => op.listTimelines(who, a.projectId));
  tool("compare_versions", "Compare two timeline versions.", "reel:read", { ...pid, from: z.number().int(), to: z.number().int() }, (a) => op.compareVersions(who, a.projectId, a.from, a.to));
  tool("render_preview", "Render a timeline version with ffmpeg. Returns a job; poll get_job.", "reel:render", { ...pid, version: z.number().int().min(1), quality: z.enum(["preview", "final"]).optional() },
    async (a) => { const j: any = await op.startRender(who, a.projectId, a.version, a.quality ?? "preview"); await deps.enqueueJob(String(j._id)); return op.jobJson(j); });
  tool("approve_timeline", "Approve a rendered timeline version; it becomes immutable.", "reel:write", { ...pid, version: z.number().int().min(1) },
    async (a) => { const r: any = await op.approveTimeline(who, a.projectId, a.version); return { version: r.version, approved: r.approved }; });
  tool("generate_publishing_package", "Start the publishing package (titles, description, hashtags, thumbnails). Needs project approval by the owner.", "reel:write", pid,
    async (a) => { const k: any = await op.startPublishingPackage(who, a.projectId, deps.enqueueKit); return { status: k.status }; });
  tool("get_publishing_package", "The latest publishing package.", "reel:read", pid, (a) => op.getPublishingPackage(who, a.projectId));
  return server;
};
