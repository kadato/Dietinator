import { formatNumber } from "../format"

describe("formatNumber", () => {
  it("keeps integers intact", () => {
    expect(formatNumber(80)).toBe("80")
    expect(formatNumber(0)).toBe("0")
  })

  it("caps decimals at two and strips trailing zeros", () => {
    expect(formatNumber(75.5)).toBe("75.5")
    expect(formatNumber(75.55)).toBe("75.55")
    expect(formatNumber(75.555)).toBe("75.56")
    expect(formatNumber(0.5)).toBe("0.5")
    expect(formatNumber(0.05)).toBe("0.05")
  })

  it("respects a custom max decimals", () => {
    expect(formatNumber(12.345, 1)).toBe("12.3")
    expect(formatNumber(12.345, 0)).toBe("12")
  })

  it("handles non-finite values", () => {
    expect(formatNumber(Number.NaN)).toBe("0")
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("0")
  })
})
