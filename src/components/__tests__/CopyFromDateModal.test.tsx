import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"
import { CopyFromDateModal } from "@/components/CopyFromDateModal"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { getCalorieHistory } from "@/db/stats"
import { getDiaryEntriesForDate } from "@/services/diary"

jest.mock("@/hooks/useTheme", () => ({
  useTheme: jest.fn(),
}))

jest.mock("@/hooks/useLayout", () => ({
  useLayout: jest.fn(),
}))

jest.mock("@/db/stats", () => ({
  getCalorieHistory: jest.fn(),
}))

jest.mock("@/services/diary", () => ({
  getDiaryEntriesForDate: jest.fn(),
}))

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>
const mockUseLayout = useLayout as jest.MockedFunction<typeof useLayout>
const mockGetCalorieHistory = getCalorieHistory as jest.MockedFunction<typeof getCalorieHistory>
const mockGetDiaryEntriesForDate = getDiaryEntriesForDate as jest.MockedFunction<
  typeof getDiaryEntriesForDate
>

describe("CopyFromDateModal", () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      colors: {
        primary: "#10b981",
        surface: "#ffffff",
        surfaceAlt: "#f1f5f9",
        border: "#0f172a",
        text: "#0f172a",
        textMuted: "#475569",
        onPrimary: "#ffffff",
        warning: "#e0af68",
        danger: "#f7768e",
        breakfast: "#0369a1",
        lunch: "#92400e",
        dinner: "#be123c",
        snack: "#0f766e",
      } as any,
      colorScheme: "light",
      isDark: false,
    })

    mockUseLayout.mockReturnValue({
      width: 360,
      isMedium: false,
      isWide: false,
      isLarge: false,
      isXl: false,
      contentMaxWidth: 360,
    })

    mockGetCalorieHistory.mockResolvedValue([])
    mockGetDiaryEntriesForDate.mockResolvedValue([])
  })

  it("renders modal with Cancel button and no duplicate X fab", async () => {
    const onClose = jest.fn()
    const onCopy = jest.fn()

    const screen = await render(
      <CopyFromDateModal
        visible={true}
        targetDateKey="2026-10-20"
        initialDateKey="2026-10-19"
        onClose={onClose}
        onCopy={onCopy}
      />,
    )

    // The Cancel button should be present
    const cancelBtn = screen.getByLabelText("Cancel copy")
    expect(cancelBtn).toBeTruthy()

    // The duplicate "Close copy picker" FAB should NOT be present
    expect(screen.queryByLabelText("Close copy picker")).toBeNull()

    // Tapping Cancel fires onClose
    await act(async () => {
      fireEvent.press(cancelBtn)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("renders empty preview message when no meals are logged on selected day", async () => {
    const screen = await render(
      <CopyFromDateModal
        visible={true}
        targetDateKey="2026-10-20"
        initialDateKey="2026-10-19"
        onClose={jest.fn()}
        onCopy={jest.fn()}
      />,
    )

    expect(screen.getByText("No meals on this day. Pick another with a dot.")).toBeTruthy()
    expect(screen.getByText("Nothing logged")).toBeTruthy()
  })
})
