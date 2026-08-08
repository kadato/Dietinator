import { formatWaterAmount, formatWeight, isImperial } from "../units"

describe("isImperial", () => {
  it("detects imperial only", () => {
    expect(isImperial("imperial")).toBe(true)
    expect(isImperial("metric")).toBe(false)
    expect(isImperial("")).toBe(false)
  })
})

describe("formatWeight", () => {
  it("formats kilograms in metric", () => {
    expect(formatWeight(72, "metric")).toBe("72 kg")
  })

  it("converts to pounds in imperial", () => {
    expect(formatWeight(72, "imperial")).toBe("158.7 lb")
  })
})

describe("formatWaterAmount", () => {
  it("formats milliliters as liters in metric", () => {
    expect(formatWaterAmount(750, "metric")).toBe("0.8 L")
    expect(formatWaterAmount(1000, "metric")).toBe("1 L")
  })

  it("converts to fluid ounces in imperial", () => {
    expect(formatWaterAmount(750, "imperial")).toBe("25 fl oz")
  })
})
