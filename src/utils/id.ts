/** Collision-resistant ids for diary entries and YAZIO consumed items. */
export function generateId(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return random
}
