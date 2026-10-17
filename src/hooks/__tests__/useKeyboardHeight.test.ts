import { renderHook, act } from "@testing-library/react-native"
import { Keyboard } from "react-native"
import { useKeyboardHeight } from "@/hooks/useKeyboardVisible"

describe("useKeyboardHeight and useKeyboardVisible", () => {
  it("initializes with height 0 and visibility false", async () => {
    const { result } = await renderHook(() => useKeyboardHeight())
    expect(result.current.keyboardHeight).toBe(0)
    expect(result.current.isKeyboardVisible).toBe(false)
  })

  it("updates keyboard height on keyboard show and hide", async () => {
    let showCallback: ((e: any) => void) | null = null
    let hideCallback: (() => void) | null = null

    const addListenerSpy = jest
      .spyOn(Keyboard, "addListener")
      .mockImplementation((event: string, callback: any) => {
        if (event.toLowerCase().includes("show")) {
          showCallback = callback
        } else if (event.toLowerCase().includes("hide")) {
          hideCallback = callback
        }
        return { remove: jest.fn() } as any
      })

    const { result } = await renderHook(() => useKeyboardHeight())

    expect(showCallback).not.toBeNull()
    await act(async () => {
      showCallback!({ endCoordinates: { height: 320 } })
    })

    expect(result.current.keyboardHeight).toBe(320)
    expect(result.current.isKeyboardVisible).toBe(true)

    expect(hideCallback).not.toBeNull()
    await act(async () => {
      hideCallback!()
    })

    expect(result.current.keyboardHeight).toBe(0)
    expect(result.current.isKeyboardVisible).toBe(false)

    addListenerSpy.mockRestore()
  })
})
