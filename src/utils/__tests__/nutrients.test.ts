import {
  isPerGramNutrients,
  isPerGramRawNutrients,
  nutrientsForAmount,
  nutrientsFromYazio,
  nutrientsReferenceAmount,
  scaleNutrients,
  sumNutrients,
  toKcal,
} from "../nutrients"
import type { FoodNutrients, FoodServing } from "@/types"

const serving = (overrides: Partial<FoodServing> = {}): FoodServing => ({
  serving: "100 g",
  amount: 100,
  serving_quantity: 100,
  ...overrides,
})

describe("toKcal", () => {
  it("rounds kcal values as-is", () => {
    expect(toKcal(89.4)).toBe(89)
  })

  it("converts kilojoules with 4.184", () => {
    expect(toKcal(374, "kj")).toBe(89)
    expect(toKcal(1000, "kilojoule")).toBe(239)
  })

  it("tolerates whitespace and case", () => {
    expect(toKcal(418.4, "  KJ ")).toBe(100)
  })
})

describe("isPerGramRawNutrients", () => {
  it("detects per-gram raw API values", () => {
    expect(isPerGramRawNutrients({ "energy.energy": 0.89 }, "g")).toBe(true)
    expect(isPerGramRawNutrients({ "energy.energy": 8.84 }, "ml")).toBe(true)
  })

  it("rejects zero, >= 10 kcal and non base units", () => {
    expect(isPerGramRawNutrients({ "energy.energy": 0 }, "g")).toBe(false)
    expect(isPerGramRawNutrients({ "energy.energy": 10 }, "g")).toBe(false)
    expect(isPerGramRawNutrients({ "energy.energy": 0.89 }, "serving")).toBe(false)
  })

  it("converts kj before comparing", () => {
    expect(isPerGramRawNutrients({ "energy.energy": 30 }, "g", "kj")).toBe(true)
    expect(isPerGramRawNutrients({ "energy.energy": 30 }, "g", "kcal")).toBe(false)
  })
})

describe("isPerGramNutrients", () => {
  it("uses serving_quantity as the reliable discriminator", () => {
    const lowCal = { kcal: 0.4, protein: 0, carbs: 0.1, fat: 0 }
    expect(isPerGramNutrients(lowCal, "ml", 1)).toBe(true)
    expect(isPerGramNutrients(lowCal, "ml", 100)).toBe(false)
    expect(isPerGramNutrients(lowCal, "g")).toBe(true)
  })

  it("never flags non-base units or high calories", () => {
    const normal = { kcal: 89, protein: 1, carbs: 20, fat: 0.3 }
    expect(isPerGramNutrients(normal, "g", 1)).toBe(false)
    expect(isPerGramNutrients(normal, "serving", 1)).toBe(false)
  })
})

describe("nutrientsFromYazio", () => {
  it("maps raw payload keys and rounds macros to 0.1", () => {
    const result = nutrientsFromYazio({
      "energy.energy": 89.4,
      "nutrient.protein": 1.23,
      "nutrient.carb": 20.04,
      "nutrient.fat": 0.25,
    })
    expect(result).toEqual({ kcal: 89, protein: 1.2, carbs: 20, fat: 0.3 })
  })

  it("applies a multiplier before rounding (per-gram → per-100g normalization)", () => {
    const result = nutrientsFromYazio(
      {
        "energy.energy": 0.89,
        "nutrient.protein": 0.012,
        "nutrient.carb": 0.2,
        "nutrient.fat": 0.003,
      },
      "kcal",
      100,
    )
    expect(result).toEqual({ kcal: 89, protein: 1.2, carbs: 20, fat: 0.3 })
  })
})

describe("nutrientsReferenceAmount", () => {
  it("returns amount when quantity equals amount", () => {
    expect(nutrientsReferenceAmount(serving(), "g")).toBe(100)
  })

  it("resolves per-100 g labels on product detail", () => {
    expect(
      nutrientsReferenceAmount(
        serving({ serving: "100 g", amount: 150, serving_quantity: 100 }),
        "g",
      ),
    ).toBe(100)
  })

  it("resolves search rows with 1 g quantity against a 100 g amount", () => {
    expect(
      nutrientsReferenceAmount(serving({ serving: "g", amount: 100, serving_quantity: 1 }), "g"),
    ).toBe(100)
  })

  it("keeps default portions (bar of 30 g with quantity 1)", () => {
    expect(
      nutrientsReferenceAmount(serving({ serving: "g", amount: 30, serving_quantity: 1 }), "g"),
    ).toBe(30)
  })

  it("keeps named portions (1 scoop @ amount)", () => {
    expect(
      nutrientsReferenceAmount(
        serving({ serving: "1 scoop", amount: 25, serving_quantity: 1 }),
        "g",
      ),
    ).toBe(25)
  })
})

describe("scaleNutrients", () => {
  it("scales linearly and rounds like the app", () => {
    const base: FoodNutrients = { kcal: 89, protein: 1.2, carbs: 20, fat: 0.3 }
    expect(scaleNutrients(base, 100, 250)).toEqual({ kcal: 223, protein: 3, carbs: 50, fat: 0.8 })
  })

  it("returns the base unchanged for non-positive base amounts", () => {
    expect(scaleNutrients({ kcal: 89, protein: 1, carbs: 2, fat: 3 }, 0, 100)).toEqual({
      kcal: 89,
      protein: 1,
      carbs: 2,
      fat: 3,
    })
  })
})

describe("nutrientsForAmount", () => {
  it("scales per-gram nutrients by the requested grams", () => {
    // Banana: 0.89 kcal/g raw → normalized 89 kcal/100 g → 150 g = ~134 kcal
    const perGram: FoodNutrients = { kcal: 0.89, protein: 0.011, carbs: 0.23, fat: 0.003 }
    const result = nutrientsForAmount(
      perGram,
      serving({ amount: 100, serving_quantity: 1, serving: "g" }),
      150,
      "g",
    )
    expect(result.kcal).toBe(134)
  })

  it("handles per-100 g products directly", () => {
    const per100: FoodNutrients = { kcal: 884, protein: 0, carbs: 0, fat: 100 }
    expect(nutrientsForAmount(per100, serving(), 10, "ml")).toEqual({
      kcal: 88,
      protein: 0,
      carbs: 0,
      fat: 10,
    })
  })
})

describe("sumNutrients", () => {
  it("sums entries with macro rounding per addend", () => {
    const a: FoodNutrients = { kcal: 134, protein: 1.7, carbs: 34.5, fat: 0.5 }
    const b: FoodNutrients = { kcal: 88, protein: 0.1, carbs: 0.2, fat: 10 }
    expect(sumNutrients([a, b])).toEqual({ kcal: 222, protein: 1.8, carbs: 34.7, fat: 10.5 })
  })

  it("returns zeros for an empty list", () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })
})
