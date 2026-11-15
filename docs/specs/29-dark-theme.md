# 29. Dark theme

## Goal

The whole product, the landing included, works in a dark theme as well as the light one. By default it follows the system theme. A setting can force "Світла" or "Темна", and it is kept on the device. Gyms are often dark, and spec 10 already made the session screen follow the system theme; this spec extends that to every screen with one switch.

## User stories

- As a lifter whose phone is in dark mode, I want the whole app to be dark, so that it does not blind me in a dim gym.
- As a user, I want to force light or dark in the Profile, so that the app does not depend on my phone setting.
- As a visitor, I want the landing page to match my system and to switch it, so that the site looks right before I sign up.

## Scope

### Setting

- Three values: `system` (default), `light`, `dark`.
- It is stored on the device in `localStorage` under `pampojo:theme` (DECISIONS 2026-11-15 "App-wide theme switch"). There is no server column.
- Logging out keeps it, like the language.
- A change applies at once, without a reload, and also in other open tabs (the `storage` event).
- `system` follows `prefers-color-scheme` live, so the app switches when the phone does.

### Where it is set

- **Profile:** a "Тема" row in the settings block next to "Мова", with the three options "Як у системі", "Світла", "Темна".
- **Landing footer:** a compact switch next to the language switcher, with the same three options and the same stored value.
- Login, sign-up and onboarding have no switch; they use the stored value or the system.

### Which screens

Everything: the landing, auth, onboarding, the app shell and every app screen, the session, sheets, dialogs, menus and toasts. Exception: the OG image stays as it is (it has no viewer theme).

### Palette

- The dark theme extends the dark session tokens from spec 10 (`VISUAL_LANGUAGE.md` "Dark session") to every token. `/design 29` adds the ones that do not exist yet: statuses, muscle families, avatar backgrounds, the bottom nav, the sidebar, the status pill, the offline band, chart colours and the brand wordmark.
- The accent stays `#EC8447`. Text on the accent stays dark.
- All text passes WCAG AA in both themes.

### Session

- The session screen follows the app theme like every other screen. The separate session-only rule (`.session-theme` under `prefers-color-scheme`) is replaced by the app-wide theme, with one dark palette.
- The session bar (spec 10) gets a look for each theme in `/design 29`, so it stands out from the page in both.

### Technical behaviour

- **No flash of the wrong theme:** a small inline script in `<head>` reads the stored value and `prefers-color-scheme` and sets the theme on `<html>` before the first paint. The server-rendered markup does not depend on the theme.
- The browser UI colour (`<meta name="theme-color">`) and `color-scheme` match the active theme.

## Out of scope

- Storing the theme in the profile or syncing it across devices (decided against: device only).
- A per-screen theme (the session no longer has its own rule).
- A high-contrast theme.
- A dark OG image.

## UX

- **Profile row:** "Тема" with a full-width three-option segmented control under the label (see Design).
- **Landing footer:** an icon-only three-option control next to the language switcher.
- **States:** none beyond the selected option. Storage unavailable (private mode) falls back to `system` and the switch still works for the visit.

## Design

Canvas: <https://claude.ai/artifact/7doeoVV5yXb83acZcKGPLj> (private). Each board has a `theme` tweak that switches between dark and light, from one shared token sheet.

| Board | Screen and state |
| --- | --- |
| Сьогодні, моб, темна | Today with workouts and the gym nudge: the reference for cards, lists, steps, buttons, the top bar, the status pill and the bottom nav |
| Профіль з темою, моб, темна | Profile with the new "Тема" row |

The lead approved the direction on these two boards. Every other screen (library, catalog, editor, picker, filter sheet, exercise details and form, My gym, Calendar and Progress placeholders, auth, onboarding, landing, offline, sheets, dialogs, toasts, the session screens of spec 10, desktop) is not drawn: it takes the same tokens through the table below. `/review 29` compares each screen in dark against these rules.

### Tokens

