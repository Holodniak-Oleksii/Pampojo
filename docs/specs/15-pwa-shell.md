# 15. PWA shell and install

## Goal

Pampojo installs to the home screen on Android and iPhone and its app shell opens with no network.

## Scope

- Web app manifest: name, short name, `display: standalone`, theme and background colors from tokens, start URL `/today`, icons 192/512 and maskable versions from `pampojo-icon.svg`, apple-touch icon, iOS splash approach.
- Service worker with the current recommended Next.js integration (evaluate Serwist; record the choice in an ADR): precache the app shell and static assets; offline fallback page for routes not cached; update flow ("New version available — Reload").
- Install prompts:
  - Android/Chrome: capture `beforeinstallprompt`, show an "Install app" card on Today and in Profile;
  - iOS Safari: detect non-standalone Safari and show a short illustrated guide (Share → Add to Home Screen).
- `navigator.storage.persist()` requested after install or first session.

## Out of scope

Offline data (16), push notifications.

## Acceptance criteria

- [ ] AC1: Lighthouse PWA checks pass (installable, manifest valid, service worker controls the page).
- [ ] AC2: After one online visit, opening the installed app offline shows the app shell and the offline fallback where data is missing, never the browser's offline page.
- [ ] AC3: Deploying a new version shows the update prompt; Reload activates it.
- [ ] AC4: On iPhone Safari (not installed), the install guide appears once per week at most and can be dismissed.
- [ ] AC5: Installed app launches in standalone mode with the correct icon and theme color on Android and iPhone (manual check, screenshots in the review).

## Depends on

05.
