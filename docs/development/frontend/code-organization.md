---
title: Code organization
---

Where frontend code belongs and how a component folder looks.

## Choose the narrowest scope

| Kind of code | Location |
| --- | --- |
| Route files (`page.tsx`, `layout.tsx`, `loading.tsx`) | `src/app/` — thin, compose features |
| Domain UI and logic: uses server data, local db, stores, auth or business rules | `src/features/<domain>/` |
| Reusable presentation with no domain context | `src/components/` |
| shadcn primitives | `src/components/ui/` (generated) |
| API client functions and query hooks | `src/api/<domain>.ts` |
| Local database and repositories (spec 16) | `src/services/local-db/` |
| Sync engine, connectivity, storage wrappers | `src/services/` |
| UI state shared across components | `src/stores/` (Zustand) |
| Hooks reused across unrelated features | `src/hooks/` |
| Pure helpers reused across features | `src/lib/` |
| Constants used by independent areas | `src/constants/` |
| Types used by independent areas | `src/types/` |
| Zod schemas shared with the server | `src/shared/schemas/` |
| Test utilities and mock factories | `src/test/` |
| i18n setup, catalogs, locale resolution, formatters | `src/i18n/` |

Keep a feature's hooks, helpers, types and constants inside the feature. Move them to a shared directory only when an unrelated area needs them. Promoting early turns an implementation detail into a global API that is hard to change.

## Routes

```text
src/app/
├── [lang]/                       # hidden locale segment; src/proxy.ts rewrites /x → /<lang>/x
│   ├── layout.tsx                # root layout: <html lang>, font, i18n provider
│   ├── (marketing)/page.tsx      # landing
│   ├── (auth)/login/page.tsx
│   ├── (auth)/signup/page.tsx
│   ├── onboarding/page.tsx
│   ├── (app)/layout.tsx          # app shell: nav, top bar, auth guard
│   ├── (app)/today/page.tsx
│   ├── (app)/library/...
│   ├── (app)/calendar/page.tsx
│   ├── (app)/progress/page.tsx
│   ├── (app)/profile/...
│   ├── session/[id]/page.tsx     # full-screen, no nav
│   └── s/[token]/page.tsx        # shared workout
└── api/...                       # backend, outside [lang]; see backend guide
```

Users never see the `[lang]` segment: links and redirects use unprefixed paths (`/today`). Server code reads the locale with `lang()` from `next/root-params`.

Route files assemble features and handle routing concerns (params, redirects, metadata). Business behavior that could be reused outside one route belongs in a feature.

Server components are the default for static and marketing pages. Interactive app screens are client components because they depend on local data and stores; put `'use client'` at the feature entry, not on every file.

## Components versus features

A component does not become a feature because it is large. The question is whether it depends on application or domain context.

- **Component**: behavior expressed through props, renders without stores, queries or auth. Example: `SegmentedGauge`, `EmojiAvatar`, `SetRow` (pure).
- **Feature**: reads a query, the local db, a store, the session, or applies business rules. Example: `features/session/ActiveSession`, `features/calendar/PlanCalendar`.

## Component folder

```text
SetRow/
├── SetRow.tsx
├── index.ts
├── types.ts
├── utils.ts
└── __tests__/
    └── SetRow.test.tsx
```

Only `SetRow.tsx` and `index.ts` are required. Add the rest when needed. Keep props in `SetRow.tsx` when only it uses them. Move a type to `types.ts` when sibling files reuse it or `index.ts` exports it. `index.ts` exports only the public surface; private files stay unexported. File and folder names of components are PascalCase; hooks are `useThing.ts`; other files kebab-case.

## Feature folder

```text
features/workouts/
├── WorkoutBuilder/
├── WorkoutList/
├── hooks/
├── constants.ts
├── types.ts
└── utils.ts
```

Create only what the feature needs. Do not add empty folders to match the example.

## Exports

- Named exports everywhere except where Next.js requires a default (`page.tsx`, `layout.tsx`, route handlers follow their own rules).
- No barrel files at the `src/components` or `src/features` root; import from the folder's `index.ts`.
