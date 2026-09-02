import { withAlpha, mixColors } from "../color"

describe("withAlpha", () => {
  it("converts a 6-digit hex to rgba", () => {
    expect(withAlpha("#0f766e", 0.5)).toBe("rgba(15, 118, 110, 0.5)")
    expect(withAlpha("#ffffff", 1)).toBe("rgba(255, 255, 255, 1)")
    expect(withAlpha("#000000", 0)).toBe("rgba(0, 0, 0, 0)")
  })

  it("strips an 8-digit hex alpha suffix", () => {
    expect(withAlpha("#0f766e22", 0.14)).toBe("rgba(15, 118, 110, 0.14)")
    expect(withAlpha("0f766e88", 0.2)).toBe("rgba(15, 118, 110, 0.2)")
  })

  it("returns the original string for non-hex input", () => {
    expect(withAlpha("not-a-color", 0.5)).toBe("not-a-color")
    expect(withAlpha("#zzzzzz", 0.3)).toBe("#zzzzzz")
  })

  it("handles hex without leading hash", () => {
    expect(withAlpha("ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)")
  })
})

describe("mixColors", () => {
  it("mixes two colors at 0.5", () => {
    expect(mixColors("#000000", "#ffffff", 0.5)).toBe("#808080")
    expect(mixColors("#ff0000", "#0000ff", 0.5)).toBe("#800080")
  })

  it("returns base at 0 and tint at 1", () => {
    expect(mixColors("#123456", "#abcdef", 0)).toBe("#123456")
    expect(mixColors("#123456", "#abcdef", 1)).toBe("#abcdef")
  })

  it("handles hex without hash and invalid hex", () => {
    expect(mixColors("ffffff", "000000", 0.5)).toBe("#808080")
    expect(mixColors("not-a-color", "#ffffff", 0.5)).toBe("#808080")
  })

  it("rounds channel values", () => {
    expect(mixColors("#000000", "#ffffff", 0.25)).toBe("#404040")
  })
})
