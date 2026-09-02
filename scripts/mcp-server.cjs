"use strict"

/**
 * Dietinator MCP server + agent bridge (shared by Metro dev middleware and
 * scripts/serve-dist.mjs).
 *
 * The web app is local-first: diary data lives in the browser (OPFS SQLite).
 * A Node process cannot reach it, so the app *pushes* a snapshot of the
 * last 14 days + goals + water + weight + meals + favorites to this server (`POST /api/agent/snapshot`),
 * and this server exposes tools to external AI agents over the Model Context
 * Protocol at `/mcp` (Streamable HTTP, stateless JSON-RPC):
 *
 *   - Diary: get_diary, get_diary_stats, log_food, update_food_entry, delete_food_entry
 *   - Water: get_water, log_water, delete_water
 *   - Weight: get_weight, log_weight, delete_weight
 *   - Meals: get_meals, log_meal, save_meal, delete_meal
 *   - Favorites & Recents: get_favorite_foods, toggle_favorite, get_recent_foods
 *   - Goals & Profile: get_goals, set_goals, get_settings, set_units, set_profile
 *   - Analytics: get_health_summary
 *
 * Agent-made changes are stored in memory as an append-only change log; the
 * web app pulls them back with `GET /api/agent/changes?since=<rev>` and
 * applies them to SQLite. Nothing is ever persisted server-side.
 *
 * Security: `/mcp` requires an API key (MCP_API_KEY env, or unconditionally
 * when NODE_ENV=production) via X-Api-Key or Authorization: Bearer.
 * `/api/agent/*` is same-origin only.
 */

const crypto = require("node:crypto")

const SERVER_NAME = "dietinator"
const SERVER_VERSION = "1.0.0"
const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2025-06-18", "2025-03-26", "2024-11-05"])
const DEFAULT_PROTOCOL_VERSION = "2025-06-18"
const MAX_CHANGES = 500
const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"])

const INSTRUCTIONS =
  "You are the agent interface for Dietinator, a local-first calorie, macro, water, and weight tracker. " +
  "Read the app snapshot (get_diary, get_water, get_weight, get_meals, get_favorite_foods, get_goals, get_health_summary) " +
  "and make changes (log_food, log_water, log_weight, log_meal, save_meal, delete_food_entry, set_goals, set_profile). " +
  "Changes are applied back to the user's device the next time the app synchronizes. " +
  "Tools that modify data should only be used when the user asked for it."

// Snapshot store

function createSnapshotStore() {
  return {
    snapshot: null, // { settings, diary: [], water: [], weight: [], meals: [], favorites: [], updated_at, revision }
    changes: [], // { seq, op, payload, at }
    nextSeq: 1,
  }
}

function appendChange(store, op, payload) {
  const change = { seq: store.nextSeq++, op, payload, at: new Date().toISOString() }
  store.changes.push(change)
  if (store.changes.length > MAX_CHANGES) {
    store.changes.splice(0, store.changes.length - MAX_CHANGES)
  }
  // Mirror the change into the in-memory snapshot so multi-step agent flows
  // see their own writes on subsequent tool calls.
  applyChangeToSnapshot(store, op, payload)
  return change
}

function applyChangeToSnapshot(store, op, payload) {
  if (!store.snapshot) return
  switch (op) {
    case "log_food":
      if (!Array.isArray(store.snapshot.diary)) store.snapshot.diary = []
      store.snapshot.diary.push(payload)
      break
    case "update_food_entry": {
      if (Array.isArray(store.snapshot.diary)) {
        const entry = store.snapshot.diary.find((e) => e.id === payload.id)
        if (entry) {
          entry.amount = payload.amount
          if (payload.meal_type !== undefined) entry.meal_type = payload.meal_type
        }
      }
      break
    }
    case "delete_entry":
      if (Array.isArray(store.snapshot.diary)) {
        store.snapshot.diary = store.snapshot.diary.filter((e) => e.id !== payload.id)
      }
      break
    case "set_goals":
      if (!store.snapshot.settings) store.snapshot.settings = {}
      for (const [key, value] of Object.entries(payload)) {
        if (key !== "change_seq") store.snapshot.settings[key] = value
      }
      break
    case "set_units":
      if (!store.snapshot.settings) store.snapshot.settings = {}
      store.snapshot.settings.units = payload.units
      break
    case "set_profile":
      if (!store.snapshot.settings) store.snapshot.settings = {}
      for (const [key, value] of Object.entries(payload)) {
        if (key !== "change_seq") store.snapshot.settings[key] = value
      }
      break
    case "log_water":
      if (!Array.isArray(store.snapshot.water)) store.snapshot.water = []
      store.snapshot.water.push(payload)
      break
    case "delete_water":
      if (Array.isArray(store.snapshot.water)) {
        store.snapshot.water = store.snapshot.water.filter((w) => w.id !== payload.id)
      }
      break
    case "log_weight":
      if (!Array.isArray(store.snapshot.weight)) store.snapshot.weight = []
      {
        const idx = store.snapshot.weight.findIndex((w) => w.date === payload.date)
        if (idx >= 0) {
          store.snapshot.weight[idx] = payload
        } else {
          store.snapshot.weight.unshift(payload)
        }
      }
      break
    case "delete_weight":
      if (Array.isArray(store.snapshot.weight)) {
        store.snapshot.weight = store.snapshot.weight.filter((w) => w.id !== payload.id)
      }
      break
    case "save_meal":
      if (!Array.isArray(store.snapshot.meals)) store.snapshot.meals = []
      {
        const idx = store.snapshot.meals.findIndex((m) => m.id === payload.id)
        if (idx >= 0) {
          store.snapshot.meals[idx] = payload
        } else {
          store.snapshot.meals.unshift(payload)
        }
      }
      break
    case "delete_meal":
      if (Array.isArray(store.snapshot.meals)) {
        store.snapshot.meals = store.snapshot.meals.filter((m) => m.id !== payload.id)
      }
      break
    case "toggle_favorite":
      if (!Array.isArray(store.snapshot.favorites)) store.snapshot.favorites = []
      {
        const idx = store.snapshot.favorites.findIndex((f) => f.product_id === payload.product_id)
        if (idx >= 0) {
          store.snapshot.favorites.splice(idx, 1)
        } else {
          store.snapshot.favorites.push({
            product_id: payload.product_id,
            name: payload.name || payload.product_id,
            nutrients: payload.nutrients || { kcal: 0, protein: 0, carbs: 0, fat: 0 },
            base_unit: payload.base_unit || "g",
          })
        }
      }
      break
    default:
      break
  }
}

