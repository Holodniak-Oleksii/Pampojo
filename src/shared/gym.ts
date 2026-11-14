/** Every group must contain at least one item the gym has; `[]` is always available. */
export function isAvailableInGym(
  requirements: readonly (readonly string[])[],
  gymEquipment: readonly string[],
): boolean {
  const gym = new Set(gymEquipment);
  return requirements.every((group) => group.some((item) => gym.has(item)));
}
