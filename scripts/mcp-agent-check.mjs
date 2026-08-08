#!/usr/bin/env node
/**
 * Thorough MCP agent check: boots the real /mcp server in-process, pushes a
 * seeded snapshot, then drives an OpenAI-compatible agent loop against every
 * tool using a real provider (default: the OpenCode gateway with
 * deepseek-v4-flash).
 *
 * The API key is read from the OPENCODE_API_KEY env var only — never
 * hardcoded or printed. Exit code 0 when every tool was exercised.
 *
 * Usage:
 *   $env:OPENCODE_API_KEY = "sk-…" ; node scripts/mcp-agent-check.mjs
 *   OPENCODE_API_KEY=… node scripts/mcp-agent-check.mjs [model]
 */
import { createRequire } from "node:module"
import { createServer } from "node:http"

const require = createRequire(import.meta.url)
const {
  createSnapshotStore,
  createAgentMiddleware,
  handleSnapshot,
  handleChanges,
} = require("./mcp-server.cjs")

const API_KEY = process.env.OPENCODE_API_KEY || ""
const MODEL = process.argv[2] || "deepseek-v4-flash"
const BASE_URL = "https://opencode.ai/zen/go/v1"
const PORT = 8095

const TOOLS_BY_SCENARIO = {
  "read-only review": ["get_diary", "get_goals", "get_settings", "get_diary_stats", "get_meals"],
  "log-update-delete": ["log_food", "update_food_entry", "delete_food_entry"],
  "goals and units": ["set_goals", "set_units"],
  "log a meal": ["get_meals", "log_meal"],
}

const SCENARIOS = [
  {
    name: "read-only review",
    prompt:
      "Review my diary: show me the summary for 2026-08-08, my daily goals, my app settings, my stats for the last 3 days and my saved meals. Report each in one line.",
    requiredTools: TOOLS_BY_SCENARIO["read-only review"],
  },
  {
    name: "log-update-delete",
    prompt:
      "Log a snack called 'Protein bar' worth 300 kcal with 20 g protein for today (use the entry you created). Then update that entry's amount to 2. Then delete the entry again. Confirm each step.",
    requiredTools: TOOLS_BY_SCENARIO["log-update-delete"],
  },
  {
    name: "goals and units",
    prompt: "Set my protein goal to 160 g and switch my units to imperial. Confirm both changes.",
    requiredTools: TOOLS_BY_SCENARIO["goals and units"],
  },
  {
    name: "log a meal",
    prompt:
      "Log my 'Cornflakes with milk' meal for tomorrow morning (breakfast). Confirm what you logged.",
    requiredTools: TOOLS_BY_SCENARIO["log a meal"],
  },
]

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function seedSnapshot(store) {
  const { ok } = handleSnapshot(store, {
    updated_at: new Date().toISOString(),
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
        id: "e-today-1",
        date: todayKey(),
        meal_type: "breakfast",
        food_name: "Oatmeal",
        amount: 1,
        unit: "serving",
        kcal: 250,
        protein: 10,
        carbs: 45,
        fat: 4,
        created_at: `${todayKey()}T07:00:00Z`,
      },
      {
        id: "e-today-2",
        date: todayKey(),
        meal_type: "lunch",
        food_name: "Chicken wrap",
        amount: 1,
        unit: "serving",
        kcal: 520,
        protein: 38,
        carbs: 48,
        fat: 18,
        created_at: `${todayKey()}T12:00:00Z`,
      },
      {
        id: "e-yest-1",
        date: daysAgo(1),
        meal_type: "dinner",
        food_name: "Pasta bolognese",
        amount: 1,
        unit: "serving",
        kcal: 640,
        protein: 30,
        carbs: 82,
        fat: 18,
        created_at: `${daysAgo(1)}T19:00:00Z`,
      },
      {
        id: "e-3d-1",
        date: daysAgo(3),
        meal_type: "snack",
        food_name: "Banana",
        amount: 1,
        unit: "serving",
        kcal: 105,
        protein: 1,
        carbs: 27,
        fat: 0,
        created_at: `${daysAgo(3)}T15:00:00Z`,
      },
    ],
    meals: [
      {
        id: "meal-corn",
        name: "Cornflakes with milk",
        kcal: 220,
        protein: 8,
        carbs: 42,
        fat: 3,
        items_count: 2,
        last_used_at: daysAgo(2),
      },
      {
        id: "meal-soup",
        name: "Homemade soup",
        kcal: 180,
        protein: 9,
        carbs: 22,
        fat: 6,
        items_count: 4,
        last_used_at: null,
      },
    ],
  })
  if (!ok) throw new Error("Seeding the snapshot failed")
}

// ── Minimal MCP client over the real HTTP server ───────────────────────────

async function startMcpServer() {
  const store = createSnapshotStore()
  const middleware = createAgentMiddleware(store)
  const server = createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404
      res.end("not found")
    }).catch(() => undefined)
  })
  await new Promise((resolve) => server.listen(PORT, resolve))
  seedSnapshot(store)
  return { store, close: () => server.close() }
}

