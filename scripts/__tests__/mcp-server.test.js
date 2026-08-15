"use strict"

const { createSnapshotStore, handleJsonRpc, handleSnapshot } = require("../mcp-server.cjs")

function send(store, method, params, id = 1) {
  return handleJsonRpc(store, { jsonrpc: "2.0", id, method, params })
}

describe("MCP server: JSON-RPC", () => {
  let store

  beforeEach(() => {
    store = createSnapshotStore()
  })

  it("handles initialize with capabilities and server info", () => {
    const response = send(store, "initialize", { protocolVersion: "2025-06-18" })
    expect(response.id).toBe(1)
    expect(response.result.protocolVersion).toBe("2025-06-18")
    expect(response.result.capabilities.tools).toEqual({ listChanged: false })
    expect(response.result.serverInfo.name).toBe("dietinator")
    expect(response.result.instructions).toContain("Dietinator")
  })

  it("falls back to the latest protocol version for unknown ones", () => {
    const response = send(store, "initialize", { protocolVersion: "2025-01-01" })
    expect(response.result.protocolVersion).toBe("2025-06-18")
  })

  it("answers ping and tools/list", () => {
    expect(send(store, "ping", {}).result).toEqual({})
    const tools = send(store, "tools/list", {}).result.tools
    expect(tools.map((t) => t.name)).toEqual([
      "get_diary",
      "get_diary_stats",
      "log_food",
      "update_food_entry",
      "delete_food_entry",
      "get_water",
      "log_water",
      "delete_water",
      "get_weight",
      "log_weight",
      "delete_weight",
      "get_meals",
      "log_meal",
      "save_meal",
      "delete_meal",
      "get_favorite_foods",
      "toggle_favorite",
      "get_goals",
      "set_goals",
      "get_settings",
      "set_units",
      "set_profile",
      "get_health_summary",
    ])
    expect(tools[0].annotations.readOnlyHint).toBe(true)
    expect(tools[2].annotations.destructiveHint).toBe(true)
  })

  it("returns null for notifications (HTTP 202 path)", () => {
    const response = handleJsonRpc(store, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    })
    expect(response).toBeNull()
  })

  it("returns -32601 for unknown methods and -32600 for invalid requests", () => {
    expect(send(store, "bogus", {}).error.code).toBe(-32601)
    const bad = handleJsonRpc(store, { hello: 1 })
    expect(bad.error.code).toBe(-32600)
  })
})

