import React from "react"
import { render } from "@testing-library/react-native"
import { CalorieRing } from "@/components/CalorieRing"
import { useTheme } from "@/hooks/useTheme"

jest.mock("@/hooks/useTheme", () => ({
  useTheme: jest.fn(),
}))

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>

describe("CalorieRing swipe gesture", () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      colors: {
        primary: "#10b981",
        breakfast: "#3b82f6",
        lunch: "#f59e0b",
        dinner: "#ef4444",
        snack: "#8b5cf6",
        text: "#ffffff",
        textMuted: "#9ca3af",
        border: "#374151",
        danger: "#ef4444",
        success: "#10b981",
      } as any,
      colorScheme: "dark",
      isDark: true,
    })
  })

  it("configures gesture with runOnJS(true) and triggers navigation on swipe", async () => {
    const onSwipeLeft = jest.fn()
    const onSwipeRight = jest.fn()

    const screen = await render(
      <CalorieRing
        consumed={1500}
        goal={2000}
        onSwipeLeft={onSwipeLeft}
        onSwipeRight={onSwipeRight}
      />,
    )

    const ringWrap = screen.getByHintText("Swipes left or right to change the selected day")
    const detectorElement = ringWrap.parent?.props.children[0]
    const gesture = detectorElement?.props?.gesture

    expect(gesture).toBeDefined()
    expect(gesture.config.runOnJS).toBe(true)

    // Trigger onEnd with left swipe (dx = -50, dy = 0)
    gesture.handlers.onEnd({ translationX: -50, translationY: 0 })
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(onSwipeRight).not.toHaveBeenCalled()

    // Trigger onEnd with right swipe (dx = 50, dy = 0)
    gesture.handlers.onEnd({ translationX: 50, translationY: 0 })
    expect(onSwipeRight).toHaveBeenCalledTimes(1)
  })

  it("does not trigger swipe callbacks on small or vertical gestures", async () => {
    const onSwipeLeft = jest.fn()
    const onSwipeRight = jest.fn()

    const screen = await render(
      <CalorieRing
        consumed={1500}
        goal={2000}
        onSwipeLeft={onSwipeLeft}
        onSwipeRight={onSwipeRight}
      />,
    )

    const ringWrap = screen.getByHintText("Swipes left or right to change the selected day")
    const detectorElement = ringWrap.parent?.props.children[0]
    const gesture = detectorElement?.props?.gesture

    // Small swipe below threshold
    gesture.handlers.onEnd({ translationX: -10, translationY: 0 })
    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()

    // Mostly vertical gesture
    gesture.handlers.onEnd({ translationX: 30, translationY: 60 })
    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })
})
