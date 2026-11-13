# Design system

Warm and restrained, sharp-cornered, with the diamond as the brand sign. The direction, tokens, motion and copy rules are in [`VISUAL_LANGUAGE.md`](VISUAL_LANGUAGE.md), agreed on 2026-11-13. This page lists how they map to code and the shared components.

Built on shadcn/ui with a custom Tailwind theme. Components come from shadcn first; custom components only when shadcn has no fit. `docs/wireframes/01-landing.png` is kept as history; it shows the spec 01 look, not the current one.

## Tokens

- Define every value from `VISUAL_LANGUAGE.md` "Tokens" as a CSS variable in `src/app/globals.css`, and map it in the Tailwind theme (shadcn convention: `--background`, `--foreground`, `--primary`, …).
- `--primary` is `--foreground`, and `--primary-foreground` is `--card`.
- Muscle family colours are `--muscle-chest`, `--muscle-shoulders`, `--muscle-back`, `--muscle-arms`, `--muscle-legs`, `--muscle-core`.
- `--radius` is 6px, and the smaller radii come from the shape table.
- Text on `--accent` uses `--foreground`. All text passes WCAG AA, which closes the spec 01 exception for secondary text.
- Avatar backgrounds `--avatar-1` … `--avatar-8`: `#FBD9C3` peach, `#F9C9A0` apricot, `#F6E3A1` butter, `#CFE3C8` sage, `#C5E6DE` mint, `#C9DDF0` sky, `#DCD3EE` lavender, `#F3C9CF` rose. The 24 avatar emoji are listed in spec 01. On Today the avatar is not shown.
- The app is light. Only the active session screen (spec 10) follows the system dark theme, with the dark session tokens.

## Typography

Manrope through `next/font`, subsets `latin` and `cyrillic`, weights 400, 600, 700, 800. The scale is in `VISUAL_LANGUAGE.md`. Body text is at least 14px; session inputs are 28px with tabular figures.

## Shape and depth

- Cards 6px, controls 4px, thumbnails 3px, sheets 8px on top. No pills.
- Depth comes from tone and 1px dividers. Shadows are only for floating layers.
- Spacing: 16px mobile gutter, 16px card padding, 20–24px between sections.

## Components (app-level)

- `BottomNav`: a hexagonal charcoal panel with five slots and a central accent Play diamond cut into the panel.
- `SidebarNav`: desktop. Start at the top, and the active row marked with an accent diamond.
- `StatusPill`: online (light) or offline (dark, with a pending count); it opens the sync sheet.
- `WeekStrip`: 7 days with diamond markers.
- `SetRow`, `RestTimer`, `ExerciseRow` (thumbnail, title, secondary line, value, chevron), `MuscleChips` (a family diamond before the label).
- `GhostList`: the empty-state placeholder that mirrors the real list.
- `EmojiAvatar`: an emoji on a 4px-radius square from the avatar palette.
- Custom icons (workout, set done, record, rest, my gym): see `VISUAL_LANGUAGE.md`.
- `SegmentedGauge` and `StatCard` from spec 01 are replaced by diamond rows and plain numbers. Spec 13 decides what remains.

## Status markers (calendar and week strip)

| Status | Marker |
| --- | --- |
| Done on time | Filled `--accent` diamond |
| Done late | `--accent` outline diamond |
| Today | `--foreground` outline diamond, the day label in bold |
| Planned | `--planned` outline diamond |
| Missed | `--destructive` outline diamond plus a label in the day details |

## Brand

`docs/brand/pampojo-icon.svg` (app icon: orange P with dumbbell cut-out on charcoal) and `docs/brand/pampojo-wordmark.svg` (the app icon as the "P", followed by "ampojo" in charcoal; the icon's P sits on the x-height and the baseline, the square ends at the descenders). Spec 01 copies them into `public/brand/` and generates favicons and PWA icons. Spec 28 moves the logo to `--accent` `#EC8447` and `--foreground` `#24221F`.

## Accessibility

- Touch targets at least 44px, 48px in session mode.
- Every icon button has an accessible name.
- Colour is never the only signal: statuses differ in shape (fill or outline) and have a label.
- Respect `prefers-reduced-motion`.
