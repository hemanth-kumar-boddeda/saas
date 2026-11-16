// Approval -> kit hand-off. Starts the AI publish kit for the approved version when possible.
import { ProjectVersion } from "../models/review.model";
import { PublishKit } from "../models/publishkit.model";
import { enqueueKit } from "./publishKit";
import { logger } from "../utils/logger";

/** Returns true when a kit was queued. Never throws: approval must not fail because of AI. */
export const autoStartKit = async (projectId: string, versionNumber: number): Promise<boolean> => {
  try {
    const v: any = await ProjectVersion.findOne({ project: projectId, number: versionNumber });
    if (!v || v.kind !== "upload" || v.processing !== "ready") return false; // pasted links have no file to analyse
    const kits: any[] = await PublishKit.find({ project: projectId });
    if (kits.some((k) => k.version && String(k.version) === String(v._id) && k.status !== "failed")) return false;
    const kit: any = await PublishKit.create({ project: projectId, version: v._id });
    await enqueueKit(String(kit._id));
    return true;
  } catch (e: any) {
    logger.error("auto_kit_failed", { projectId, errorMessage: e?.message });
    return false;
  }
};
