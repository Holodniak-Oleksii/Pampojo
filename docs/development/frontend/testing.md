---
title: Frontend testing
---

## Runners

| What | Runner | Where |
| --- | --- | --- |
| Components, features, hooks | Vitest browser mode (Chromium via Playwright) | `__tests__/` next to the source |
| Pure helpers, schemas | Vitest (node) | `__tests__/` next to the source |
| User flows across pages, offline | Playwright | `e2e/` |

Browser mode runs against a real DOM, which matters for IndexedDB, layout and focus. Always import `describe`, `it`, `expect`, `vi` from `vitest` (`globals: false`).

## Principles

**Test the public interface.** One test file per entry point, the thing `index.ts` exports. Internal parts are tested through it. Route-level page components may test their own child parts.

**Mock only external I/O.** Mock the API module (`vi.mock('@/api/workouts')`), `fetch`, timers, and browser APIs. Do not mock our own components, hooks or helpers; render them for real. A test that mocks our own code keeps passing after the real contract changes.

**Explicit assertions, no snapshots.** An assertion says what the code should do; a snapshot records whatever it did.

**Assert user-visible behavior.** Simulate real actions. Query by role, then label or text, and use `data-testid` only as a last resort. Do not assert on CSS class names; if a state has no accessible signal, give it one (`aria-pressed`, `aria-current`) or skip the assertion.

**English test data with neutral placeholders.** `John Smith`, `test@example.com`. No real people.

## Coverage order

When time is short, cover in this order:

1. Critical user paths: rendering with data, the main action, submit.
2. Errors: API failure, validation errors, missing data.
3. Edge cases: empty lists, extreme values, missing optional props.
4. Conditional rendering: disabled, hidden, offline-blocked states.

## Utilities

- `src/test/render.tsx` — `render` with a fresh `QueryClient` (retries off), i18n and providers; `createQueryWrapper` for `renderHook`.
- `src/test/mocks.ts` — factories for backend shapes (`getWorkoutMock`, `getExerciseMock`) taking a `DeepPartial` override; arrays in overrides replace, not merge. Factories are for API and domain data only, never for props.

```tsx
const screen = await render(<WorkoutList />);
await expect.element(screen.getByRole('heading', { name: 'Push Day' })).toBeVisible();
await screen.getByRole('button', { name: 'Create workout' }).click();
```

Always `await` locator actions. Never use `querySelector`; locators retry until actionable, raw DOM reads make tests flaky.

## Mocking patterns

```ts
vi.mock('@/api/workouts', () => ({ fetchWorkouts: vi.fn(), updateWorkout: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchWorkouts).mockResolvedValue([getWorkoutMock()]);
});

// loading: a promise that never resolves
vi.mocked(fetchWorkouts).mockImplementation(() => new Promise(() => {}));
// error
vi.mocked(fetchWorkouts).mockRejectedValue(new ApiError('SERVER_ERROR'));
```

Dates in mocks are ISO strings with `Z` so tests are time-zone independent. Use fake timers for the rest timer.

## Playwright e2e

- Viewports: `mobile` 390×844 and `desktop` 1440×900 projects.
- Each spec gets one e2e file covering its acceptance criteria's main path: `e2e/<spec-number>-<name>.spec.ts`.
- Seed users and data through a test-only API or direct DB helpers, never through UI clicks in `beforeEach`.
- Offline: `await context.setOffline(true)`.

If every test in a browser-mode file times out on its first locator, the component probably threw or rendered another branch. Render it in a throwaway test and print the output before blaming the queries.
