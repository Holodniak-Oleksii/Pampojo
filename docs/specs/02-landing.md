# 02. Landing page

## Goal

Explain Pampojo to a first-time visitor in one scroll and get them to sign up.

## Scope

Public page at `/`, server-rendered. Sections (reference: `docs/wireframes/01-landing.png`):

1. Header: logo, links Features / How it works / FAQ (anchors), Log in, Get started. Mobile: logo, Log in, menu sheet.
2. Hero: headline "Your workouts. Even offline.", subtitle, Get started, Continue with Google, trust line "Free • Works on iPhone, Android and laptop", visual of the session screen with floating chips.
3. Features: 4 cards (build workouts, plan in a calendar, works offline, share with friends).
4. How it works: 3 steps.
5. Progress showcase: adherence gauge, progress chart, BMI card (static illustrative data).
6. Offline highlight.
7. FAQ: 4 accordion items (free? offline? iPhone? sharing?).
8. CTA banner.
9. Footer: logo, tagline, link columns (Product, Resources, Legal), language placeholder, copyright.

Visitors with a session are redirected to `/today`.

## Out of scope

Real legal pages (links go to placeholder pages), blog, analytics.

## UX notes

- Visuals are built from our own components with sample data or static images; no stock photos of people.
- Mobile: single column, features 2×2, steps stacked.
- Desktop: hero in two columns, features in a row of 4.
- Good Lighthouse scores: the page is static and light.

## Acceptance criteria

- [ ] AC1: Visitor without a session sees all sections in order on mobile and desktop.
- [ ] AC2: Logged-in user opening `/` lands on `/today`.
- [ ] AC3: Get started → `/signup`; Log in → `/login`; Continue with Google starts Google sign-in (after spec 03; before that, links to `/signup`).
- [ ] AC4: Header links scroll to their sections; the mobile menu opens and closes with keyboard and touch.
- [ ] AC5: FAQ items expand and collapse and are reachable by keyboard.
- [ ] AC6: Page has title, description and Open Graph tags; Lighthouse performance and accessibility ≥ 90 on mobile.
- [ ] AC7: No horizontal scroll at 360px width.

## Depends on

01.

## Open questions

- Final hero visual: illustration built in code, or an exported image?
