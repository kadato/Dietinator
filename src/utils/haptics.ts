import * as Haptics from "expo-haptics"

/**
 * Tactile confirmation for the thumb-driven actions: quick-adds tick,
 * successful saves land, destructive deletes warn. Fire-and-forget by
 * design, callers never await. Failures (for example desktop browsers
 * without a vibration API) resolve silently so feedback never breaks a
 * save path.
 */
function settle(promise: Promise<void>): void {
  promise.catch(() => undefined)
}

/** Frequent, lightweight taps: quick-add pills, scanned adds, steppers. */
export function hapticLight(): void {
  settle(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
}

/** A commit landed: meal logged, entry saved, water poured. */
export function hapticSuccess(): void {
  settle(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
}

/** Something destructive happened: an entry or pour was deleted. */
export function hapticWarning(): void {
  settle(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))
}