function snapshotRevision(store) {
  return store.nextSeq - 1
}

// Agent bridge handlers

function handleSnapshot(store, body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." }
  }
  if (!body.settings || typeof body.settings !== "object") {
    return { ok: false, error: "Missing 'settings' object." }
  }
  if (!Array.isArray(body.diary)) {
    return { ok: false, error: "Missing 'diary' array." }
  }
  store.snapshot = {
    settings: body.settings,
    diary: body.diary,
    water: Array.isArray(body.water) ? body.water : [],
    weight: Array.isArray(body.weight) ? body.weight : [],
    meals: Array.isArray(body.meals) ? body.meals : [],
    favorites: Array.isArray(body.favorites) ? body.favorites : [],
    updated_at: typeof body.updated_at === "string" ? body.updated_at : new Date().toISOString(),
  }
  return { ok: true }
}

function handleChanges(store, since) {
  const parsed = Number(since)
  const from = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  const changes = store.changes.filter((change) => change.seq > from)
  return { changes, revision: snapshotRevision(store) }
}

// Helpers

function toDiaryRow(entry) {
  return {
    id: entry.id,
    date: entry.date,
    meal_type: entry.meal_type,
    food_name: entry.food_name,
    amount: entry.amount,
    unit: entry.unit,
    kcal: Math.round(entry.kcal),
    protein: Math.round(entry.protein * 10) / 10,
    carbs: Math.round(entry.carbs * 10) / 10,
    fat: Math.round(entry.fat * 10) / 10,
  }
}

function snapshotSummary(snapshot) {
  const entries = (snapshot.diary || []).map(toDiaryRow)
  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
  return {
    entries,
    totals: {
      kcal: Math.round(totals.kcal),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
    },
  }
}

function noSnapshotResult() {
  return {
    success: false,
    error:
      "No diary snapshot yet. Open Dietinator in a browser served by this host so it can share its diary (the app pushes the snapshot automatically).",
  }
}

function toPositiveNumber(value, fallback) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : fallback
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

// MCP tools

