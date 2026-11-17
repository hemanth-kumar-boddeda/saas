import { Skill } from "./types";
import { teluguTenglishEditor } from "./teluguTenglish";
import { talkingHeadStoryEditor } from "./talkingHead";
import { videoQualityController } from "./qualityController";

export const SKILLS: Skill<any, any>[] = [teluguTenglishEditor, talkingHeadStoryEditor, videoQualityController];
export const skillByName = (n: string) => SKILLS.find((s) => s.name === n);

/** Claude-compatible SKILL.md generated from the skill definition, so there is one source of truth. */
export const renderSkillMd = (s: Skill<any, any>) => `---
name: ${s.name}
description: ${s.description}
---

# ${s.name}

## Responsibility
${s.responsibility}

## Rules
${s.rules.map((r) => `- ${r}`).join("\n")}

## Decision criteria
${s.decisionCriteria.map((r) => `- ${r}`).join("\n")}

## Applicable operations
${s.operations.map((o) => `- \`${o}\``).join("\n")}

## Escalate to a human when
${s.escalation.map((r) => `- ${r}`).join("\n")}

Skills describe judgement. They never run commands. Changes go through the ReelFlow plan, approve and execute tools.
`;
