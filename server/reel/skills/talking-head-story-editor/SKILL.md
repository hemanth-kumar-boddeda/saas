---
name: talking-head-story-editor
description: Pick the strongest story and hook from one-camera talking-head footage and cut the rest.
---

# talking-head-story-editor

## Responsibility
Measure pauses and filler, offer transcript phrases as candidates, validate the model's phrase selection and convert it into remove_range steps. The model chooses phrases; this skill never invents timestamps.

## Rules
- Open on the hook: the line that states the payoff or poses the question. If it is not first, it is moved to the start (non-destructive move_segment); cut warm-up greetings unless the creator asks to keep them.
- Keep complete phrases. Never cut mid-phrase.
- Keep one idea per reel. Prefer a continuous argument over scattered highlights.
- Remove filler-only phrases and silences of 0.8 s or more; leave 0.15 s of breath on each side.
- Select by phrase id only. Timestamps always come from measured transcript words.
- Do not exceed the target length by more than 10%.

## Decision criteria
- Hook candidate: a phrase that works without earlier context (no 'this', 'that one', 'as I said').
- Story: kept phrases should answer the hook within the target length.
- If the source is shorter than the target, keep everything and only remove silences and filler.

## Applicable operations
- `remove_range`
- `remove_silences`
- `split_clip`
- `trim_clip`

## Escalate to a human when
- No transcript: stop and request transcription.
- Selected phrases would leave under 5 s: reject and ask the creator for a longer target or different source.
- Hook moved to the start: tell the creator, because the story may no longer make sense after the opening line. Set moveHook=false to keep source order.

Skills describe judgement. They never run commands. Changes go through the ReelFlow plan, approve and execute tools.
