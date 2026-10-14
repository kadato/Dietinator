import {
  displayUnit,
  formatEntryAmount,
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

  it("handles countable piece units like eggs and portions", () => {
    expect(
      formatNutrientsServingLabel(
        {
          nutrients: { kcal: 78, protein: 6, carbs: 0, fat: 5 },
          serving: serving({ serving: "stück", amount: 1 }),
          base_unit: "stück",
        },
        2,
      ),
    ).toBe("for 2 pcs")
    expect(
      formatNutrientsServingLabel(
        {
          nutrients: { kcal: 78, protein: 6, carbs: 0, fat: 5 },
          serving: serving({ serving: "piece", amount: 1 }),
          base_unit: "piece",
        },
        1,
      ),
    ).toBe("for 1 pc")
    expect(
      formatNutrientsServingLabel(
        {
          nutrients: { kcal: 150, protein: 12, carbs: 1, fat: 10 },
          serving: serving({ serving: "1 medium egg (55g)", amount: 55 }),
          base_unit: "g",
        },
        110,
      ),
    ).toBe("for 110 g (2 × 1 medium egg (55g))")
  })
})

describe("formatEntryAmount", () => {
  it("formats countable units directly without grams", () => {
    expect(formatEntryAmount({ amount: 2, unit: "piece" })).toBe("2 pcs")
    expect(formatEntryAmount({ amount: 1, unit: "stück" })).toBe("1 pc")
    expect(formatEntryAmount({ amount: 3, unit: "slice" })).toBe("3 slices")
  })

  it("formats plain gram and ml amounts when no serving is attached", () => {
    expect(formatEntryAmount({ amount: 150, unit: "g" })).toBe("150 g")
    expect(formatEntryAmount({ amount: 250, unit: "ml" })).toBe("250 ml")
  })

  it("formats pieces with grams when entry has piece serving (e.g. eggs)", () => {
    expect(
      formatEntryAmount({
        amount: 110,
        unit: "g",
        food_name: "Egg",
        serving: serving({ serving: "1 piece", amount: 55 }),
      }),
    ).toBe("2 pcs (110 g)")
    expect(
      formatEntryAmount({
        amount: 55,
        unit: "g",
        food_name: "Medium egg",
        serving: serving({ serving: "1 medium egg (55g)", amount: 55 }),
      }),
    ).toBe("1 pc (55 g)")
    expect(
      formatEntryAmount({
        amount: 165,
        unit: "g",
        food_name: "Ei",
        serving: serving({ serving: "1 egg (55g)", amount: 55 }),
      }),
    ).toBe("3 pcs (165 g)")
  })

  it("resolves piece servings from servings array when default serving is 100g", () => {
    expect(
      formatEntryAmount({
        amount: 110,
        unit: "g",
        food_name: "Egg",
        serving: serving({ serving: "100 g", amount: 100 }),
        servings: [
          serving({ serving: "1 piece", amount: 55 }),
          serving({ serving: "100 g", amount: 100 }),
        ],
      }),
    ).toBe("2 pcs (110 g)")
  })

  it("formats bread slices and other countable portions cleanly", () => {
    expect(
      formatEntryAmount({
        amount: 60,
        unit: "g",
        food_name: "Toast bread",
        serving: serving({ serving: "1 slice (30g)", amount: 30 }),
      }),
    ).toBe("2 slices (60 g)")
    expect(
      formatEntryAmount({
        amount: 45,
        unit: "g",
        food_name: "Protein bar",
        serving: serving({ serving: "1 bar (45g)", amount: 45 }),
      }),
    ).toBe("1 bar (45 g)")
  })
})
