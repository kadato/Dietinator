import {
  displayUnit,
  formatListNutrientLine,
  formatNutrientsServingLabel,
  formatServingLabel,
  formatServingOption,
  formatUsageAmountLine,
} from "../food-display"
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

describe("food display labels", () => {
  it("formats dotted serving keys", () => {
    expect(formatServingLabel("whole.regular")).toBe("Whole Regular")
    expect(formatServingLabel("")).toBe("")
  })

  it("maps countable units", () => {
    expect(displayUnit("stück")).toBe("each")
    expect(displayUnit("portion")).toBe("serving")
    expect(displayUnit("g")).toBe("g")
    expect(displayUnit("")).toBe("g")
  })

  it("labels nutrient amounts", () => {
    const food = {
      nutrients: { kcal: 89, protein: 1, carbs: 23, fat: 0 },
      serving: serving(),
      base_unit: "g",
    }
    expect(formatNutrientsServingLabel(food, 0)).toContain("per")
    expect(formatNutrientsServingLabel(food, 150)).toContain("150")
    expect(
      formatNutrientsServingLabel({ ...food, serving: serving({ serving: "whole.regular" }) }, 150),
    ).toContain("Whole Regular")
  })

  it("renders list and usage lines", () => {
    const food = {
      product_id: "p1",
      name: "Banana",
      producer: "Dole",
      nutrients: { kcal: 0.89, protein: 0.011, carbs: 0.228, fat: 0.003 },
      serving: serving({ serving: "100 g", amount: 100, serving_quantity: 100 }),
      base_unit: "g",
      is_verified: true,
    }
    expect(formatListNutrientLine(food)).toContain("kcal")
    expect(formatListNutrientLine({ ...food, producer: "" })).toContain("kcal")
    expect(formatUsageAmountLine(food, 120)).toContain("120")
  })
})
