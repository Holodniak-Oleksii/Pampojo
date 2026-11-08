# 01. Design system and app foundations

## Goal

The warm Pampojo look as tokens and a few base components, plus the i18n plumbing, so every screen after this is built from the same parts.

## Scope

- Tokens from `docs/tech/DESIGN_SYSTEM.md` as CSS variables and in the Tailwind theme; shadcn components pick them up.
- Plus Jakarta Sans via `next/font`.
- shadcn components added as needed by early specs: button, input, label, card, tabs, dialog, sheet, dropdown-menu, toast (sonner), progress, skeleton, form.
- Button variants: `primary` (charcoal), `accent` (peach), `secondary` (white pill), `ghost`; sizes including `xl` for session mode.
- App components: `EmojiAvatar`, `StatCard`, `SegmentedGauge`, `StatusPill` (visual only), `PageHeader`.
- Brand: copy `docs/brand/*.svg` to `public/brand/`; generate favicon set and apple-touch icon from `pampojo-icon.svg`.
- i18n: `i18next` + `react-i18next` set up, `en` locale, `i18next-parser` script `pnpm i18n:extract`, the static-key rule enforced by an ESLint rule if available.
- A dev-only `/dev/ui` page that shows the tokens and components, excluded from production builds.

## Out of scope

Dark theme. Navigation (spec 05).

## Acceptance criteria

- [ ] AC1: `/dev/ui` shows colors, type scale, buttons in all variants and sizes, cards, the gauge at 0/50/82/100%, avatars, status pill in online / offline / pending states.
- [ ] AC2: No hex colors in components; all come from tokens (lint rule or review).
- [ ] AC3: Favicon and apple-touch icon show the Pampojo icon.
- [ ] AC4: A string rendered through `t()` appears in the extracted `en` catalog after `pnpm i18n:extract`.
- [ ] AC5: Text on accent backgrounds meets WCAG AA contrast.
- [ ] AC6: Component tests cover `SegmentedGauge` value rendering (accessible label "82%") and `EmojiAvatar` accessible name.

## Depends on

00.

## Open questions

- UI language: English only first, or Ukrainian from day one?
- Avatar palette: how many emoji and background colors?
