# 19. Share and import workouts

## Goal

A user sends a workout to someone by link or file, and the recipient adds a copy to their own library.

## Scope

- `share_link` table. Token: 32 random bytes, base64url; store only its SHA-256 hash.
- Share dialog on a workout: create link with expiry (24 h, 7 days, never), copy, native share sheet (`navigator.share`) when available, list of active links with revoke; "Export as file" (JSON `WorkoutExportV1`).
- `/s/[token]`: public preview (name, exercises with targets, owner display name and avatar), "Add to my library". Visitors without an account sign up or log in and return to the preview.
- Import from link: `POST /api/v1/share/{token}/import` with `Idempotency-Key`; copies workout and the owner's custom exercises it uses (system exercises are referenced); sets `sourceWorkoutId`, `sourceOwnerName`; increments `importCount`.
- Import from file: Library → Import → pick `.json` → validation → preview → add. Unknown system slugs are reported, not silently dropped.
- Imported workouts show "From <name>" in the library.
- Expired or revoked links show a friendly page (410).
- Rate limit link creation.

## Out of scope

Sharing plans or history, live-synced shared workouts, trainer assignment (26).

## Acceptance criteria

- [ ] AC1: Owner creates a link; recipient opens it, logs in, adds it; the copy appears in their library with "From <owner>".
- [ ] AC2: The recipient's edits never change the owner's workout and vice versa.
- [ ] AC3: Custom exercises used by the workout are copied once even if imported twice; a double tap on "Add" creates one copy.
- [ ] AC4: Revoked or expired links return 410 and the friendly page; the database never stores the raw token.
- [ ] AC5: Export → import in another account recreates the same workout; a file with an unknown `schemaVersion` or invalid shape is rejected with a clear error.
- [ ] AC6: The preview page reveals no data beyond the workout, owner display name and avatar.
- [ ] AC7: Sharing and import by link are disabled offline (spec 17).

## Depends on

09, 17.
