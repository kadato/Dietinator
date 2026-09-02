import { formatMacro, formatThousands, formatTimeHM } from "../format"

describe("formatMacro", () => {
  it("formats integers without decimal", () => {
    expect(formatMacro(80)).toBe("80")
    expect(formatMacro(0)).toBe("0")
  })
  it("keeps one decimal for non-integers", () => {
    expect(formatMacro(12.34)).toBe("12.3")
    expect(formatMacro(12.35)).toBe("12.4")
    expect(formatMacro(1.05)).toBe("1.1")
  })
})

describe("formatThousands", () => {
  it("adds comma separators", () => {
    expect(formatThousands(1234)).toBe("1,234")
    expect(formatThousands(1234567)).toBe("1,234,567")
    expect(formatThousands(0)).toBe("0")
    expect(formatThousands(999)).toBe("999")
  })
  it("returns 0 for non-finite", () => {
    expect(formatThousands(NaN)).toBe("0")
    expect(formatThousands(Infinity)).toBe("0")
  })
})

describe("formatTimeHM", () => {
  it("formats ISO time as HH:MM", () => {
    expect(formatTimeHM("2024-01-15T08:05:00.000Z")).toMatch(/^\d{2}:\d{2}$/)
    expect(formatTimeHM("invalid")).toBe("")
  })
})
