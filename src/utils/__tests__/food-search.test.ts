import { filterFoodsByQuery, filterRecentUsagesByQuery, mergeFoodResults } from "../food-search"
import { parseJson } from "../json"
import type { SearchFoodResult } from "@/types"

const food = (productId: string, name = productId): SearchFoodResult => ({
  product_id: productId,
  name,
  producer: "",
  nutrients: { kcal: 100, protein: 1, carbs: 2, fat: 3 },
  serving: { serving: "100 g", amount: 100, serving_quantity: 100 },
  base_unit: "g",
  is_verified: true,
})

describe("mergeFoodResults", () => {
  it("keeps local-first order and drops remote duplicates", () => {
    const local = [food("a", "Local A"), food("b", "Local B")]
    const remote = [food("b", "Remote B"), food("c", "Remote C")]
    const merged = mergeFoodResults(local, remote)
    expect(merged.map((f) => f.product_id)).toEqual(["a", "b", "c"])
    expect(merged[1].name).toBe("Local B")
  })

  it("handles empty lists", () => {
    expect(mergeFoodResults([], [])).toEqual([])
    expect(mergeFoodResults([food("a")], [])).toHaveLength(1)
    expect(mergeFoodResults([], [food("a")])).toHaveLength(1)
  })

  it("does not mutate inputs", () => {
    const local = [food("a")]
    mergeFoodResults(local, [food("a")])
    expect(local).toHaveLength(1)
  })
})

describe("filterFoodsByQuery", () => {
  const items = [
    { ...food("1", "Rolled Oats"), producer: "Quaker" },
    { ...food("2", "Greek Yogurt"), producer: "Chobani" },
    { ...food("3", "Oat Milk"), producer: "Oatly" },
    { ...food("4", "Banana"), producer: "" },
  ]

  it("returns all items when query is empty or whitespace", () => {
    expect(filterFoodsByQuery(items, "")).toEqual(items)
    expect(filterFoodsByQuery(items, "   ")).toEqual(items)
  })

  it("filters items by name case-insensitively", () => {
    const results = filterFoodsByQuery(items, "oat")
    expect(results.map((r) => r.name)).toEqual(["Rolled Oats", "Oat Milk"])
  })

  it("filters items by producer case-insensitively", () => {
    const results = filterFoodsByQuery(items, "chobani")
    expect(results.map((r) => r.name)).toEqual(["Greek Yogurt"])
  })

  it("returns empty array when no items match", () => {
    expect(filterFoodsByQuery(items, "nonexistent food item")).toEqual([])
  })
})

describe("filterRecentUsagesByQuery", () => {
  const usages = [
    {
      food: { ...food("1", "Scrambled Eggs"), producer: "Farm" },
      amount: 150,
      lastLoggedAt: "2026-10-17",
    },
    {
      food: { ...food("2", "Whole Milk"), producer: "Dairy" },
      amount: 250,
      lastLoggedAt: "2026-10-16",
    },
  ]

  it("returns all usages when query is empty", () => {
    expect(filterRecentUsagesByQuery(usages, "")).toEqual(usages)
  })

  it("filters usages by food name", () => {
    const results = filterRecentUsagesByQuery(usages, "egg")
    expect(results).toHaveLength(1)
    expect(results[0].food.name).toBe("Scrambled Eggs")
  })

  it("filters usages by producer", () => {
    const results = filterRecentUsagesByQuery(usages, "dairy")
    expect(results).toHaveLength(1)
    expect(results[0].food.name).toBe("Whole Milk")
  })
})

describe("parseJson", () => {
  it("parses valid JSON objects", () => {
    expect(parseJson<{ kcal: number }>('{"kcal": 89}')).toEqual({ kcal: 89 })
  })

  it("returns null for empty, corrupt or non-object JSON", () => {
    expect(parseJson("")).toBeNull()
    expect(parseJson(null)).toBeNull()
    expect(parseJson(undefined)).toBeNull()
    expect(parseJson("{broken")).toBeNull()
    expect(parseJson("42")).toBeNull()
    expect(parseJson('"text"')).toBeNull()
  })
})