const TOOLS = [
  // 1. Diary
  {
    name: "get_diary",
    description:
      "Returns diary entries and calorie/macro totals for a date (YYYY-MM-DD). Omit date for the whole snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Optional date as YYYY-MM-DD." },
      },
    },
    annotations: { readOnlyHint: true },
    execute(store, args) {
      if (!store.snapshot) return noSnapshotResult()
      const summary = snapshotSummary(store.snapshot)
      const requestedDate = typeof args.date === "string" && args.date ? args.date : null
      const entries = requestedDate
        ? summary.entries.filter((e) => e.date === requestedDate)
        : summary.entries
      const totals = entries.reduce(
        (acc, e) => ({
          kcal: acc.kcal + e.kcal,
          protein: acc.protein + e.protein,
          carbs: acc.carbs + e.carbs,
          fat: acc.fat + e.fat,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      )
      return {
        success: true,
        date: requestedDate ?? undefined,
        entries,
        totals: {
          kcal: Math.round(totals.kcal),
          protein: Math.round(totals.protein * 10) / 10,
          carbs: Math.round(totals.carbs * 10) / 10,
          fat: Math.round(totals.fat * 10) / 10,
        },
        goals: {
          calorie_goal: store.snapshot.settings.calorie_goal,
          protein_goal: store.snapshot.settings.protein_goal,
          carbs_goal: store.snapshot.settings.carbs_goal,
          fat_goal: store.snapshot.settings.fat_goal,
        },
        snapshot_updated_at: store.snapshot.updated_at,
      }
    },
  },
  {
    name: "get_diary_stats",
    description:
      "Returns per-day calorie and macro totals for the last N days of the snapshot (default 7, max 30), plus how many of those days had entries.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Optional number of days (default 7, max 30)." },
      },
    },
    annotations: { readOnlyHint: true },
    execute(store, args) {
      if (!store.snapshot) return noSnapshotResult()
      const days = Math.min(Math.max(Number(args.days) || 7, 1), 30)
      const today = todayKey()
      const dates = Array.from({ length: days }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (days - 1 - i))
        return d.toISOString().slice(0, 10)
      })
      const byDate = new Map()
      for (const e of store.snapshot.diary || []) {
        if (!byDate.has(e.date)) byDate.set(e.date, [])
        byDate.get(e.date).push(e)
      }
      const rows = dates.map((date) => {
        const entries = byDate.get(date) ?? []
        const totals = entries.reduce(
          (acc, e) => ({
            kcal: acc.kcal + e.kcal,
            protein: acc.protein + e.protein,
            carbs: acc.carbs + e.carbs,
            fat: acc.fat + e.fat,
          }),
          { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        )
        return {
          date,
          kcal: Math.round(totals.kcal),
          protein: Math.round(totals.protein * 10) / 10,
          carbs: Math.round(totals.carbs * 10) / 10,
          fat: Math.round(totals.fat * 10) / 10,
        }
      })
      return {
        success: true,
        days_count: days,
        days_logged: rows.filter((r) => r.kcal > 0).length,
        days: rows,
      }
    },
  },
  {
    name: "log_food",
    description:
      "Logs a manual food entry into the diary for a date (YYYY-MM-DD, defaults to today). Nutrients are per serving; amount is always 1 serving. The entry lands on the user's device the next time the app syncs.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Optional date as YYYY-MM-DD. Defaults to today." },
        meal_type: {
          type: "string",
          description: "One of breakfast, lunch, dinner, snack. Defaults to snack.",
        },
        name: { type: "string", description: "Food name, for example 'Chicken breast, grilled'." },
        kcal: { type: "number", description: "Calories for one serving." },
        protein: { type: "number", description: "Protein in grams for one serving." },
        carbs: { type: "number", description: "Carbs in grams for one serving." },
        fat: { type: "number", description: "Fat in grams for one serving." },
      },
      required: ["name", "kcal"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const name = typeof args.name === "string" ? args.name.trim() : ""
      if (!name) return { success: false, error: "Provide a food name to log." }
      const kcal = toPositiveNumber(args.kcal, 0)
      if (kcal <= 0) return { success: false, error: "Provide a positive kcal value." }
      const mealType = MEAL_TYPES.has(args.meal_type) ? args.meal_type : "snack"
      const entry = {
        id: crypto.randomUUID(),
        date: typeof args.date === "string" && args.date ? args.date : todayKey(),
        meal_type: mealType,
        food_name: name,
        amount: 1,
        unit: "serving",
        kcal,
        protein: toPositiveNumber(args.protein, 0),
        carbs: toPositiveNumber(args.carbs, 0),
        fat: toPositiveNumber(args.fat, 0),
        created_at: new Date().toISOString(),
      }
      const change = appendChange(store, "log_food", entry)
      return { success: true, entry: toDiaryRow(entry), change_seq: change.seq }
    },
  },
  {
    name: "update_food_entry",
    description:
      "Changes the amount (and optionally the meal slot) of an existing diary entry in the snapshot. Applied to the user's device on the next sync.",
    inputSchema: {
      type: "object",
      properties: {
        entry_id: { type: "string", description: "The diary entry id to update." },
        amount: { type: "number", description: "New amount in the entry's unit." },
        meal_type: {
          type: "string",
          description: "Optional new meal slot: breakfast, lunch, dinner, snack.",
        },
      },
      required: ["entry_id", "amount"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const id = typeof args.entry_id === "string" ? args.entry_id : ""
      const amount = Number(args.amount)
      if (!id) return { success: false, error: "Provide the entry_id to update." }
      if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, error: "Provide a positive amount." }
      }
      if (args.meal_type !== undefined && !MEAL_TYPES.has(args.meal_type)) {
        return { success: false, error: "meal_type must be breakfast, lunch, dinner or snack." }
      }
      if (store.snapshot && !store.snapshot.diary.some((e) => e.id === id)) {
        return { success: false, error: `No diary entry with id '${id}' in the current snapshot.` }
      }
      const payload = { id, amount: Math.round(amount * 100) / 100 }
      if (args.meal_type !== undefined) payload.meal_type = args.meal_type
      const change = appendChange(store, "update_food_entry", payload)
      return { success: true, ...payload, change_seq: change.seq }
    },
  },
  {
    name: "delete_food_entry",
    description:
      "Permanently removes a diary entry. Find the id with get_diary first. Applied to the user's device on the next sync.",
    inputSchema: {
      type: "object",
      properties: { entry_id: { type: "string", description: "The diary entry id to delete." } },
      required: ["entry_id"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const id = typeof args.entry_id === "string" ? args.entry_id : ""
      if (!id) return { success: false, error: "Provide the entry_id to delete." }
      if (store.snapshot && !store.snapshot.diary.some((e) => e.id === id)) {
        return {
          success: false,
          error: `No diary entry with id '${id}' in the current snapshot.`,
        }
      }
      const change = appendChange(store, "delete_entry", { id })
      return { success: true, deleted: { id }, change_seq: change.seq }
    },
  },

  // 2. Water Tracking
  {
    name: "get_water",
    description:
      "Returns water intake entries, daily total in milliliters, hydration goal, and completion percentage for a date (YYYY-MM-DD). Omit date for today.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Optional date as YYYY-MM-DD. Defaults to today." },
      },
    },
    annotations: { readOnlyHint: true },
    execute(store, args) {
      if (!store.snapshot) return noSnapshotResult()
      const requestedDate = typeof args.date === "string" && args.date ? args.date : todayKey()
      const entries = (store.snapshot.water || []).filter((w) => w.date === requestedDate)
      const total = entries.reduce((acc, w) => acc + (Number(w.amount_ml) || 0), 0)
      const goal = store.snapshot.settings?.water_goal_ml || 2500
      const progressPercent = goal > 0 ? Math.min(Math.round((total / goal) * 100), 999) : 0
      return {
        success: true,
        date: requestedDate,
        total_ml: total,
        goal_ml: goal,
        progress_percent: progressPercent,
        entries,
      }
    },
  },
  {
    name: "log_water",
    description:
      "Logs water intake in milliliters (ml) for a date (YYYY-MM-DD, defaults to today). E.g. 250 for a glass, 500 for a bottle.",
    inputSchema: {
      type: "object",
      properties: {
        amount_ml: { type: "number", description: "Amount of water in milliliters." },
        date: { type: "string", description: "Optional date as YYYY-MM-DD. Defaults to today." },
      },
      required: ["amount_ml"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const amount = Number(args.amount_ml)
      if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, error: "Provide a positive amount_ml in milliliters." }
      }
      const entry = {
        id: crypto.randomUUID(),
        date: typeof args.date === "string" && args.date ? args.date : todayKey(),
        amount_ml: Math.round(amount),
        created_at: new Date().toISOString(),
      }
      const change = appendChange(store, "log_water", entry)
      return { success: true, entry, change_seq: change.seq }
    },
  },
  {
    name: "delete_water",
    description: "Deletes a logged water entry by its entry_id.",
    inputSchema: {
      type: "object",
      properties: {
        entry_id: { type: "string", description: "The id of the water log to delete." },
      },
      required: ["entry_id"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const id = typeof args.entry_id === "string" ? args.entry_id : ""
      if (!id) return { success: false, error: "Provide the entry_id to delete." }
      if (
        store.snapshot &&
        store.snapshot.water &&
        !store.snapshot.water.some((w) => w.id === id)
      ) {
        return { success: false, error: `No water entry with id '${id}' in the current snapshot.` }
      }
      const change = appendChange(store, "delete_water", { id })
      return { success: true, deleted: { id }, change_seq: change.seq }
    },
  },

  // 3. Weight Tracking & Body Metrics
  {
    name: "get_weight",
    description:
      "Returns bodyweight entries from the snapshot, latest weight, calculated BMI (if height is set), target weight, and recent delta.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional max number of entries (default 10)." },
      },
    },
    annotations: { readOnlyHint: true },
    execute(store, args) {
      if (!store.snapshot) return noSnapshotResult()
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 30)
      const entries = [...(store.snapshot.weight || [])]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit)
      const latest = entries[0] ?? null
      const heightCm = store.snapshot.settings?.height_cm || 0
      let bmi = null
      if (latest && heightCm > 0) {
        const heightM = heightCm / 100
        bmi = Math.round((latest.weight_kg / (heightM * heightM)) * 10) / 10
      }
      let delta = null
      if (entries.length >= 2) {
        delta = Math.round((entries[0].weight_kg - entries[1].weight_kg) * 100) / 100
      }
      return {
        success: true,
        units: store.snapshot.settings?.units || "metric",
        height_cm: heightCm || undefined,
        target_weight_kg: store.snapshot.settings?.target_weight_kg || undefined,
        latest_weight: latest
          ? {
              date: latest.date,
              weight_kg: latest.weight_kg,
              note: latest.note || undefined,
              bmi: bmi || undefined,
              delta_from_previous_kg: delta || undefined,
            }
          : null,
        entries,
      }
    },
  },
  {
    name: "log_weight",
    description:
      "Logs or updates bodyweight in kilograms (kg) for a date (YYYY-MM-DD, defaults to today) with an optional note.",
    inputSchema: {
      type: "object",
      properties: {
        weight_kg: { type: "number", description: "Bodyweight in kilograms." },
        date: { type: "string", description: "Optional date as YYYY-MM-DD. Defaults to today." },
        note: { type: "string", description: "Optional note (for example 'Morning fasted')." },
      },
      required: ["weight_kg"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const weightKg = Number(args.weight_kg)
      if (!Number.isFinite(weightKg) || weightKg <= 0) {
        return { success: false, error: "Provide a positive weight_kg in kilograms." }
      }
      const entry = {
        id: crypto.randomUUID(),
        date: typeof args.date === "string" && args.date ? args.date : todayKey(),
        weight_kg: Math.round(weightKg * 100) / 100,
        note: typeof args.note === "string" ? args.note.trim() : null,
        created_at: new Date().toISOString(),
      }
      const change = appendChange(store, "log_weight", entry)
      return { success: true, entry, change_seq: change.seq }
    },
  },
  {
    name: "delete_weight",
    description: "Deletes a bodyweight entry by its entry_id.",
    inputSchema: {
      type: "object",
      properties: {
        entry_id: { type: "string", description: "The id of the weight entry to delete." },
      },
      required: ["entry_id"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const id = typeof args.entry_id === "string" ? args.entry_id : ""
      if (!id) return { success: false, error: "Provide the entry_id to delete." }
      if (
        store.snapshot &&
        store.snapshot.weight &&
        !store.snapshot.weight.some((w) => w.id === id)
      ) {
        return { success: false, error: `No weight entry with id '${id}' in the current snapshot.` }
      }
      const change = appendChange(store, "delete_weight", { id })
      return { success: true, deleted: { id }, change_seq: change.seq }
    },
  },

  // 4. Saved Meals
  {
    name: "get_meals",
    description:
      "Lists saved meals from the snapshot (recipes / food combinations you often eat together) with macro totals and itemized ingredients.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute(store) {
      if (!store.snapshot) return noSnapshotResult()
      return { success: true, meals: store.snapshot.meals || [] }
    },
  },
  {
    name: "log_meal",
    description:
      "Logs every item of a saved meal into the diary for a date (YYYY-MM-DD, defaults to today) and meal slot. Find the meal_id with get_meals first. Applied to the user's device on the next sync.",
    inputSchema: {
      type: "object",
      properties: {
        meal_id: { type: "string", description: "The id of the meal to log." },
        date: { type: "string", description: "Optional date as YYYY-MM-DD. Defaults to today." },
        meal_type: {
          type: "string",
          description: "One of breakfast, lunch, dinner, snack. Defaults to snack.",
        },
      },
      required: ["meal_id"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const mealId = typeof args.meal_id === "string" ? args.meal_id : ""
      if (!mealId) return { success: false, error: "Provide the meal_id to log." }
      if (store.snapshot && !store.snapshot.meals.some((m) => m.id === mealId)) {
        return { success: false, error: `No meal with id '${mealId}' in the current snapshot.` }
      }
      const mealType = MEAL_TYPES.has(args.meal_type) ? args.meal_type : "snack"
      const change = appendChange(store, "log_meal", {
        meal_id: mealId,
        date: typeof args.date === "string" && args.date ? args.date : todayKey(),
        meal_type: mealType,
      })
      return { success: true, meal_id: mealId, meal_type: mealType, change_seq: change.seq }
    },
  },
  {
    name: "save_meal",
    description:
      "Creates or updates a saved meal template with a name and a list of food items with amounts and nutrients.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Meal name, for example 'Post-Workout Oatmeal'." },
        items: {
          type: "array",
          description: "List of food items in the meal.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Food name." },
              amount: { type: "number", description: "Amount in base units (grams/ml)." },
              base_unit: { type: "string", description: "Base unit ('g' or 'ml')." },
              kcal: { type: "number", description: "Calories for this item." },
              protein: { type: "number", description: "Protein in grams." },
              carbs: { type: "number", description: "Carbs in grams." },
              fat: { type: "number", description: "Fat in grams." },
            },
            required: ["name", "amount", "kcal"],
          },
        },
        meal_id: { type: "string", description: "Optional meal id to update." },
      },
      required: ["name", "items"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const name = typeof args.name === "string" ? args.name.trim() : ""
      if (!name) return { success: false, error: "Provide a meal name." }
      const rawItems = Array.isArray(args.items) ? args.items : []
      if (rawItems.length === 0) return { success: false, error: "Provide at least one food item." }
      const items = rawItems.map((it) => ({
        product_id:
          typeof it.product_id === "string" && it.product_id ? it.product_id : crypto.randomUUID(),
        name: String(it.name || ""),
        amount: Number(it.amount) || 100,
        base_unit: it.base_unit || "g",
        nutrients: {
          kcal: Number(it.kcal) || 0,
          protein: Number(it.protein) || 0,
          carbs: Number(it.carbs) || 0,
          fat: Number(it.fat) || 0,
        },
      }))
      const totals = items.reduce(
        (acc, it) => ({
          kcal: acc.kcal + it.nutrients.kcal,
          protein: acc.protein + it.nutrients.protein,
          carbs: acc.carbs + it.nutrients.carbs,
          fat: acc.fat + it.nutrients.fat,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      )
      const meal = {
        id: typeof args.meal_id === "string" && args.meal_id ? args.meal_id : crypto.randomUUID(),
        name,
        kcal: Math.round(totals.kcal),
        protein: Math.round(totals.protein * 10) / 10,
        carbs: Math.round(totals.carbs * 10) / 10,
        fat: Math.round(totals.fat * 10) / 10,
        items_count: items.length,
        items,
      }
      const change = appendChange(store, "save_meal", meal)
      return { success: true, meal, change_seq: change.seq }
    },
  },
  {
    name: "delete_meal",
    description: "Permanently deletes a saved meal template by meal_id.",
    inputSchema: {
      type: "object",
      properties: {
        meal_id: { type: "string", description: "The id of the saved meal to delete." },
      },
      required: ["meal_id"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const id = typeof args.meal_id === "string" ? args.meal_id : ""
      if (!id) return { success: false, error: "Provide the meal_id to delete." }
      if (
        store.snapshot &&
        store.snapshot.meals &&
        !store.snapshot.meals.some((m) => m.id === id)
      ) {
        return { success: false, error: `No meal with id '${id}' in the current snapshot.` }
      }
      const change = appendChange(store, "delete_meal", { id })
      return { success: true, deleted: { id }, change_seq: change.seq }
    },
  },

  // 5. Food Database & Favorites
  {
    name: "get_favorite_foods",
    description: "Returns the user's starred / favorited foods with nutrition from the snapshot.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute(store) {
      if (!store.snapshot) return noSnapshotResult()
      return { success: true, foods: store.snapshot.favorites || [] }
    },
  },
  {
    name: "toggle_favorite",
    description: "Stars or unstars a food in the database by its product_id.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Product ID of the food." },
        name: { type: "string", description: "Optional name of the food." },
      },
      required: ["product_id"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const productId = typeof args.product_id === "string" ? args.product_id.trim() : ""
      if (!productId) return { success: false, error: "Provide the product_id of the food." }
      const change = appendChange(store, "toggle_favorite", {
        product_id: productId,
        name: typeof args.name === "string" ? args.name.trim() : undefined,
      })
      return { success: true, product_id: productId, change_seq: change.seq }
    },
  },

  // 6. Goals, Profile & Settings
  {
    name: "get_goals",
    description: "Returns the current daily calorie, macro, and hydration goals from the snapshot.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute(store) {
      if (!store.snapshot) return noSnapshotResult()
      return {
        success: true,
        calorie_goal: store.snapshot.settings.calorie_goal,
        protein_goal: store.snapshot.settings.protein_goal,
        carbs_goal: store.snapshot.settings.carbs_goal,
        fat_goal: store.snapshot.settings.fat_goal,
        water_goal_ml: store.snapshot.settings.water_goal_ml || 2500,
        target_weight_kg: store.snapshot.settings.target_weight_kg || undefined,
        height_cm: store.snapshot.settings.height_cm || undefined,
        units: store.snapshot.settings.units,
      }
    },
  },
  {
    name: "set_goals",
    description:
      "Updates daily calorie and macro goals. Provide only the goals to change (calorie_goal, protein_goal, carbs_goal, fat_goal, water_goal_ml, target_weight_kg).",
    inputSchema: {
      type: "object",
      properties: {
        calorie_goal: { type: "number", description: "Daily calorie goal in kcal." },
        protein_goal: { type: "number", description: "Daily protein goal in grams." },
        carbs_goal: { type: "number", description: "Daily carbs goal in grams." },
        fat_goal: { type: "number", description: "Daily fat goal in grams." },
        water_goal_ml: { type: "number", description: "Daily water goal in milliliters." },
        target_weight_kg: { type: "number", description: "Target weight in kilograms." },
      },
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const payload = {}
      for (const field of [
        "calorie_goal",
        "protein_goal",
        "carbs_goal",
        "fat_goal",
        "water_goal_ml",
        "target_weight_kg",
      ]) {
        const value = args[field]
        if (value === undefined || value === null || value === "") continue
        const num = toPositiveNumber(value, 0)
        if (num <= 0) return { success: false, error: `'${field}' must be a positive number.` }
        payload[field] = num
      }
      if (Object.keys(payload).length === 0) {
        return { success: false, error: "Provide at least one goal to update." }
      }
      const change = appendChange(store, "set_goals", payload)
      return { success: true, ...payload, change_seq: change.seq }
    },
  },
  {
    name: "get_settings",
    description:
      "Returns app settings from the snapshot: units (metric/imperial), food database country, theme, hydration goal, and YAZIO sync flag.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute(store) {
      if (!store.snapshot) return noSnapshotResult()
      return {
        success: true,
        units: store.snapshot.settings.units,
        food_database_country: store.snapshot.settings.food_database_country,
        water_goal_ml: store.snapshot.settings.water_goal_ml,
        height_cm: store.snapshot.settings.height_cm,
        target_weight_kg: store.snapshot.settings.target_weight_kg,
        theme_preference: store.snapshot.settings.theme_preference,
        yazio_sync_enabled: store.snapshot.settings.yazio_sync_enabled === 1,
      }
    },
  },
  {
    name: "set_units",
    description:
      "Changes the units used for weight and water display. Applied to the user's device on the next sync.",
    inputSchema: {
      type: "object",
      properties: {
        units: { type: "string", description: "One of 'metric' or 'imperial'." },
      },
      required: ["units"],
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      if (args.units !== "metric" && args.units !== "imperial") {
        return { success: false, error: "Provide units as 'metric' or 'imperial'." }
      }
      const change = appendChange(store, "set_units", { units: args.units })
      return { success: true, units: args.units, change_seq: change.seq }
    },
  },
  {
    name: "set_profile",
    description:
      "Updates user profile settings: height in cm, target weight in kg, water goal in ml, food database country, theme preference, or units.",
    inputSchema: {
      type: "object",
      properties: {
        height_cm: { type: "number", description: "Height in centimeters." },
        target_weight_kg: { type: "number", description: "Target weight in kilograms." },
        water_goal_ml: { type: "number", description: "Daily water goal in milliliters." },
        food_database_country: { type: "string", description: "Country code for food searches." },
        theme_preference: {
          type: "string",
          description:
            "'system' or any theme like 'dracula', 'nord', 'one-dark-pro', 'github-light', etc.",
        },
        units: { type: "string", description: "'metric' or 'imperial'." },
      },
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const payload = {}
      if (args.height_cm !== undefined && Number(args.height_cm) > 0)
        payload.height_cm = Number(args.height_cm)
      if (args.target_weight_kg !== undefined && Number(args.target_weight_kg) > 0)
        payload.target_weight_kg = Number(args.target_weight_kg)
      if (args.water_goal_ml !== undefined && Number(args.water_goal_ml) > 0)
        payload.water_goal_ml = Number(args.water_goal_ml)
      if (typeof args.food_database_country === "string")
        payload.food_database_country = args.food_database_country.trim().toUpperCase()
      if (typeof args.theme_preference === "string" && args.theme_preference.length > 0)
        payload.theme_preference = args.theme_preference
      if (args.units === "metric" || args.units === "imperial") payload.units = args.units
      if (Object.keys(payload).length === 0) {
        return { success: false, error: "Provide at least one profile field to update." }
      }
      const change = appendChange(store, "set_profile", payload)
      return { success: true, ...payload, change_seq: change.seq }
    },
  },

  // 7. Multi-Day Health Summary & Analytics
  {
    name: "get_health_summary",
    description:
      "Returns a multi-day health overview: calorie and macro averages, water compliance, weight trends, and daily history from the snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of past days to analyze (default 7, max 30).",
        },
      },
    },
    annotations: { readOnlyHint: true },
    execute(store, args) {
      if (!store.snapshot) return noSnapshotResult()
      const days = Math.min(Math.max(Number(args.days) || 7, 1), 30)
      const today = todayKey()
      const dates = Array.from({ length: days }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (days - 1 - i))
        return d.toISOString().slice(0, 10)
      })
      const diaryByDate = new Map()
      for (const e of store.snapshot.diary || []) {
        if (!diaryByDate.has(e.date)) diaryByDate.set(e.date, [])
        diaryByDate.get(e.date).push(e)
      }
      const waterByDate = new Map()
      for (const w of store.snapshot.water || []) {
        waterByDate.set(w.date, (waterByDate.get(w.date) || 0) + (Number(w.amount_ml) || 0))
      }
      let totalKcal = 0
      let totalProtein = 0
      let totalCarbs = 0
      let totalFat = 0
      let totalWater = 0
      let daysWithNutrition = 0
      let daysWithWater = 0

      const history = dates.map((date) => {
        const entries = diaryByDate.get(date) || []
        const waterMl = waterByDate.get(date) || 0
        const totals = entries.reduce(
          (acc, e) => ({
            kcal: acc.kcal + e.kcal,
            protein: acc.protein + e.protein,
            carbs: acc.carbs + e.carbs,
            fat: acc.fat + e.fat,
          }),
          { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        )
        if (entries.length > 0) daysWithNutrition++
        if (waterMl > 0) daysWithWater++
        totalKcal += totals.kcal
        totalProtein += totals.protein
        totalCarbs += totals.carbs
        totalFat += totals.fat
        totalWater += waterMl
        return {
          date,
          kcal: Math.round(totals.kcal),
          protein: Math.round(totals.protein * 10) / 10,
          carbs: Math.round(totals.carbs * 10) / 10,
          fat: Math.round(totals.fat * 10) / 10,
          water_ml: Math.round(waterMl),
        }
      })

      const weights = store.snapshot.weight || []
      let weightDelta = null
      if (weights.length >= 2) {
        weightDelta =
          Math.round((weights[0].weight_kg - weights[weights.length - 1].weight_kg) * 100) / 100
      }

      return {
        success: true,
        period_days: days,
        days_logged_nutrition: daysWithNutrition,
        days_logged_water: daysWithWater,
        averages: {
          kcal: daysWithNutrition > 0 ? Math.round(totalKcal / daysWithNutrition) : 0,
          protein:
            daysWithNutrition > 0 ? Math.round((totalProtein / daysWithNutrition) * 10) / 10 : 0,
          carbs: daysWithNutrition > 0 ? Math.round((totalCarbs / daysWithNutrition) * 10) / 10 : 0,
          fat: daysWithNutrition > 0 ? Math.round((totalFat / daysWithNutrition) * 10) / 10 : 0,
          water_ml: daysWithWater > 0 ? Math.round(totalWater / daysWithWater) : 0,
        },
        goals: {
          calorie_goal: store.snapshot.settings.calorie_goal,
          protein_goal: store.snapshot.settings.protein_goal,
          carbs_goal: store.snapshot.settings.carbs_goal,
          fat_goal: store.snapshot.settings.fat_goal,
          water_goal_ml: store.snapshot.settings.water_goal_ml || 2500,
          target_weight_kg: store.snapshot.settings.target_weight_kg || undefined,
        },
        weight_trend: {
          entries_count: weights.length,
          latest_weight_kg: weights.length > 0 ? weights[0].weight_kg : null,
          delta_kg: weightDelta,
        },
        history,
      }
    },
  },
]

