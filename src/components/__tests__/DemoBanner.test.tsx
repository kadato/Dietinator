import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"
import { DemoBanner } from "@/components/DemoBanner"
import { useTheme } from "@/hooks/useTheme"

jest.mock("@/hooks/useTheme", () => ({
  useTheme: jest.fn(),
}))

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

// Gluestack web utils ship ESM that Jest cannot transform, so the banner
// test stands in the real host components for Box and Text.
jest.mock("@ui/box", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native")
  return { Box: View }
})

jest.mock("@ui/text", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require("react-native")
  return { Text }
})

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>

describe("DemoBanner", () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      colors: {
        primary: "#10b981",
        onPrimary: "#ffffff",
        text: "#ffffff",
        textMuted: "#9ca3af",
        border: "#374151",
      } as any,
      colorScheme: "dark",
      isDark: true,
    })
  })

  it("renders nothing when the session is not a demo", async () => {
    const screen = await render(
      <DemoBanner visible={false} onReset={jest.fn()} onExit={jest.fn()} />,
    )
    expect(screen.toJSON()).toBeNull()
  })

  it("explains the demo and offers reset plus exit", async () => {
    const onReset = jest.fn()
    const onExit = jest.fn()
    const screen = await render(<DemoBanner visible onReset={onReset} onExit={onExit} />)

    expect(screen.getByLabelText("Demo mode. Sample data resets daily.")).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Reset demo data"))
    })
    expect(onReset).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Exit demo"))
    })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it("disables both actions while a reset is running", async () => {
    const onReset = jest.fn()
    const onExit = jest.fn()
    const screen = await render(<DemoBanner visible resetting onReset={onReset} onExit={onExit} />)

    expect(screen.getByText("Working")).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Reset demo data"))
    })
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Exit demo"))
    })
    expect(onReset).not.toHaveBeenCalled()
    expect(onExit).not.toHaveBeenCalled()
  })
})
