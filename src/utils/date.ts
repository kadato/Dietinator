export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** YAZIO API accepts `YYYY-MM-DD` without timezone shifting. */
export function toYazioApiDate(dateKey: string): string {
  return dateKey
}

/** Match `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss` from consumed-item payloads. */
export function matchesDateKey(itemDate: string | undefined, dateKey: string): boolean {
  if (!itemDate) return false
  const head = itemDate.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) && head === dateKey
}

/** Shift a `YYYY-MM-DD` key by whole days using local time (DST-safe). */
export function shiftDateKey(dateKey: string, delta: number): string {
  const d = parseDateKey(dateKey)
  d.setDate(d.getDate() + delta)
  return toDateKey(d)
}

export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function shortMonthDay(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number)
  return `${MONTHS_SHORT[m - 1]} ${d}`
}

function shortDisplayDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  const weekday = WEEKDAYS_SHORT[new Date(y, m - 1, d).getDay()]
  return `${weekday}, ${MONTHS_SHORT[m - 1]} ${d}`
}

export function formatDisplayDate(dateKey: string): string {
  const today = toDateKey()
  if (dateKey === today) return `Today, ${shortMonthDay(dateKey)}`

  const yesterday = shiftDateKey(today, -1)
  if (dateKey === yesterday) return `Yesterday, ${shortMonthDay(dateKey)}`

  return shortDisplayDate(dateKey)
}

/**
 * Header variant of {@link formatDisplayDate}: "Today" and "Yesterday" also
 * carry the weekday and full date so the current view stays oriented.
 */
export function formatHeaderDate(dateKey: string): string {
  const today = toDateKey()
  if (dateKey === today) return `Today, ${shortDisplayDate(dateKey)}`
  if (dateKey === shiftDateKey(today, -1)) return `Yesterday, ${shortDisplayDate(dateKey)}`
  return formatDisplayDate(dateKey)
}
