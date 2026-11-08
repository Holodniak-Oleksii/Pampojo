# 24. AI exercise from voice

## Goal

A user describes an exercise by voice and gets a complete exercise card: description, technique steps, common mistakes, tags, and later illustrative visuals.

## Scope

Phase A — text card:

- Microphone button in "Create exercise" (online only): record with `MediaRecorder`, show duration and a stop button, max 60 seconds.
- Server: speech-to-text → `generateStructured` exercise card (name, description, instructions, common mistakes, safety notes, tags from allowed lists).
- The card opens in the custom exercise form as a draft; the user reviews and saves.
- Transcript is shown and editable; "Regenerate from text" uses the edited transcript.

Phase B — visuals (only if the lead approves after phase A):

- Generate 2–3 key frames (start, middle, end positions) in the brand illustration style; shown as a simple crossfade animation.
- Visuals are labelled "Illustration, check technique with a coach" and require explicit approval before saving to Storage.
- Regenerate per frame.

## Out of scope

Video generation, voice for other features.

## Acceptance criteria

- [ ] AC1: Recording works on Android Chrome, iPhone Safari (installed PWA) and desktop Chrome; permission denial shows guidance.
- [ ] AC2: A 20-second description produces a card that passes schema validation with tags from allowed lists.
- [ ] AC3: Nothing is stored (audio, card, images) until the user saves; audio is not kept after transcription.
- [ ] AC4: Phase B frames are only saved after approval and carry the illustration label.
- [ ] AC5: Errors at any step keep the transcript so the user can retry.

## Depends on

07, 20, 23.

## Open questions

- Speech-to-text provider; image generation provider; whether phase B ships at all given anatomy accuracy risk.
