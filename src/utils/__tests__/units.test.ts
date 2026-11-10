import { formatWaterAmount, formatWeight, isImperial, parseWeightInput, weightToKg } from "../units"

describe("isImperial", () => {
  it("detects imperial only", () => {
    expect(isImperial("imperial")).toBe(true)
    expect(isImperial("metric")).toBe(false)
    expect(isImperial("")).toBe(false)
  })
})

describe("formatWeight", () => {
  it("formats kilograms in metric", () => {
    expect(formatWeight(72, "metric")).toBe("72kg")
  })

  it("converts to pounds in imperial", () => {
    expect(formatWeight(72, "imperial")).toBe("158.73lb")
  })

  it("caps metric values at two decimals and strips trailing zeros", () => {
    expect(formatWeight(72.123456, "metric")).toBe("72.12kg")
    expect(formatWeight(72.5, "metric")).toBe("72.5kg")
  })
})

describe("formatWaterAmount", () => {
  it("formats milliliters as liters in metric", () => {
    expect(formatWaterAmount(750, "metric")).toBe("0.75L")
    expect(formatWaterAmount(1000, "metric")).toBe("1L")
    expect(formatWaterAmount(2500, "metric")).toBe("2.5L")
  })

  it("converts to fluid ounces in imperial", () => {
    expect(formatWaterAmount(750, "imperial")).toBe("25.36fl oz")
  })
})

describe("weightToKg", () => {
  it("passes metric through", () => {
    expect(weightToKg(72.5, "metric")).toBe(72.5)
  })

  it("converts pounds to kilograms in imperial", () => {
    expect(weightToKg(158.7, "imperial")).toBeCloseTo(72, 1)
  })
})

describe("parseWeightInput", () => {
  it("parses a metric weight with decimal comma or dot", () => {
    expect(parseWeightInput("75.2", "metric")).toBeCloseTo(75.2)
    expect(parseWeightInput("75,2", "metric")).toBeCloseTo(75.2)
  })

  it("parses pounds as kilograms in imperial", () => {
    expect(parseWeightInput("165.4", "imperial")).toBeCloseTo(75.02, 1)
  })

  it("rejects empty, negative and non-numeric input", () => {
    expect(parseWeightInput("", "metric")).toBeNull()
    expect(parseWeightInput("abc", "metric")).toBeNull()
    expect(parseWeightInput("-5", "metric")).toBeNull()
    expect(parseWeightInput("0", "metric")).toBeNull()
    expect(parseWeightInput("3000", "metric")).toBeNull()
  })
})