Every colour comes from a token. Components keep their light-theme structure and only read the dark values.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `#ECE9E4` | `#1E1C1A` | Page, the cut-out ring around Play |
| `--card` | `#F8F7F4` | `#2A2724` | Cards, sheets, dialogs, menus, the online pill, toasts |
| `--input-surface` | `#F8F7F4` | `#353130` | Inputs, text areas, the session set fields, the current list row |
| `--foreground` | `#24221F` | `#F3F1EC` | Text, the focus ring |
| `--muted-foreground` | `#5C5751` | `#B3ACA3` | Secondary text |
| `--border` | `#E0DBD4` | `#3A3633` | Row dividers |
| `--border-strong` | `#D9D3CB` | `#4A4541` | Section dividers, the selected segment outline, sheet handles |
| `--planned` | `#AEA79F` | `#8C857D` | Planned outlines, drag handles |
| `--disabled-outline` | `#AEA79F` | `#5A544F` | Disabled set checks |
| `--placeholder` | `#5C5751` | `#6E6862` | Input placeholders |
| `--accent` | `#EC8447` | `#EC8447` | Unchanged |
| `--accent-foreground` | `#24221F` | `#1E1C1A` | Text and icons on the accent |
| `--primary` / `--primary-foreground` | `#24221F` / `#F8F7F4` | `#4A4541` / `#F3F1EC` | Primary buttons: raised dark in the dark theme |
| `--success` | `#5BAA6A` | `#6FBF7D` | The online dot |
| `--destructive` / `--destructive-foreground` | `#E5534B` / `#24221F` | `#E5534B` / `#1E1C1A` | Destructive buttons, missed outlines |
| `--destructive-text` | `#C2413A` | `#F28A84` | Destructive text and menu items |
| `--nav` | `#24221F` | `#2A2724` | The bottom nav panel; icons `--foreground` of the dark set (`#F8F7F4` / `#F3F1EC`), active icon the accent |
| `--logo-square` | `#24221F` | `#2A2724` | The app icon square in the top bar and the wordmark; "ampojo" uses `--foreground` |
| `--session-surface` | `#1E1C1A` | `#353130` | Session bar: always set apart from the page, with a 1px `#4A4541` border in dark |
| `--pill-offline` / text | `#24221F` / `#F8F7F4` | `#F3F1EC` / `#1E1C1A` | Offline pill: always the inverse of the page |
| `--band-surface` | `#33302C` | `#2A2724` | Landing offline band; in dark it gets 1px `--border-strong` lines top and bottom |
| scrim | `rgba(36,34,31,.45)` | `rgba(0,0,0,.6)` | Behind sheets and dialogs |
| shadow | `0 12px 32px rgba(36,34,31,.12)` | `0 12px 32px rgba(0,0,0,.45)` | Floating layers |

Muscle family colours, avatar backgrounds, exercise photos and the accent stay the same in both themes. Chart colours read the tokens above (`chart-1` foreground, `chart-2` accent, `chart-3` muted, `chart-4` planned, `chart-5` success).

### Components

- **Bottom nav:** the panel uses `--nav`. The Play diamond keeps its 5px ring in `--background`, so it still looks cut out.
- **Sidebar (desktop):** `--background`, active row `--card`, as in light.
- **Status pill:** online is `--card` with the `--success` dot; offline is the inverse pill.
- **Session:** the spec 10 dark session tokens become the app dark tokens, and the `.session-theme` rule goes. The session bar uses `--session-surface`.
- **Toasts:** `--card` with `--foreground` text and the floating shadow.
- **Exercise image placeholder:** `--background` tile with `--foreground` at 70%, as in light.

### Theme row (Profile)

- A card with the legend "Тема" in `--muted-foreground`, and under it a full-width three-option segmented control.
- Options: monitor icon + "Як у системі", sun + "Світла", moon + "Темна" (16px lucide icons, 14/600).
- The control sits on `--background` with 4px padding and 4px gaps. The selected segment is `--card` with a 1px `--border-strong` outline and 700 weight.
- It is a radio group: arrow keys move, the choice applies at once, and there is no save button.
- The row sits after "Мова" (keep the existing `LanguageSwitcher`). On desktop it spans the two-column grid.

### Landing footer switch

- An icon-only three-option control (monitor, sun, moon, 40px each) next to the language switcher.
- Accessible names: "Як у системі", "Світла", "Темна". The same selected style as the Profile row.

## Data and API

No server changes. The setting lives on the device.

## Copy

| Key (en) | uk |
| --- | --- |
| Theme | Тема |
| System | Як у системі |
| Light | Світла |
| Dark | Темна |

Copy confirmed in `/design 29`.

## Acceptance criteria

- [ ] AC1: With no stored choice, a system in dark mode gets the dark theme on the landing, auth, onboarding and every app screen, and a system in light mode gets the light theme. Changing the system theme while the app is open switches it without a reload.
- [ ] AC2: The Profile "Тема" row offers "Як у системі", "Світла" and "Темна". Picking one applies it at once, overrides the system, survives a reload and a log out, and shows the same value in the landing footer.
- [ ] AC3: The landing footer switch sets the same stored value, with the same effect.
- [ ] AC4: The first paint of any page uses the stored theme. There is no light flash before a dark page (checked in e2e by reading the `<html>` theme before hydration).
- [ ] AC5: The session screen, its sheets and its dialogs follow the app theme. With "Світла" forced, the session is light even when the system is dark.
- [ ] AC6: Every token pair used for text passes WCAG AA in both themes (a unit test computes the contrast of the token table).
- [ ] AC7: A change in one tab applies in the other open tabs.
- [ ] AC8: `<meta name="theme-color">` and `color-scheme` match the active theme.
- [ ] AC9: Every screen works at 390px and 1440px in both themes, with no horizontal scroll in en and uk. Review screenshots of each screen in dark are compared with the Design token table.

## Depends on

10, 28.

## Open questions
