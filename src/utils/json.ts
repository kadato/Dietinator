/** Parse a JSON column; empty or corrupt values return null so one bad row can't break a screen. */
export function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}
