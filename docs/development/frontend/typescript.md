---
title: TypeScript
---

Applies to the whole `src/` tree, client and server. `strict: true`, `noUncheckedIndexedAccess: true`.

## Type placement

Three levels, narrowest first:

- **Inline** in the file — the default. Props interfaces that only that component uses.
- **Feature-level** `types.ts` — reused across files in the feature, or exported through its `index.ts`.
- **Global** `src/types/<domain>.ts` — used by independent parts of the app. One file per domain, imported by path, no barrel.

Promote a type only when a real second consumer appears. A global type is a promise that anything may depend on it.

Types that describe API contracts are inferred from Zod: `type Workout = z.infer<typeof workoutSchema>`. Do not hand-write a parallel interface.

## Naming

- No prefixes: `Workout`, not `IWorkout` or `TWorkout`.
- Domain objects use the domain name: `Exercise`, `Session`, `SetLog`.
- API inputs and outputs name the operation: `CreateWorkoutInput`, `SyncPushResponse`.
- Derived view types name their purpose: `CalendarDay`, `ExerciseProgressPoint`.
- Props: `{ComponentName}Props`.

## interface versus type

`interface` for object shapes and props. `type` for unions, aliases, `z.infer`, and derivations with `Pick`/`Omit`.

## Constants instead of enums

Do not create `enum`. Use `as const` and derive the union:

```ts
// src/constants/exercise.ts
export const TRACKING_TYPE = {
  WEIGHT_REPS: 'weight_reps',
  REPS: 'reps',
  TIME: 'time',
  DISTANCE: 'distance',
} as const;

export type TrackingType = ValueOf<typeof TRACKING_TYPE>;
```

`ValueOf<T>` is declared once in `src/types/utils.ts`. Zod schemas use the same values: `z.enum(Object.values(TRACKING_TYPE) as [TrackingType, ...TrackingType[]])` through a small helper in `src/shared/schemas/utils.ts`.

## Composition

Use `Pick`, `Omit`, `Partial` and intersections only between types that are related in the domain. Do not derive a type from an unrelated one because field names overlap; the two will drift and fight each other.

Do not extend a domain entity with a request payload, or the reverse. Payloads carry defaults and validation the entity does not. Extract shared fields into a neutral type when they are truly shared.

## Assertions

Avoid `as`. Prefer generics, narrowing and type guards. Acceptable: `as const`, untyped boundaries (`JSON.parse`, DOM APIs, library gaps) right before Zod parsing, and cases where the runtime type is certain and cannot be expressed structurally. `as unknown as X` means the types are wrong; fix them.

Data from the network, IndexedDB, files or the LLM is `unknown` until a Zod schema parses it.

## Imports

Prefer the inline type qualifier when mixing values and types: `import { TRACKING_TYPE, type TrackingType } from '@/constants/exercise'`. Use `import type` when the import is only types.
