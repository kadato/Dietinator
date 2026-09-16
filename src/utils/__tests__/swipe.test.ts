import { getSwipeDirection } from "@/utils/swipe"

describe("getSwipeDirection", () => {
  it("maps a left drag to left and a right drag to right", () => {
    expect(getSwipeDirection(-60, 0)).toBe("left")
    expect(getSwipeDirection(60, 0)).toBe("right")
  })

  it("ignores short drags below the threshold", () => {
    expect(getSwipeDirection(-10, 0)).toBeNull()
    expect(getSwipeDirection(10, 0)).toBeNull()
  })

  it("ignores vertical drags so list scroll never flips the day", () => {
    expect(getSwipeDirection(0, -80)).toBeNull()
    expect(getSwipeDirection(30, -60)).toBeNull()
  })
})
