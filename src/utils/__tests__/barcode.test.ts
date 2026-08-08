import { pickBestBarcodeMatch } from "../barcode"
import type { SearchFoodResult } from "@/types"

const food = (overrides: Partial<SearchFoodResult> = {}): SearchFoodResult => ({
  product_id: "1234567890123",
  name: "Test Product",
  producer: "",
  nutrients: { kcal: 100, protein: 1, carbs: 2, fat: 3 },
  serving: { serving: "100 g", amount: 100, serving_quantity: 100 },
  base_unit: "g",
  is_verified: true,
  ...overrides,
})

describe("pickBestBarcodeMatch", () => {
  it("returns null for an empty list", () => {
    expect(pickBestBarcodeMatch([], "12345")).toBeNull()
  })

  it("returns the only result", () => {
    const only = food({ name: "Banana" })
    expect(pickBestBarcodeMatch([only], "12345")).toBe(only)
  })

  it("prefers a product whose id embeds the numeric barcode", () => {
    const a = food({ product_id: "999", name: "Generic" })
    const b = food({ product_id: "4000539115511", name: "Oat Drink" })
    expect(pickBestBarcodeMatch([a, b], "4000539115511")).toBe(b)
  })

  it("falls back to the first result when nothing matches", () => {
    const a = food({ name: "First" })
    const b = food({ name: "Second" })
    expect(pickBestBarcodeMatch([a, b], "1111111111111")).toBe(a)
  })

  it("ignores non-digit characters in the barcode", () => {
    const generic = food({ name: "Generic" })
    const b = food({ product_id: "4000539115511", name: "Oat Drink" })
    expect(pickBestBarcodeMatch([generic], " 4000539115511 ")?.product_id).toBe(generic.product_id)
    expect(pickBestBarcodeMatch([generic, b], "4000-5391-1551-1")).toBe(b)
  })
})