let jsonRpcId = 0
async function mcpCall(method, params) {
  const response = await fetch(`http://localhost:${PORT}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++jsonRpcId, method, params: params ?? {} }),
  })
  const body = await response.json()
  if (body.error) throw new Error(`MCP error ${body.error.code}: ${body.error.message}`)
  return body.result
}

async function mcpTools() {
  const { tools } = await mcpCall("tools/list")
  return tools
}

async function mcpCallTool(name, args) {
  const result = await mcpCall("tools/call", { name, arguments: args ?? {} })
  const text = result.content?.[0]?.text ?? JSON.stringify(result)
  if (result.isError) throw new Error(`Tool ${name} failed: ${text}`)
  return { text, result }
}

// ── OpenAI-compatible provider loop ─────────────────────────────────────────

function toOpenAiTools(tools) {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }))
}

async function providerChat(messages, tools) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
      "HTTP-Referer": "https://github.com/tothKarolyDavid/Dietinator",
      "X-Title": "Dietinator MCP agent check",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      stream: false,
      max_tokens: 4096,
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`Provider HTTP ${response.status}: ${text.slice(0, 400)}`)
  }
  const body = await response.json()
  return body.choices?.[0]?.message ?? { content: "" }
}

const SYSTEM_PROMPT =
  "You are a test agent exercising the Dietinator MCP server. Use the provided tools to " +
  "fulfill the user's request. Follow instructions exactly: create entries, then update and " +
  "delete them when asked. Reply with a short confirmation after each tool run. Do not " +
  "invent ids — reuse ids returned by tools."

async function runScenario(name, prompt, requiredTools) {
  const tools = await mcpTools()
  const used = new Set()
  const messages = [{ role: "system", content: SYSTEM_PROMPT }]
  messages.push({ role: "user", content: prompt })

  let final = ""
  for (let turn = 0; turn < 10; turn++) {
    const message = await providerChat(messages, toOpenAiTools(tools))
    const content = message.content ?? ""
    final = content || final
    const toolCalls = message.tool_calls ?? []
    if (toolCalls.length === 0) break

    messages.push({ role: "assistant", content, tool_calls: toolCalls })
    for (const call of toolCalls) {
      const fn = call.function ?? {}
      const toolName = fn.name
      let args = {}
      try {
        args = fn.arguments ? JSON.parse(fn.arguments) : {}
      } catch {
        args = {}
      }
      used.add(toolName)
      let toolText
      try {
        toolText = (await mcpCallTool(toolName, args)).text
      } catch (error) {
        toolText = JSON.stringify({ success: false, error: error.message })
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: toolText })
    }
  }

  const missing = requiredTools.filter((t) => !used.has(t))
  const status = missing.length === 0 ? "PASS" : "FAIL"
  const replyPreview = final.replace(/\s+/g, " ").slice(0, 120)
  return { name, status, used: [...used].sort(), missing, replyPreview }
}

// ── Main ────────────────────────────────────────────────────────────────────

if (!API_KEY) {
  console.error("Set OPENCODE_API_KEY to run the live MCP agent check.")
  process.exit(2)
}

const { store, close } = await startMcpServer()
console.log(`MCP server on :${PORT} · provider ${MODEL}\n`)

const results = []
for (const scenario of SCENARIOS) {
  process.stdout.write(`▶ ${scenario.name} … `)
  try {
    const result = await runScenario(scenario.name, scenario.prompt, scenario.requiredTools)
    results.push(result)
    console.log(result.status)
  } catch (error) {
    results.push({
      name: scenario.name,
      status: "FAIL",
      used: [],
      missing: scenario.requiredTools,
      replyPreview: error.message.slice(0, 120),
    })
    console.log("FAIL")
  }
}

// Final validation: the change feed must contain every write op.
const feed = handleChanges(store, 0)
const feedOps = feed.changes.map((c) => c.op)
const expectedOps = [
  "log_food",
  "update_food_entry",
  "delete_entry",
  "set_goals",
  "set_units",
  "log_meal",
]
const missingOps = expectedOps.filter((op) => !feedOps.includes(op))

console.log("\n" + "─".repeat(72))
console.log("Scenario".padEnd(20) + "Status".padEnd(8) + "Tools used")
for (const r of results) {
  console.log(r.name.padEnd(20) + r.status.padEnd(8) + r.used.join(", ") || r.name)
  if (r.missing.length > 0) console.log("  missing: " + r.missing.join(", "))
  console.log(`  reply: ${r.replyPreview}`)
}
console.log("─".repeat(72))
console.log("Change feed ops:", feedOps.join(", "))
console.log("Missing change ops:", missingOps.length === 0 ? "none" : missingOps.join(", "))

const ok = results.every((r) => r.status === "PASS") && missingOps.length === 0
await close()
console.log(ok ? "\nALL CHECKS PASSED" : "\nCHECKS FAILED")
process.exit(ok ? 0 : 1)
