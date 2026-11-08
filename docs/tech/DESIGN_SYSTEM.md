# Design system

Warm, soft and friendly. Reference: `docs/wireframes/01-landing.png`. Built on shadcn/ui with a custom Tailwind theme. Components come from shadcn first; custom components only when shadcn has no fit.

## Tokens

Define as CSS variables in `src/app/globals.css` and map them in the Tailwind theme (shadcn convention: `--background`, `--foreground`, `--primary`, …).

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#F2ECE4` | Page background (cream) |
| `--card` | `#FBF8F4` | Cards, sheets, inputs |
| `--foreground` | `#262626` | Text, headings |
| `--muted-foreground` | `#7A736C` | Secondary text |
| `--primary` | `#262626` | Main CTA buttons, bottom bar |
| `--primary-foreground` | `#FBF8F4` | |
| `--accent` | `#F59A62` | Highlights, progress, central Start button, active nav |
| `--accent-soft` | `#FBD9C3` | Secondary fills, chips, done-late status |
| `--success` | `#5BAA6A` | Synced, online |
| `--destructive` | `#E5534B` | Missed, errors, delete |
| `--border` | `#E6DED4` | Hairlines where needed; prefer shadows |
| `--radius` | `24px` | Cards; buttons and inputs are pills |

Exact values can be tuned for contrast; text on `--accent` must pass WCAG AA (use charcoal text on peach).

Dark theme is out of scope for the MVP; keep colors in tokens so it can be added.

## Typography

Plus Jakarta Sans through `next/font`. Weights 400, 600, 800. Headlines bold and large, body 16px minimum on mobile, numbers in session mode 28px+ with tabular figures.

## Shape and depth

- Radius 24–32px on cards, pill buttons and chips, rounded-square icon buttons.
- Soft diffuse shadows instead of borders.
- Generous spacing: 16px mobile gutter, 24px between sections.

## Components (app-level)

- `BottomNav` — charcoal bar, five slots, central accent rounded-square Start button.
- `SidebarNav` — desktop, cream background, Start at the top.
- `StatusPill` — online/offline + pending count.
- `SegmentedGauge` — arc of rounded blocks for adherence.
- `StatCard`, `WeekStrip`, `SetRow`, `RestTimer`, `ExerciseCard`, `MuscleChips`.
- `EmojiAvatar` — emoji on a colored circle from the avatar palette.

## Status colors (calendar and week strip)

| Status | Style |
| --- | --- |
| Done on time | Filled `--accent` |
| Done late | Filled `--accent-soft` |
| Missed | `--destructive` dot or outline |
| Planned | Outline only |

## Brand

`docs/brand/pampojo-icon.svg` (app icon: orange P with dumbbell cut-out on charcoal) and `docs/brand/pampojo-wordmark.svg`. Spec 01 copies them into `public/brand/` and generates favicons and PWA icons.

## Accessibility

- Touch targets at least 44px, 48px in session mode.
- Every icon button has an accessible name.
- Color is never the only signal: statuses also have a label or icon.
- Respect `prefers-reduced-motion`.
