"use strict"

const {
  createSnapshotStore,
  handleJsonRpc,
  handleSnapshot,
  handleChanges,
  listTools,
} = require("../mcp-server.cjs")

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
      "get_goals",
      "get_diary_stats",
      "get_settings",
      "set_units",
      "log_food",
      "update_food_entry",
      "delete_food_entry",
      "set_goals",
      "get_meals",
      "log_meal",
    ])
    expect(tools[0].annotations.readOnlyHint).toBe(true)
    expect(tools[5].annotations.destructiveHint).toBe(true)
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

  const snapshot = () => ({
    updated_at: "2026-08-08T10:00:00.000Z",
    settings: {
      calorie_goal: 2000,
      protein_goal: 150,
      carbs_goal: 200,
      fat_goal: 65,
      units: "metric",
      yazio_sync_enabled: 0,
    },
    diary: [
      {
        id: "e1",
        date: "2026-08-08",
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
    meals: [
      {
        id: "meal-1",
        name: "Cornflakes with milk",
        kcal: 150,
        protein: 3,
        carbs: 33,
        fat: 0.5,
        items_count: 1,
      },
    ],
  })

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
      arguments: { calorie_goal: 1800 },
    }).result
    expect(ok.isError).toBeFalsy()
    expect(JSON.parse(ok.content[0].text).calorie_goal).toBe(1800)

    const empty = send(store, "tools/call", { name: "set_goals", arguments: {} }).result
    expect(empty.isError).toBe(true)

    const negative = send(store, "tools/call", {
      name: "set_goals",
      arguments: { fat_goal: -3 },
    }).result
    expect(negative.isError).toBe(true)
  })

  it("unknown tools return an error result", () => {
    const result = send(store, "tools/call", { name: "nope" }).result
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("not available")
  })

  it("handleChanges returns only changes newer than `since` with the revision", () => {
    handleSnapshot(store, snapshot())
    send(store, "tools/call", { name: "log_food", arguments: { name: "A", kcal: 100 } })
    send(store, "tools/call", { name: "set_goals", arguments: { protein_goal: 140 } })

    const feed = handleChanges(store, 0)
    expect(feed.changes).toHaveLength(2)
    expect(feed.revision).toBe(2)
    expect(feed.changes[0]).toMatchObject({ op: "log_food", payload: { food_name: "A" } })
    expect(feed.changes[1]).toMatchObject({ op: "set_goals", payload: { protein_goal: 140 } })

    const later = handleChanges(store, 1)
    expect(later.changes).toHaveLength(1)
    expect(later.changes[0].seq).toBe(2)
  })

  it("mirrors write changes into the snapshot for multi-step flows", () => {
    handleSnapshot(store, snapshot())
    send(store, "tools/call", {
      name: "log_food",
      arguments: { name: "Protein bar", kcal: 300, meal_type: "snack" },
    })
    const loggedId = store.changes[store.changes.length - 1].payload.id
    expect(store.snapshot.diary.some((e) => e.id === loggedId)).toBe(true)

    // update then delete the fresh entry — both must succeed against the snapshot
    const updated = send(store, "tools/call", {
      name: "update_food_entry",
      arguments: { entry_id: loggedId, amount: 2 },
    }).result
    expect(updated.isError).toBeFalsy()
    expect(store.snapshot.diary.find((e) => e.id === loggedId).amount).toBe(2)

    const deleted = send(store, "tools/call", {
      name: "delete_food_entry",
      arguments: { entry_id: loggedId },
    }).result
    expect(deleted.isError).toBeFalsy()
    expect(store.snapshot.diary.some((e) => e.id === loggedId)).toBe(false)
  })

  it("set_goals and set_units update the snapshot settings", () => {
    handleSnapshot(store, snapshot())
    send(store, "tools/call", {
      name: "set_goals",
      arguments: { protein_goal: 160 },
    })
    send(store, "tools/call", { name: "set_units", arguments: { units: "imperial" } })
    expect(store.snapshot.settings.protein_goal).toBe(160)
    expect(store.snapshot.settings.units).toBe("imperial")
  })

  it("listTools exposes valid JSON schemas", () => {
    for (const tool of listTools()) {
      expect(tool.inputSchema.type).toBe("object")
      expect(tool.inputSchema.properties).toBeDefined()
    }
  })

  it("get_diary_stats computes per-day totals from the snapshot", () => {
    handleSnapshot(store, snapshot())
    const result = send(store, "tools/call", {
      name: "get_diary_stats",
      arguments: { days: 3 },
    }).result
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0].text)
    expect(data.days_count).toBe(3)
    expect(data.days_logged).toBe(1)
    const today = data.days[data.days.length - 1]
    expect(today.kcal).toBe(200)
  })

  it("get_settings reads snapshot settings", () => {
    handleSnapshot(store, snapshot())
    const data = JSON.parse(
      send(store, "tools/call", { name: "get_settings" }).result.content[0].text,
    )
    expect(data.success).toBe(true)
    expect(data.units).toBe("metric")
    expect(data.yazio_sync_enabled).toBe(false)
  })

  it("set_units validates and enqueues a change", () => {
    handleSnapshot(store, snapshot())
    const ok = send(store, "tools/call", {
      name: "set_units",
      arguments: { units: "imperial" },
    }).result
    expect(ok.isError).toBeFalsy()
    expect(JSON.parse(ok.content[0].text).units).toBe("imperial")

    const bad = send(store, "tools/call", {
      name: "set_units",
      arguments: { units: "parsecs" },
    }).result
    expect(bad.isError).toBe(true)
  })

  it("update_food_entry requires a snapshot match and enqueues a change", () => {
    handleSnapshot(store, snapshot())
    const ok = send(store, "tools/call", {
      name: "update_food_entry",
      arguments: { entry_id: "e1", amount: 2, meal_type: "dinner" },
    }).result
    expect(ok.isError).toBeFalsy()
    expect(JSON.parse(ok.content[0].text)).toMatchObject({
      id: "e1",
      amount: 2,
      meal_type: "dinner",
    })

    const missing = send(store, "tools/call", {
      name: "update_food_entry",
      arguments: { entry_id: "nope", amount: 2 },
    }).result
    expect(missing.isError).toBe(true)

    const zero = send(store, "tools/call", {
      name: "update_food_entry",
      arguments: { entry_id: "e1", amount: 0 },
    }).result
    expect(zero.isError).toBe(true)
  })

  it("get_meals lists snapshot meals and log_meal enqueues a change", () => {
    handleSnapshot(store, snapshot())
    const meals = JSON.parse(
      send(store, "tools/call", { name: "get_meals" }).result.content[0].text,
    )
    expect(meals.meals).toHaveLength(1)
    expect(meals.meals[0].name).toBe("Cornflakes with milk")

    const ok = send(store, "tools/call", {
      name: "log_meal",
      arguments: { meal_id: "meal-1", date: "2026-08-09", meal_type: "breakfast" },
    }).result
    expect(ok.isError).toBeFalsy()
    const change = JSON.parse(ok.content[0].text)
    expect(change.meal_type).toBe("breakfast")

    const unknown = send(store, "tools/call", {
      name: "log_meal",
      arguments: { meal_id: "nope" },
    }).result
    expect(unknown.isError).toBe(true)

    const feed = handleChanges(store, 0)
    const logMealChange = feed.changes.find((c) => c.op === "log_meal")
    expect(logMealChange.payload).toMatchObject({
      meal_id: "meal-1",
      date: "2026-08-09",
      meal_type: "breakfast",
    })
  })
})
