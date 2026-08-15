import { getFoodIcon, getFoodIconDescriptor } from "../food-icon"

describe("food-icon", () => {
  it("resolves fruits in English and Hungarian", () => {
    expect(getFoodIcon("Banana")).toBe("food-apple")
    expect(getFoodIcon("Piros alma")).toBe("food-apple")
    expect(getFoodIcon("Friss eper 250g")).toBe("food-apple")
    expect(getFoodIcon("Görögdinnye")).toBe("food-apple")
    expect(getFoodIcon("Orange Juice")).toBe("cup-water") // matches juice first
  })

  it("resolves vegetables and greens", () => {
    expect(getFoodIcon("Paradicsom saláta")).toBe("carrot")
    expect(getFoodIcon("Broccoli steamed")).toBe("carrot")
    expect(getFoodIcon("Sült burgonya")).toBe("carrot")
    expect(getFoodIcon("Cucumber")).toBe("carrot")
  })

  it("resolves poultry and meats", () => {
    expect(getFoodIcon("Grillezett csirkemell")).toBe("food-drumstick")
    expect(getFoodIcon("Pulyka sonka")).toBe("food-drumstick")
    expect(getFoodIcon("Beef Steak 200g")).toBe("food-steak")
    expect(getFoodIcon("Sertéskaraj")).toBe("food-steak")
    expect(getFoodIcon("Gyulai kolbász")).toBe("food-steak")
  })

  it("resolves fish and seafood", () => {
    expect(getFoodIcon("Lazacfilé")).toBe("fish")
    expect(getFoodIcon("Tuna salad in oil")).toBe("fish")
    expect(getFoodIcon("Garnélarák")).toBe("fish")
  })

  it("resolves eggs", () => {
    expect(getFoodIcon("Főtt tojás")).toBe("egg")
    expect(getFoodIcon("Scrambled eggs with butter")).toBe("egg")
    expect(getFoodIcon("Rántotta")).toBe("egg")
  })

  it("resolves dairy and cheese", () => {
    expect(getFoodIcon("Trappista sajt")).toBe("cheese")
    expect(getFoodIcon("Tej 2.8%")).toBe("cheese")
    expect(getFoodIcon("Görög joghurt")).toBe("cheese")
    expect(getFoodIcon("Zsírszegény túró")).toBe("cheese")
  })

  it("resolves bakery items", () => {
    expect(getFoodIcon("Teljes kiőrlésű kenyér")).toBe("bread-slice")
    expect(getFoodIcon("Vajas kifli")).toBe("bread-slice")
    expect(getFoodIcon("Croissant")).toBe("bread-slice")
    expect(getFoodIcon("Bagel")).toBe("bread-slice")
  })

  it("resolves grains, pasta, oats, and cereals", () => {
    expect(getFoodIcon("Spagetti tészta")).toBe("pasta")
    expect(getFoodIcon("Barna rizs")).toBe("pasta")
    expect(getFoodIcon("Zabpehely kása")).toBe("pasta")
  })

  it("resolves beverages and coffee", () => {
    expect(getFoodIcon("Ásványvíz mentes")).toBe("cup-water")
    expect(getFoodIcon("Espresso kávé")).toBe("cup-water")
    expect(getFoodIcon("Coca-Cola Zero")).toBe("cup-water")
    expect(getFoodIcon("Craft sör")).toBe("cup-water")
  })

  it("resolves sweets, desserts, and fast food", () => {
    expect(getFoodIcon("Étcsokoládé 70%")).toBe("cookie")
    expect(getFoodIcon("Csokis keksz")).toBe("cookie")
    expect(getFoodIcon("Pizza Margherita")).toBe("pizza")
    expect(getFoodIcon("Cheeseburger")).toBe("pizza")
  })

  it("resolves nuts and seeds", () => {
    expect(getFoodIcon("Pirított mandula")).toBe("peanut")
    expect(getFoodIcon("Földimogyoró")).toBe("peanut")
    expect(getFoodIcon("Dióbél")).toBe("peanut")
  })

  it("falls back to macronutrient heuristics if unknown name", () => {
    // Unknown high-protein powder
    expect(
      getFoodIcon("IsoWhey X-9000", {
        kcal: 120,
        protein: 27,
        carbs: 1,
        fat: 1,
      }),
    ).toBe("food-steak")

    // General unknown item with balanced profile
    const desc = getFoodIconDescriptor("Mysterious Dish")
    expect(desc.name).toBe("silverware-fork-knife")
    expect(desc.category).toBe("general")
  })
})
