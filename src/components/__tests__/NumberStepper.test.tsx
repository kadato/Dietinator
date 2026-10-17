import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"
import { NumberStepper } from "@/components/NumberStepper"
import { useTheme } from "@/hooks/useTheme"

jest.mock("@/hooks/useTheme", () => ({
  useTheme: jest.fn(),
}))

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>

describe("NumberStepper", () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      colors: {
        primary: "#10b981",
        surface: "#1f2937",
        surfaceAlt: "#111827",
        border: "#374151",
        text: "#ffffff",
        textMuted: "#9ca3af",
      } as any,
      colorScheme: "dark",
      isDark: true,
    })
  })

  it("renders input value and fires onChangeText", async () => {
    const onChangeText = jest.fn()
    const screen = await render(
      <NumberStepper value="150" onChangeText={onChangeText} accessibilityLabel="Amount in g" />,
    )

    const input = screen.getByLabelText("Amount in g")
    expect(input.props.value).toBe("150")

    await act(async () => {
      fireEvent.changeText(input, "200")
    })
    expect(onChangeText).toHaveBeenCalledWith("200")
  })

  it("steps value up and down", async () => {
    const onChangeText = jest.fn()
    const screen = await render(
      <NumberStepper
        value="100"
        onChangeText={onChangeText}
        step={10}
        accessibilityLabel="Amount in g"
      />,
    )

    const plus = screen.getByTestId("stepper-plus")
    await act(async () => {
      fireEvent.press(plus)
    })
    expect(onChangeText).toHaveBeenCalledWith("110")

    const minus = screen.getByTestId("stepper-minus")
    await act(async () => {
      fireEvent.press(minus)
    })
    expect(onChangeText).toHaveBeenCalledWith("90")
  })

  it("tracks focus and blur events", async () => {
    const onFocus = jest.fn()
    const onBlur = jest.fn()
    const screen = await render(
      <NumberStepper
        value="100"
        onChangeText={jest.fn()}
        accessibilityLabel="Amount in g"
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    )

    const input = screen.getByLabelText("Amount in g")
    await act(async () => {
      fireEvent(input, "focus")
    })
    expect(onFocus).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent(input, "blur")
    })
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})
