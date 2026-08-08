"use strict"

/**
 * Dietinator MCP server + agent bridge (shared by Metro dev middleware and
 * scripts/serve-dist.mjs).
 *
 * The web app is local-first: diary data lives in the browser (OPFS SQLite).
 * A Node process cannot reach it, so the app *pushes* a small snapshot of the
 * last 14 days + goals to this server (`POST /api/agent/snapshot`), and this
 * server exposes those tools to external AI agents over the Model Context
 * Protocol at `/mcp` (Streamable HTTP, stateless JSON-RPC):
 *
 *   - get_diary, get_goals       (read-only, from the snapshot)
 *   - log_food, delete_food_entry, set_goals  (enqueue a change)
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
  "You are the agent interface for Dietinator, a local-first calorie and macro tracker. " +
  "Read the diary snapshot (get_diary, get_goals) and make changes (log_food, set_goals, " +
  "delete_food_entry). Changes are applied back to the user's device the next time the app " +
  "synchronizes. Tools that modify data should only be used when the user asked for it."

// ── Snapshot store ─────────────────────────────────────────────────────────

function createSnapshotStore() {
  return {
    snapshot: null, // { settings, diary: [], updated_at, revision }
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
  // (log → update → delete) see their own writes on subsequent tool calls.
  applyChangeToSnapshot(store, op, payload)
  return change
}

function applyChangeToSnapshot(store, op, payload) {
  if (!store.snapshot) return
  switch (op) {
    case "log_food":
      store.snapshot.diary.push(payload)
      break
    case "update_food_entry": {
      const entry = store.snapshot.diary.find((e) => e.id === payload.id)
      if (entry) {
        entry.amount = payload.amount
        if (payload.meal_type !== undefined) entry.meal_type = payload.meal_type
      }
      break
    }
    case "delete_entry":
      store.snapshot.diary = store.snapshot.diary.filter((e) => e.id !== payload.id)
      break
    case "set_goals":
      for (const [key, value] of Object.entries(payload)) {
        if (key !== "change_seq") store.snapshot.settings[key] = value
      }
      break
    case "set_units":
      store.snapshot.settings.units = payload.units
      break
    // log_meal items are resolved on-device; nothing to mirror here.
    default:
      break
  }
}

function snapshotRevision(store) {
  return store.nextSeq - 1
}

// ── Agent bridge handlers ──────────────────────────────────────────────────

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
    meals: Array.isArray(body.meals) ? body.meals : [],
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

// ── MCP tools ──────────────────────────────────────────────────────────────

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
  const entries = snapshot.diary.map(toDiaryRow)
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

const TOOLS = [
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
    name: "get_goals",
    description: "Returns the current daily calorie and macro goals from the snapshot.",
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
        units: store.snapshot.settings.units,
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
      const today = new Date().toISOString().slice(0, 10)
      const dates = Array.from({ length: days }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (days - 1 - i))
        return d.toISOString().slice(0, 10)
      })
      const byDate = new Map()
      for (const e of store.snapshot.diary) {
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
    name: "get_settings",
    description:
      "Returns app settings from the snapshot: units (metric/imperial), YAZIO sync flag and update check flag.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute(store) {
      if (!store.snapshot) return noSnapshotResult()
      return {
        success: true,
        units: store.snapshot.settings.units,
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
        name: { type: "string", description: "Food name, e.g. 'Chicken breast, grilled'." },
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
  {
    name: "set_goals",
    description:
      "Updates daily calorie and macro goals. Provide only the goals to change (calorie_goal, protein_goal, carbs_goal, fat_goal).",
    inputSchema: {
      type: "object",
      properties: {
        calorie_goal: { type: "number", description: "Daily calorie goal in kcal." },
        protein_goal: { type: "number", description: "Daily protein goal in grams." },
        carbs_goal: { type: "number", description: "Daily carbs goal in grams." },
        fat_goal: { type: "number", description: "Daily fat goal in grams." },
      },
    },
    annotations: { destructiveHint: true },
    execute(store, args) {
      const payload = {}
      for (const field of ["calorie_goal", "protein_goal", "carbs_goal", "fat_goal"]) {
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
    name: "get_meals",
    description:
      "Lists saved meals from the snapshot (foods you often eat together) with their total calories and macros.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute(store) {
      if (!store.snapshot) return noSnapshotResult()
      return { success: true, meals: store.snapshot.meals }
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
]

function listTools() {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
  }))
}

// ── JSON-RPC ───────────────────────────────────────────────────────────────

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

// ── HTTP middleware ────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

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
