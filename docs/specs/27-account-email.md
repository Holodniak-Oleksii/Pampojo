# 27. Account email: password reset, verification, Google linking (outline)

Outline only. Expand through `/drill` when the milestone starts. Split out of spec 03.

## Goal

Users who forget their password can get back into their account, email addresses are proven to belong to their owners, and a password account can safely be linked with Google sign-in.

## Scope (draft)

- Email provider and sending domain (Resend with an own domain is the current favourite; decide in drill). Transactional emails in `en` and `uk`, chosen by the `lang` cookie at request time.
- Forgot password: `/forgot-password` sends a reset link. The response is the same whether or not the email exists. The link is single-use and expires (duration decided in drill). `/reset-password` sets a new password and signs out other sessions.
- Email verification after email sign-up (soft or required: decide in drill; spec 03 recommended soft). Resend-link action. A banner for unverified accounts.
- Google account linking once the password account's email is verified. Until then the spec 03 behavior stays: no linking, with the "registered with a password" error.
- Rate limits for reset and verification emails.
- Copy for pages and emails, both languages.

## Out of scope

Magic links, 2FA, account deletion.

## Depends on

03. Delivered before 19 (sharing). Needs a domain owned by the lead.

## Open questions

- Domain and sender address.
- Verification: soft (send, do not block) or required before using the app?
- Reset link lifetime.
