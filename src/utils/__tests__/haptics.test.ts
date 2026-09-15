import * as Haptics from "expo-haptics"
import { hapticLight, hapticSuccess, hapticWarning } from "@/utils/haptics"

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}))

describe("haptics", () => {
  it("ticks lightly for frequent actions", () => {
    hapticLight()
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light")
  })

  it("confirms commits and warns on deletes without throwing", () => {
    expect(() => {
      hapticSuccess()
      hapticWarning()
    }).not.toThrow()
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success")
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning")
  })
})
