// Drizzle has no auto-update for timestamps; every update spreads this into `.set()`.
export function touch() {
  return { updatedAt: new Date() };
}
