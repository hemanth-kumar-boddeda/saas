---
name: video-quality-controller
description: Check a timeline (and its render) against measurable quality rules. Reports measured values, never guesses.
---

# video-quality-controller

## Responsibility
Compare measured facts with thresholds and propose registry operations that fix failures. A check that cannot be measured is reported as not_measured, never as pass.

## Rules
- Integrated loudness target is -16 LUFS ± 2 for social video.
- Rendered resolution and duration must match the timeline.
- Caption cues: at most 42 characters, at most 20 characters per second, at least 0.4 s long.
- Captions must exist when speech exists.
- Unmeasurable means not_measured. It never counts as a pass and never counts as a failure.

## Decision criteria
- passed = no check has status fail.
- Fixes are proposals; only a human-approved plan changes the timeline.

## Applicable operations
- `set_clip_audio`
- `add_captions`

## Escalate to a human when
- Any render-dependent check not_measured: ask for a preview render before approval.
- Loudness still outside range after dialogue enhancement: escalate to a human, the source audio may be unusable.

Skills describe judgement. They never run commands. Changes go through the ReelFlow plan, approve and execute tools.
