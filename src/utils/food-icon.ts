import type { ComponentProps } from "react"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import type { FoodNutrients } from "@/types"

export type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"]

export type FoodIconDescriptor = {
  name: MaterialIconName
  category:
    | "drink"
    | "fish"
    | "poultry"
    | "meat"
    | "egg"
    | "fastfood"
    | "sweet"
    | "fruit"
    | "vegetable"
    | "dairy"
    | "bakery"
    | "grain"
    | "nut"
    | "general"
}

const CATEGORY_RULES: {
  category: FoodIconDescriptor["category"]
  icon: MaterialIconName
  keywords: string[]
}[] = [
  // 1. Drinks & Beverages (prioritized so "Orange Juice" or "Apple Cider" -> drink)
  {
    category: "drink",
    icon: "cup-water",
    keywords: [
      "water",
      "viz",
      "asvanyviz",
      "coffee",
      "kave",
      "espresso",
      "latte",
      "cappuccino",
      "tea",
      "chai",
      "juice",
      "gyumolcsle",
      "almale",
      "narancsle",
      "soda",
      "coke",
      "cola",
      "pepsi",
      "sprite",
      "fanta",
      "energy",
      "monster",
      "redbull",
      "beer",
      "sor",
      "wine",
      "bor",
      "drink",
      "ital",
      "smoothie",
      "turmix",
      "shake",
      "protein shake",
      "lemonade",
      "limonade",
      "vodka",
      "whiskey",
      "rum",
      "cocktail",
    ],
  },
  // 2. Fish & Seafood (prioritized so "Tuna salad" -> fish)
  {
    category: "fish",
    icon: "fish",
    keywords: [
      "fish",
      "hal",
      "salmon",
      "lazac",
      "tuna",
      "tonhal",
      "shrimp",
      "rak",
      "garnela",
      "garnele",
      "garnelarak",
      "seafood",
      "pisztrang",
      "hekk",
      "hake",
      "cod",
      "tokehal",
      "tilapia",
      "carp",
      "ponty",
      "harcsa",
      "sushi",
      "szusi",
      "hering",
      "sardine",
      "szardinia",
    ],
  },
  // 3. Poultry / Chicken / Turkey
  {
    category: "poultry",
    icon: "food-drumstick",
    keywords: [
      "chicken",
      "csirke",
      "csirkemell",
      "csirkecomb",
      "turkey",
      "pulyka",
      "pulykamell",
      "duck",
      "kacsa",
      "goose",
      "liba",
      "poultry",
      "szarnyas",
      "drumstick",
      "nugget",
      "wings",
      "szarny",
    ],
  },
  // 4. Meat / Beef / Pork / Ham / Sausage
  {
    category: "meat",
    icon: "food-steak",
    keywords: [
      "beef",
      "marha",
      "marhahus",
      "pork",
      "sertes",
      "steak",
      "meat",
      "hus",
      "bacon",
      "szalonna",
      "ham",
      "sonka",
      "sausage",
      "kolbasz",
      "virsli",
      "parizer",
      "salami",
      "szalami",
      "porkolt",
      "goulash",
      "gulyas",
      "lamb",
      "barany",
      "borju",
      "veal",
      "fasirt",
      "meatball",
      "patty",
    ],
  },
  // 5. Eggs
  {
    category: "egg",
    icon: "egg",
    keywords: ["egg", "tojas", "omelet", "omlett", "scrambled", "rantotta", "tukortojas"],
  },
  // 6. Fast Food / Pizza / Burgers
  {
    category: "fastfood",
    icon: "pizza",
    keywords: [
      "pizza",
      "burger",
      "hamburger",
      "cheeseburger",
      "fries",
      "hasabburgonya",
      "sandwich",
      "szendvics",
      "taco",
      "burrito",
      "kebab",
      "gyros",
      "hot dog",
      "hotdog",
    ],
  },
  // 7. Sweets, Desserts & Chocolate
  {
    category: "sweet",
    icon: "cookie",
    keywords: [
      "chocolate",
      "csoki",
      "csokolade",
      "etcsokolade",
      "tejcsokolade",
      "cookie",
      "keksz",
      "cake",
      "torta",
      "suti",
      "sutemeny",
      "candy",
      "cukor",
      "cukorka",
      "ice cream",
      "fagylalt",
      "fagyi",
      "gelato",
      "dessert",
      "desszert",
      "pudding",
      "puding",
      "waffle",
      "gofri",
      "pancake",
      "palacsinta",
      "chips",
      "snack",
      "popcorn",
      "doughnut",
      "fank",
    ],
  },
  // 8. Bakery & Bread
  {
    category: "bakery",
    icon: "bread-slice",
    keywords: [
      "bread",
      "kenyer",
      "toast",
      "piritos",
      "baguette",
      "croissant",
      "brioche",
      "roll",
      "zsemle",
      "kifli",
      "pekaru",
      "bakery",
      "brot",
      "tortilla",
      "wrap",
      "pita",
      "bagel",
      "muffin",
      "bun",
    ],
  },
  // 9. Fruits
  {
    category: "fruit",
    icon: "food-apple",
    keywords: [
      "apple",
      "alma",
      "banana",
      "banan",
      "orange",
      "narancs",
      "berry",
      "eper",
      "strawberry",
      "blueberry",
      "afonya",
      "raspberry",
      "malna",
      "grape",
      "szolo",
      "peach",
      "barack",
      "oszibarack",
      "sargabarack",
      "lemon",
      "citrom",
      "lime",
      "watermelon",
      "dinnye",
      "gorogdinnye",
      "sargadinnye",
      "melon",
      "mango",
      "pineapple",
      "ananasz",
      "cherry",
      "cseresznye",
      "meggy",
      "plum",
      "szilva",
      "pear",
      "korte",
      "kiwi",
      "kivi",
      "avocado",
      "avokado",
      "fruit",
      "gyumolcs",
    ],
  },
  // 10. Vegetables & Greens
  {
    category: "vegetable",
    icon: "carrot",
    keywords: [
      "salad",
      "salata",
      "tomato",
      "paradicsom",
      "cucumber",
      "uborka",
      "potato",
      "burgonya",
      "krumpli",
      "onion",
      "hagyma",
      "voroshagyma",
      "lilahagyma",
      "fokhagyma",
      "garlic",
      "carrot",
      "repa",
      "sargarepa",
      "broccoli",
      "brokkoli",
      "spinach",
      "spenot",
      "pepper",
      "paprika",
      "kaliforniai",
      "cabbage",
      "kaposzta",
      "zucchini",
      "cukkini",
      "eggplant",
      "padlizsan",
      "mushroom",
      "gomba",
      "cauliflower",
      "karfiol",
      "corn",
      "kukorica",
      "pea",
      "borso",
      "bean",
      "bab",
      "zoldseg",
      "vegetable",
      "lettuce",
      "rucola",
      "rukkola",
    ],
  },
  // 11. Dairy & Cheeses
  {
    category: "dairy",
    icon: "cheese",
    keywords: [
      "milk",
      "tej",
      "cheese",
      "sajt",
      "cheddar",
      "mozzarella",
      "parmesan",
      "parmezan",
      "trappista",
      "gouda",
      "yogurt",
      "joghurt",
      "kefir",
      "turo",
      "cottage",
      "butter",
      "vaj",
      "cream",
      "tejszin",
      "sour cream",
      "tejfol",
      "quark",
      "skyr",
    ],
  },
  // 12. Grains, Pasta, Rice, Oats
  {
    category: "grain",
    icon: "pasta",
    keywords: [
      "rice",
      "rizs",
      "pasta",
      "teszta",
      "spaghetti",
      "spagetti",
      "penne",
      "macaroni",
      "makaroni",
      "lasagna",
      "oat",
      "zab",
      "zabpehely",
      "oatmeal",
      "kasa",
      "cereal",
      "muzli",
      "granola",
      "noodle",
      "nudli",
      "soup",
      "leves",
      "ramen",
      "couscous",
      "bulgur",
      "quinoa",
    ],
  },
  // 13. Nuts & Seeds
  {
    category: "nut",
    icon: "peanut",
    keywords: [
      "nut",
      "dio",
      "mogyoro",
      "foldimogyoro",
      "peanut",
      "almond",
      "mandula",
      "walnut",
      "cashew",
      "kesudio",
      "pistachio",
      "pisztacia",
      "seed",
      "mag",
      "napraforgo",
      "tokmag",
      "chia",
      "lenmag",
    ],
  },
]

