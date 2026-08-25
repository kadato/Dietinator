import { formatServingOption } from "../food-display"
import type { FoodServing } from "@/types"

const serving = (overrides: Partial<FoodServing> = {}): FoodServing => ({
  serving: "100 g",
  amount: 100,
  serving_quantity: 100,
  ...overrides,
})

describe("formatServingOption", () => {
  it("renders plain unit labels without a parenthetical", () => {
    expect(formatServingOption(serving(), "g")).toBe("100 g")
    expect(formatServingOption(serving({ serving: "ml", amount: 250 }), "ml")).toBe("250 ml")
  })

  it("renders countable unit labels without a parenthetical", () => {
    expect(formatServingOption(serving({ serving: "stück", amount: 1 }), "stück")).toBe("1 each")
  })

  it("appends the amount for named portions without one", () => {
    expect(formatServingOption(serving({ serving: "1 scoop", amount: 25 }), "g")).toBe(
      "1 scoop (25 g)",
    )
  })

  it("does not double the amount when the name already carries it", () => {
    expect(formatServingOption(serving({ serving: "1 medium (118g)", amount: 118 }), "g")).toBe(
      "1 medium (118g)",
    )
    expect(
      formatServingOption(serving({ serving: "2 large eggs (120 g)", amount: 120 }), "g"),
    ).toBe("2 large eggs (120 g)")
    expect(formatServingOption(serving({ serving: "1 cup (240ml)", amount: 240 }), "ml")).toBe(
      "1 cup (240ml)",
    )
  })
})