function listTools() {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
  }))
}

// JSON-RPC

function jsonError(id, code, message) {
  return { jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } }
}

function jsonResult(id, result) {
  return { jsonrpc: "2.0", id, result }
}

/**
 * Handles one JSON-RPC message. Returns null for notifications (the caller
 * answers HTTP 202 with no body).
 */
function handleJsonRpc(store, message) {
  if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") {
    return jsonError(null, -32600, "Invalid Request")
  }
  const id = message.id
  const isNotification = id === undefined

  switch (message.method) {
    case "initialize":
      if (isNotification) return null
      return jsonResult(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.has(message.params?.protocolVersion)
          ? message.params.protocolVersion
          : DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions: INSTRUCTIONS,
      })
    case "notifications/initialized":
      return null
    case "ping":
      return isNotification ? null : jsonResult(id, {})
    case "tools/list":
      if (isNotification) return null
      return jsonResult(id, {
        tools: listTools(),
        cacheScope: "public",
        timeToLive: 300000,
      })
    case "tools/call":
      if (isNotification) return null
      return jsonResult(id, callTool(store, message.params))
    default:
      return isNotification ? null : jsonError(id, -32601, `Method not found: ${message.method}`)
  }
}

function callTool(store, params) {
  const name = params?.name
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) {
    return { content: [{ type: "text", text: `Tool '${name}' is not available.` }], isError: true }
  }
  const args =
    params?.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
      ? params.arguments
      : {}
  try {
    const result = tool.execute(store, args)
    const text = JSON.stringify(result)
    if (result && result.success === false) {
      const message = typeof result.error === "string" ? result.error : `Tool '${name}' failed.`
      return { content: [{ type: "text", text: message }], isError: true }
    }
    return { content: [{ type: "text", text }], structuredContent: result ?? null }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Tool '${name}' failed: ${error instanceof Error ? error.message : error}`,
        },
      ],
      isError: true,
    }
  }
}

// HTTP middleware

function isSameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true // curl / server-to-server
  const host = req.headers.host
  if (!host) return false
  try {
    const originHost = new URL(origin).host
    return originHost === host
  } catch {
    return false
  }
}

function mcpApiKeyRequired() {
  return Boolean(process.env.MCP_API_KEY) || process.env.NODE_ENV === "production"
}

function isValidApiKey(provided) {
  const expected = process.env.MCP_API_KEY || ""
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (chunk) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Content-Length", Buffer.byteLength(payload))
  res.end(payload)
}

function rejectUnauthorized(res, message) {
  res.statusCode = 401
  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  res.end(message)
}

/** CORS preflight + headers for browser-based MCP clients. */
function applyMcpCors(req, res) {
  const origins = (process.env.MCP_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (origins.length === 0) return false
  const origin = req.headers.origin
  if (!origin || !origins.includes(origin)) return false
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, x-api-key, authorization, mcp-protocol-version, mcp-session-id",
  )
  res.setHeader("Access-Control-Max-Age", "86400")
  res.setHeader("Vary", "Origin")
  return true
}

/**
 * Creates the middleware for /mcp and /api/agent/*. Signature mirrors the
 * Metro dev middleware so both hosts can mount it the same way.
 */
function createAgentMiddleware(store) {
  return async function agentMiddleware(req, res, next) {
    const url = req.url || "/"
    const path = url.split("?")[0]

    if (path === "/mcp") {
      if (req.method === "OPTIONS") {
        if (applyMcpCors(req, res)) {
          res.statusCode = 204
          res.end()
          return
        }
        res.statusCode = 204
        res.end()
        return
      }
      applyMcpCors(req, res)

      if (req.method === "GET") {
        // Streamable HTTP spec: SSE handshake endpoint for GET clients.
        res.statusCode = 200
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
        res.setHeader("Cache-Control", "no-cache")
        res.write("event: endpoint\ndata: /mcp\n\n")
        res.end()
        return
      }

      if (req.method !== "POST") {
        res.statusCode = 405
        res.end("Method Not Allowed")
        return
      }

      if (mcpApiKeyRequired()) {
        const provided =
          req.headers["x-api-key"] ??
          (req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.slice(7)
            : null)
        if (!isValidApiKey(provided)) {
          rejectUnauthorized(res, "A valid MCP_API_KEY is required for the agent API.")
          return
        }
      }

      const contentType = req.headers["content-type"] || ""
      const body = await readBody(req).catch(() => null)
      if (!body || body.length === 0) {
        sendJson(res, 400, jsonError(null, -32600, "Empty request body."))
        return
      }

      if (contentType.includes("application/jsonl")) {
        const lines = body
          .toString("utf8")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
        const responses = []
        for (const line of lines) {
          let message
          try {
            message = JSON.parse(line)
          } catch {
            responses.push(jsonError(null, -32700, "Parse error"))
            continue
          }
          const response = handleJsonRpc(store, message)
          if (response) responses.push(response)
        }
        res.statusCode = 200
        res.setHeader("Content-Type", "application/jsonl; charset=utf-8")
        res.end(responses.map((r) => JSON.stringify(r)).join("\n"))
        return
      }

      let message
      try {
        message = JSON.parse(body.toString("utf8"))
      } catch {
        sendJson(res, 400, jsonError(null, -32700, "Parse error"))
        return
      }
      const response = handleJsonRpc(store, message)
      if (!response) {
        res.statusCode = 202
        res.end()
        return
      }
      sendJson(res, 200, response)
      return
    }

    // Same-origin AI provider proxy: browsers cannot call OpenAI-compatible
    // gateways cross-origin (CORS), so the web app forwards its AI requests
    // here and the server pipes them to the configured provider.
    if (path === "/api/ai/proxy" && req.method === "POST") {
      if (!isSameOrigin(req)) {
        res.statusCode = 403
        res.end("Forbidden")
        return
      }
      const target = req.headers["x-ai-target-url"]
      if (!target || !/^https?:\/\//i.test(String(target))) {
        sendJson(res, 400, { ok: false, error: "Missing or invalid x-ai-target-url header." })
        return
      }
      const body = await readBody(req).catch(() => null)
      const headers = {}
      for (const [key, value] of Object.entries(req.headers)) {
        const lower = key.toLowerCase()
        if (
          lower === "host" ||
          lower === "connection" ||
          lower === "content-length" ||
          lower === "origin" ||
          lower === "referer" ||
          lower === "x-ai-target-url" ||
          lower === "accept-encoding"
        ) {
          continue
        }
        headers[key] = value
      }

      let upstream
      try {
        upstream = await fetch(String(target), {
          method: "POST",
          headers,
          body: body && body.length > 0 ? body : undefined,
        })
      } catch {
        res.statusCode = 502
        res.end("AI proxy error")
        return
      }

      res.statusCode = upstream.status
      upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase()
        if (
          lower === "transfer-encoding" ||
          lower === "content-encoding" ||
          lower === "content-length"
        ) {
          return
        }
        res.setHeader(key, value)
      })
      if (upstream.body) {
        const { Readable } = require("node:stream")
        Readable.fromWeb(upstream.body).pipe(res)
      } else {
        res.end()
      }
      return
    }

    if (path === "/api/agent/snapshot" && req.method === "POST") {
      if (!isSameOrigin(req)) {
        res.statusCode = 403
        res.end("Forbidden")
        return
      }
      const body = await readBody(req).catch(() => null)
      let parsed
      try {
        parsed = body ? JSON.parse(body.toString("utf8")) : null
      } catch {
        sendJson(res, 400, { ok: false, error: "Invalid JSON body." })
        return
      }
      const result = handleSnapshot(store, parsed)
      sendJson(res, result.ok ? 200 : 400, result)
      return
    }

    if (path === "/api/agent/changes" && req.method === "GET") {
      if (!isSameOrigin(req)) {
        res.statusCode = 403
        res.end("Forbidden")
        return
      }
      const query = new URL(url, "http://localhost").searchParams
      sendJson(res, 200, handleChanges(store, query.get("since") ?? "0"))
      return
    }

    return next(req, res)
  }
}

module.exports = {
  createSnapshotStore,
  createAgentMiddleware,
  handleJsonRpc,
  handleSnapshot,
  handleChanges,
  listTools,
  callTool,
}
