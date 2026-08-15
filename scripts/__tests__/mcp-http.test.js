"use strict"

const { createAgentMiddleware, createSnapshotStore } = require("../mcp-server.cjs")

function makeReq(url, { method = "POST", headers = {}, body = null } = {}) {
  return {
    url,
    method,
    headers: { "content-type": "application/json", host: "localhost:8082", ...headers },
    on(event, handler) {
      if (event === "data" && body) handler(Buffer.from(JSON.stringify(body)))
      if (event === "end" && body) handler()
      if (event === "end" && !body) handler()
    },
  }
}

function makeRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    write(chunk) {
      this.body += chunk
    },
    end(chunk) {
      if (chunk) this.body += chunk
      this.ended = true
    },
    on() {
      return this
    },
    once() {
      return this
    },
    removeListener() {
      return this
    },
    emit() {
      return true
    },
  }
  return res
}

function runMiddleware(middleware, req, res) {
  return new Promise((resolve, reject) => {
    const next = () => resolve("next")
    middleware(req, res, next).then(() => {
      if (res.ended) resolve("handled")
    }, reject)
  })
}

describe("agent HTTP middleware", () => {
  let store
  let middleware
  const previousEnv = {}

  beforeEach(() => {
    store = createSnapshotStore()
    middleware = createAgentMiddleware(store)
    previousEnv.API_KEY = process.env.MCP_API_KEY
    previousEnv.CORS = process.env.MCP_CORS_ORIGINS
    previousEnv.NODE_ENV = process.env.NODE_ENV
    delete process.env.MCP_API_KEY
    delete process.env.MCP_CORS_ORIGINS
    process.env.NODE_ENV = "test"
  })

  afterEach(() => {
    if (previousEnv.API_KEY === undefined) delete process.env.MCP_API_KEY
    else process.env.MCP_API_KEY = previousEnv.API_KEY
    if (previousEnv.CORS === undefined) delete process.env.MCP_CORS_ORIGINS
    else process.env.MCP_CORS_ORIGINS = previousEnv.CORS
    process.env.NODE_ENV = previousEnv.NODE_ENV
  })

  it("answers GET /mcp with the SSE endpoint handshake", async () => {
    const req = makeReq("/mcp", { method: "GET" })
    const res = makeRes()
    await runMiddleware(middleware, req, res)
    expect(res.statusCode).toBe(200)
    expect(res.headers["content-type"]).toContain("text/event-stream")
    expect(res.body).toContain("event: endpoint")
    expect(res.body).toContain("data: /mcp")
  })

  it("handles initialize and tools/list over POST /mcp", async () => {
    const res = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/mcp", {
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-06-18" },
        },
      }),
      res,
    )
    expect(res.statusCode).toBe(200)
    const response = JSON.parse(res.body)
    expect(response.result.serverInfo.name).toBe("dietinator")
    expect(response.result.capabilities.tools).toEqual({ listChanged: false })

    const res2 = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/mcp", { body: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} } }),
      res2,
    )
    expect(JSON.parse(res2.body).result.tools).toHaveLength(23)
  })

  it("answers notifications with HTTP 202 and no body", async () => {
    const res = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/mcp", { body: { jsonrpc: "2.0", method: "notifications/initialized" } }),
      res,
    )
    expect(res.statusCode).toBe(202)
    expect(res.body).toBe("")
  })

  it("processes JSONL batches", async () => {
    const req = makeReq("/mcp", {
      headers: { "content-type": "application/jsonl" },
      body: null,
    })
    // Hand-craft the raw body since the JSONL body is multiple lines.
    req.on = (event, handler) => {
      const payload =
        '{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n'
      if (event === "data") handler(Buffer.from(payload))
      if (event === "end") handler()
    }
    const res = makeRes()
    await runMiddleware(middleware, req, res)
    expect(res.statusCode).toBe(200)
    expect(res.headers["content-type"]).toContain("application/jsonl")
    const lines = res.body.trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).result).toEqual({})
  })

  it("rejects malformed JSON with -32700", async () => {
    const req = makeReq("/mcp", { body: null })
    req.on = (event, handler) => {
      if (event === "data") handler(Buffer.from("{oops"))
      if (event === "end") handler()
    }
    const res = makeRes()
    await runMiddleware(middleware, req, res)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe(-32700)
  })

  it("rejects non-POST methods with 405", async () => {
    const res = makeRes()
    await runMiddleware(middleware, makeReq("/mcp", { method: "PUT" }), res)
    expect(res.statusCode).toBe(405)
  })

  it("requires MCP_API_KEY when configured", async () => {
    process.env.MCP_API_KEY = "secret"
    const res = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/mcp", { body: { jsonrpc: "2.0", id: 1, method: "ping" } }),
      res,
    )
    expect(res.statusCode).toBe(401)

    const ok = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/mcp", {
        headers: { "x-api-key": "secret" },
        body: { jsonrpc: "2.0", id: 1, method: "ping" },
      }),
      ok,
    )
    expect(ok.statusCode).toBe(200)
  })

  it("requires MCP_API_KEY in production even when unset", async () => {
    process.env.NODE_ENV = "production"
    const res = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/mcp", { body: { jsonrpc: "2.0", id: 1, method: "ping" } }),
      res,
    )
    expect(res.statusCode).toBe(401)
  })

  it("supports Bearer auth", async () => {
    process.env.MCP_API_KEY = "bearer-secret"
    const ok = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/mcp", {
        headers: { authorization: "Bearer bearer-secret" },
        body: { jsonrpc: "2.0", id: 1, method: "ping" },
      }),
      ok,
    )
    expect(ok.statusCode).toBe(200)
  })

  it("answers CORS preflight for configured origins", async () => {
    process.env.MCP_CORS_ORIGINS = "https://claude.ai"
    const res = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/mcp", {
        method: "OPTIONS",
        headers: { origin: "https://claude.ai" },
      }),
      res,
    )
    expect(res.statusCode).toBe(204)
    expect(res.headers["access-control-allow-origin"]).toBe("https://claude.ai")
  })

  it("stores snapshots from same-origin posts and rejects cross-origin ones", async () => {
    const body = {
      updated_at: "2026-08-08T10:00:00.000Z",
      settings: { calorie_goal: 2000 },
      diary: [{ id: "e1", food_name: "Oats", kcal: 250, date: "2026-08-08" }],
    }
    const ok = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/api/agent/snapshot", { headers: { origin: "http://localhost:8082" }, body }),
      ok,
    )
    expect(ok.statusCode).toBe(200)
    expect(JSON.parse(ok.body).ok).toBe(true)
    expect(store.snapshot.diary).toHaveLength(1)

    const bad = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/api/agent/snapshot", { headers: { origin: "https://evil.example" }, body }),
      bad,
    )
    expect(bad.statusCode).toBe(403)
  })

  it("rejects malformed snapshots and serves the change feed", async () => {
    const bad = makeRes()
    await runMiddleware(middleware, makeReq("/api/agent/snapshot", { body: { settings: {} } }), bad)
    expect(bad.statusCode).toBe(400)

    const feed = makeRes()
    await runMiddleware(middleware, makeReq("/api/agent/changes?since=0", { method: "GET" }), feed)
    expect(feed.statusCode).toBe(200)
    expect(JSON.parse(feed.body)).toEqual({ changes: [], revision: 0 })
  })

  it("passes unknown paths through to the next handler", async () => {
    const res = makeRes()
    const result = await runMiddleware(middleware, makeReq("/", { method: "GET" }), res)
    expect(result).toBe("next")
  })

  it("proxies AI provider requests with the target and auth headers", async () => {
    const { Readable, Writable } = require("node:stream")
    const upstreamFetch = jest.fn(async () => ({
      status: 200,
      headers: {
        forEach: (cb) => {
          cb("text/event-stream", "content-type")
        },
      },
      body: Readable.toWeb(Readable.from(["data: hello\n\n"])),
    }))
    global.fetch = upstreamFetch

    // A real Writable so the middleware's pipe() completes.
    const res = makeRes()
    const writable = new Writable({
      write(chunk, _enc, cb) {
        res.body += chunk.toString()
        cb()
      },
      final(cb) {
        res.ended = true
        cb()
      },
    })
    res.write = (chunk) => writable.write(chunk)
    res.end = (chunk) => writable.end(chunk)
    res.on = (event, handler) => writable.on(event, handler)
    res.once = (event, handler) => writable.once(event, handler)

    const finished = new Promise((resolve) => writable.on("finish", resolve))
    await middleware(
      makeReq("/api/ai/proxy", {
        headers: {
          "x-ai-target-url": "https://provider.example/v1/chat/completions",
          authorization: "Bearer sk-test",
          accept: "text/event-stream",
        },
        body: { model: "m", messages: [] },
      }),
      res,
      () => {},
    )
    await finished

    expect(upstreamFetch).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer sk-test" }),
      }),
    )
    expect(res.statusCode).toBe(200)
    expect(res.headers["content-type"]).toBe("text/event-stream")
    expect(res.body).toContain("data: hello")
  })

  it("rejects AI proxy requests without a target or from foreign origins", async () => {
    const bad = makeRes()
    await runMiddleware(middleware, makeReq("/api/ai/proxy", { body: {} }), bad)
    expect(bad.statusCode).toBe(400)

    const foreign = makeRes()
    await runMiddleware(
      middleware,
      makeReq("/api/ai/proxy", {
        headers: {
          origin: "https://evil.example",
          "x-ai-target-url": "https://provider.example/v1",
        },
        body: {},
      }),
      foreign,
    )
    expect(foreign.statusCode).toBe(403)
  })
})