function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
}

export function getFoodIconDescriptor(
  foodName: string,
  nutrients?: FoodNutrients,
): FoodIconDescriptor {
  const norm = normalizeName(foodName)
  const tokens = norm.split(/\s+/).filter(Boolean)

  // 1. Direct word or substring match with priority order
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      const normKw = normalizeName(kw)
      // Check multi-word phrase matching
      if (normKw.includes(" ")) {
        if (norm.includes(normKw)) {
          return { name: rule.icon, category: rule.category }
        }
      } else if (normKw.length <= 3) {
        // Short words: match exact token or compound prefixes/suffixes (e.g. dio -> diobel, rak -> garnelarak)
        if (
          tokens.some(
            (t) => t === normKw || (t.length <= 8 && (t.startsWith(normKw) || t.endsWith(normKw))),
          )
        ) {
          return { name: rule.icon, category: rule.category }
        }
      } else {
        // Longer words can match exact token, prefix, or compound inclusion
        if (tokens.some((t) => t === normKw || t.startsWith(normKw) || t.includes(normKw))) {
          return { name: rule.icon, category: rule.category }
        }
      }
    }
  }

  // 2. Fallback heuristic based on macronutrient profile if available
  if (nutrients && nutrients.kcal > 0) {
    const pKcal = nutrients.protein * 4
    const cKcal = nutrients.carbs * 4
    const fKcal = nutrients.fat * 9
    const totalMacKcal = pKcal + cKcal + fKcal

    if (totalMacKcal > 0) {
      const pRatio = pKcal / totalMacKcal
      const fRatio = fKcal / totalMacKcal
      const cRatio = cKcal / totalMacKcal

      if (pRatio >= 0.45) {
        return { name: "food-steak", category: "meat" }
      }
      if (fRatio >= 0.6) {
        return { name: "cheese", category: "dairy" }
      }
      if (cRatio >= 0.7) {
        return { name: "pasta", category: "grain" }
      }
    }
  }

  // 3. Default fallback
  return { name: "silverware-fork-knife", category: "general" }
}

export function getFoodIcon(foodName: string, nutrients?: FoodNutrients): MaterialIconName {
  return getFoodIconDescriptor(foodName, nutrients).name
}
