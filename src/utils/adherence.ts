import { shiftDateKey, toDateKey } from "@/utils/date"

export type DailyTotal = { date: string; kcal: number }

export type AdherenceSummary = {
  /** Days with at least one diary entry in the range. */
  loggedDays: number
  /** Logged days that stayed at or under the calorie goal. */
  onTargetDays: number
  /** Logged days that went over the calorie goal. */
  overGoalDays: number
  /** Share of logged days on target (0-100); null without logged days or a goal. */
  onTargetPct: number | null
}

/**
 * Calorie adherence over a history of daily totals: how often the user stayed
 * at or under their goal. Days without any logged entry are simply not part
 * of the sample.
 */
export function computeAdherence(history: DailyTotal[], goal: number): AdherenceSummary {
  const loggedDays = history.filter((day) => day.kcal > 0).length
  if (loggedDays === 0 || goal <= 0) {
    return { loggedDays, onTargetDays: 0, overGoalDays: 0, onTargetPct: null }
  }
  const onTargetDays = history.filter((day) => day.kcal > 0 && day.kcal <= goal).length
  return {
    loggedDays,
    onTargetDays,
    overGoalDays: loggedDays - onTargetDays,
    onTargetPct: Math.round((onTargetDays / loggedDays) * 100),
  }
}

/**
 * Consecutive days with a logged entry, counted backwards from today. A day
 * without any entry breaks the streak; an unlogged today still counts the run
 * that ends yesterday (the streak is not dead until today is over).
 */
export function computeLogStreak(history: DailyTotal[], todayKey: string = toDateKey()): number {
  const logged = new Set(history.filter((day) => day.kcal > 0).map((day) => day.date))
  if (logged.size === 0) return 0

  let cursor = logged.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1)
  let streak = 0
  while (logged.has(cursor)) {
    streak += 1
    cursor = shiftDateKey(cursor, -1)
  }
  return streak
}
