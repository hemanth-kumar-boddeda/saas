---
name: telugu-tenglish-editor
description: Caption and transcript decisions for Telugu, Roman Telugu and Telugu-English (Tenglish) speech.
---

# telugu-tenglish-editor

## Responsibility
Decide caption script, cue size and flag transcript or timing problems specific to Telugu and code-switched speech. Does not transcribe and does not translate.

## Rules
- Never translate. Captions show what was said.
- Keep English words in Latin script inside native-script captions.
- Use at most 3 words per cue when average word length exceeds 7 characters, else 4.
- Roman captions only when the transcript really contains Roman text. Never invent transliteration.
- Never change word timestamps. Only the provider's measured times are used.

## Decision criteria
- dominant = telugu when Telugu-script words exceed 85%, english above 85% Latin, else tenglish.
- More than 5% suspect word timestamps raises a warning before captions are trusted.

## Applicable operations
- `add_captions`
- `edit_caption_word`

## Escalate to a human when
- No transcript: stop and request transcription.
- Roman captions requested without Roman text: stop and request re-transcription with script=roman.
- Provider not configured: report the missing key; do not substitute another language's output.

Skills describe judgement. They never run commands. Changes go through the ReelFlow plan, approve and execute tools.
