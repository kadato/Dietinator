import { mergeFoodResults } from "../food-search"
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