describe("MCP server: snapshot bridge", () => {
  let store

  beforeEach(() => {
    store = createSnapshotStore()
  })

  const snapshot = () => {
    // Derived from "now" so per-day stats tests hold on any real-world date.
    const today = new Date().toISOString().slice(0, 10)
    return {
      updated_at: "2026-08-08T10:00:00.000Z",
      settings: {
        calorie_goal: 2000,
        protein_goal: 150,
        carbs_goal: 200,
        fat_goal: 65,
        water_goal_ml: 2500,
        height_cm: 180,
        target_weight_kg: 75,
        units: "metric",
        yazio_sync_enabled: 0,
      },
      diary: [
        {
          id: "e1",
          date: today,
          meal_type: "lunch",
          food_name: "Rice",
          amount: 1,
          unit: "serving",
          kcal: 200,
          protein: 4,
          carbs: 45,
          fat: 0.5,
          created_at: "2026-08-08T12:00:00.000Z",
        },
      ],
      water: [
        {
          id: "w1",
          date: today,
          amount_ml: 500,
          created_at: "2026-08-08T10:00:00.000Z",
        },
      ],
      weight: [
        {
          id: "wt1",
          date: today,
          weight_kg: 75.0,
          note: "Morning",
          created_at: "2026-08-08T07:00:00.000Z",
        },
      ],
      favorites: [
        {
          product_id: "p1",
          name: "Chicken breast",
          nutrients: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
          base_unit: "g",
        },
      ],
      meals: [
        {
          id: "meal-1",
          name: "Cornflakes with milk",
          kcal: 150,
          protein: 3,
          carbs: 33,
          fat: 0.5,
          items_count: 1,
          items: [{ name: "Cornflakes", amount: 40, kcal: 150 }],
        },
      ],
    }
  }

  it("accepts a valid snapshot and rejects malformed ones", () => {
    expect(handleSnapshot(store, snapshot()).ok).toBe(true)
    expect(handleSnapshot(store, { settings: {}, diary: "nope" }).ok).toBe(false)
    expect(handleSnapshot(store, null).ok).toBe(false)
    expect(handleSnapshot(store, { diary: [] }).ok).toBe(false)
  })

  it("get_diary returns the snapshot with rounded totals", () => {
    handleSnapshot(store, snapshot())
    const result = send(store, "tools/call", { name: "get_diary", arguments: {} }).result
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0].text)
    expect(data.success).toBe(true)
    expect(data.entries).toHaveLength(1)
    expect(data.totals).toEqual({ kcal: 200, protein: 4, carbs: 45, fat: 0.5 })
    expect(data.goals.calorie_goal).toBe(2000)
  })

  it("get_diary filters by date and reports no-snapshot as an error", () => {
    const before = send(store, "tools/call", { name: "get_diary" }).result
    expect(before.isError).toBe(true)
    expect(before.content[0].text).toContain("No diary snapshot yet")

    handleSnapshot(store, snapshot())
    const filtered = send(store, "tools/call", {
      name: "get_diary",
      arguments: { date: "1999-01-01" },
    }).result
    const data = JSON.parse(filtered.content[0].text)
    expect(data.entries).toHaveLength(0)
    expect(data.totals.kcal).toBe(0)
  })

  it("get_goals reads from the snapshot", () => {
    handleSnapshot(store, snapshot())
    const data = JSON.parse(send(store, "tools/call", { name: "get_goals" }).result.content[0].text)
    expect(data.protein_goal).toBe(150)
    expect(data.water_goal_ml).toBe(2500)
    expect(data.height_cm).toBe(180)
  })

  it("log_food appends a change and validates input", () => {
    handleSnapshot(store, snapshot())
    const result = send(store, "tools/call", {
      name: "log_food",
      arguments: { name: "Oats", kcal: 250, meal_type: "breakfast", date: "2026-08-09" },
    }).result
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0].text)
    expect(data.entry.meal_type).toBe("breakfast")
    expect(data.entry.date).toBe("2026-08-09")
    expect(data.change_seq).toBe(1)

    const bad = send(store, "tools/call", {
      name: "log_food",
      arguments: { name: "", kcal: 10 },
    }).result
    expect(bad.isError).toBe(true)

    const zero = send(store, "tools/call", {
      name: "log_food",
      arguments: { name: "X", kcal: 0 },
    }).result
    expect(zero.isError).toBe(true)
  })

  it("delete_food_entry requires the id to exist in the snapshot", () => {
    handleSnapshot(store, snapshot())
    const ok = send(store, "tools/call", {
      name: "delete_food_entry",
      arguments: { entry_id: "e1" },
    }).result
    expect(ok.isError).toBeFalsy()
    expect(JSON.parse(ok.content[0].text).deleted.id).toBe("e1")

    const missing = send(store, "tools/call", {
      name: "delete_food_entry",
      arguments: { entry_id: "nope" },
    }).result
    expect(missing.isError).toBe(true)
  })

  it("set_goals validates values and stores a change", () => {
    handleSnapshot(store, snapshot())
    const ok = send(store, "tools/call", {
      name: "set_goals",
      arguments: { calorie_goal: 1800, water_goal_ml: 3000 },
    }).result
    expect(ok.isError).toBeFalsy()
    expect(JSON.parse(ok.content[0].text).calorie_goal).toBe(1800)
    expect(JSON.parse(ok.content[0].text).water_goal_ml).toBe(3000)

    const empty = send(store, "tools/call", { name: "set_goals", arguments: {} }).result
    expect(empty.isError).toBe(true)

    const negative = send(store, "tools/call", {
      name: "set_goals",
      arguments: { fat_goal: -3 },
    }).result
    expect(negative.isError).toBe(true)
  })

  it("water tools: get_water, log_water, delete_water", () => {
    handleSnapshot(store, snapshot())
    const water = JSON.parse(
      send(store, "tools/call", { name: "get_water", arguments: {} }).result.content[0].text,
    )
    expect(water.success).toBe(true)
    expect(water.total_ml).toBe(500)
    expect(water.progress_percent).toBe(20)

    const logged = send(store, "tools/call", {
      name: "log_water",
      arguments: { amount_ml: 250 },
    }).result
    expect(logged.isError).toBeFalsy()
    const logData = JSON.parse(logged.content[0].text)
    expect(logData.entry.amount_ml).toBe(250)

    const deleted = send(store, "tools/call", {
      name: "delete_water",
      arguments: { entry_id: "w1" },
    }).result
    expect(deleted.isError).toBeFalsy()
  })

  it("weight tools: get_weight, log_weight, delete_weight", () => {
    handleSnapshot(store, snapshot())
    const weight = JSON.parse(
      send(store, "tools/call", { name: "get_weight", arguments: {} }).result.content[0].text,
    )
    expect(weight.success).toBe(true)
    expect(weight.latest_weight.weight_kg).toBe(75.0)
    expect(weight.latest_weight.bmi).toBe(23.1)

    const logged = send(store, "tools/call", {
      name: "log_weight",
      arguments: { weight_kg: 74.8, note: "Post-workout" },
    }).result
    expect(logged.isError).toBeFalsy()
    const loggedData = JSON.parse(logged.content[0].text)

    const deleted = send(store, "tools/call", {
      name: "delete_weight",
      arguments: { entry_id: loggedData.entry.id },
    }).result
    expect(deleted.isError).toBeFalsy()
  })

  it("saved meal tools: get_meals, save_meal, delete_meal, log_meal", () => {
    handleSnapshot(store, snapshot())
    const meals = JSON.parse(
      send(store, "tools/call", { name: "get_meals", arguments: {} }).result.content[0].text,
    )
    expect(meals.meals).toHaveLength(1)
    expect(meals.meals[0].name).toBe("Cornflakes with milk")

    const saved = send(store, "tools/call", {
      name: "save_meal",
      arguments: {
        name: "Yogurt bowl",
        items: [{ name: "Greek yogurt", amount: 200, kcal: 120 }],
      },
    }).result
    expect(saved.isError).toBeFalsy()

    const deleted = send(store, "tools/call", {
      name: "delete_meal",
      arguments: { meal_id: "meal-1" },
    }).result
    expect(deleted.isError).toBeFalsy()
  })

  it("favorites tools: get_favorite_foods, toggle_favorite", () => {
    handleSnapshot(store, snapshot())
    const favs = JSON.parse(
      send(store, "tools/call", { name: "get_favorite_foods", arguments: {} }).result.content[0]
        .text,
    )
    expect(favs.foods).toHaveLength(1)

    const toggled = send(store, "tools/call", {
      name: "toggle_favorite",
      arguments: { product_id: "p1" },
    }).result
    expect(toggled.isError).toBeFalsy()
  })

  it("profile and health summary tools", () => {
    handleSnapshot(store, snapshot())
    const profile = send(store, "tools/call", {
      name: "set_profile",
      arguments: { height_cm: 185, target_weight_kg: 72 },
    }).result
    expect(profile.isError).toBeFalsy()

    const health = JSON.parse(
      send(store, "tools/call", { name: "get_health_summary", arguments: { days: 7 } }).result
        .content[0].text,
    )
    expect(health.success).toBe(true)
    expect(health.period_days).toBe(7)
    expect(health.averages.kcal).toBe(200)
    expect(health.averages.water_ml).toBe(500)
  })

  it("unknown tools return an error result", () => {
    const result = send(store, "tools/call", { name: "nope" }).result
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("not available")
  })
})
