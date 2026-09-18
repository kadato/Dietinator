export const SWIPE_THRESHOLD_PX = 24

export function getSwipeDirection(
  dx: number,
  dy: number,
  threshold: number = SWIPE_THRESHOLD_PX,
): "left" | "right" | null {
  "worklet"
  if (Math.abs(dx) < threshold) return null
  if (Math.abs(dx) < Math.abs(dy)) return null
  return dx < 0 ? "left" : "right"
}
