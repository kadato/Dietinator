#!/usr/bin/env node
/**
 * Static server for the web export (`npm run build:web` → `dist/`).
 *
 * - Serves `dist/` with the COEP/COOP headers wa-sqlite needs (SharedArrayBuffer)
 * - Proxies `/api/yazio/*` to the YAZIO API exactly like the Metro dev middleware,
 *   so the production web build keeps the same online behavior as `npm start`
 * - Gzip-compresses static assets for snappier loads
 *
 * Usage: npm run serve:web   (PORT env overrides the default 8082)
 */
import { createServer } from "node:http"
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, normalize, relative } from "node:path"
import { brotliCompressSync, gzipSync } from "node:zlib"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

// MCP server + agent snapshot bridge (shared with the Metro dev middleware).
const require = createRequire(import.meta.url)
const { createSnapshotStore, createAgentMiddleware } = require("./mcp-server.cjs")

const PORT = Number(process.env.PORT ?? 8082)
const ROOT = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  process.env.DIST_DIR ?? "dist",
)

const YAZIO_API_BASE = "https://yzapi.yazio.com/v15"
const YAZIO_PROXY_PREFIX = "/api/yazio"

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (chunk) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

async function proxyYazioRequest(req, res) {
  const requestUrl = new URL(req.url ?? "/", `http://localhost:${PORT}`)
  const targetPath = requestUrl.pathname.replace(YAZIO_PROXY_PREFIX, "") + requestUrl.search
  const targetUrl = `${YAZIO_API_BASE}${targetPath}`

  const headers = { ...req.headers }
  delete headers.host
  delete headers.connection

  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  const body = hasBody ? await readRequestBody(req) : undefined

  // A hung upstream must fail fast as a 502, not leave the browser spinning —
  // the app wraps YAZIO calls in withRetry and will retry a 502.
  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: body?.length ? body : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  res.statusCode = upstream.status
  const payload = Buffer.from(await upstream.arrayBuffer())
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
  res.setHeader("Content-Length", String(payload.length))
  res.end(payload)
}

function serveStatic(req, res, urlPath) {
  let filePath = normalize(join(ROOT, urlPath))
  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403
    res.end("Forbidden")
    return
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    if (urlPath === "/" || !filePath.endsWith(".html")) {
      const index = join(filePath, "index.html")
      if (existsSync(index) && statSync(index).isFile()) filePath = index
      else filePath = join(ROOT, "index.html")
    } else {
      res.statusCode = 404
      res.end("Not found")
      return
    }
  }

  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase()
  res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream")

  // Hashed build assets never change → cache forever. The HTML shell (including
  // extension-less SPA routes that resolve to index.html) and the service
  // worker must always revalidate so app updates ship immediately.
  const servesHtml = ext === ".html" || urlPath.endsWith("/")
  if (/^\/_expo\/static\//.test(urlPath) || /^\/assets\//.test(urlPath)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
  } else if (servesHtml || urlPath === "/sw.js") {
    res.setHeader("Cache-Control", "no-cache")
  } else {
    res.setHeader("Cache-Control", "public, max-age=3600")
  }

  // Compressible responses are served from a precomputed cache keyed by file
  // path + mtime, so a rebuild invalidates the cache but repeated requests
  // (and the audio-like churn of e2e/Lighthouse runs) cost nothing.
  const COMPRESSIBLE = /\.(js|css|json|svg|wasm|html)$/.test(ext)
  const acceptEncoding = req.headers["accept-encoding"] ?? ""

  if (COMPRESSIBLE) {
    const isHtml = ext === ".html"
    const cacheKey = `${filePath}@${statSync(filePath).mtimeMs}${isHtml ? ":html" : ""}`
    let cached = compressCache.get(cacheKey)
    if (!cached) {
      let raw = readFileSync(filePath)
      if (isHtml) raw = Buffer.from(decorateHtml(raw.toString("utf8")), "utf8")
      const br = acceptEncoding.includes("br")
        ? brotliCompressSync(raw, { params: { [BROTLI_QUALITY]: 5 } })
        : null
      const gz = acceptEncoding.includes("gzip") ? gzipSync(raw) : null
      cached = { br, gz, raw }
      compressCache.set(cacheKey, cached)
      // Keep the cache bounded — a handful of assets is all a build produces.
      if (compressCache.size > 64) {
        compressCache.delete(compressCache.keys().next().value)
      }
    }
    let body = null
    let encoding = null
    if (cached.br) {
      body = cached.br
      encoding = "br"
    } else if (cached.gz) {
      body = cached.gz
      encoding = "gzip"
    } else {
      body = cached.raw
    }
    res.setHeader("Content-Length", String(body.length))
    if (encoding) res.setHeader("Content-Encoding", encoding)
    res.end(body)
    return
  }

  res.setHeader("Content-Length", String(statSync(filePath).size))
  createReadStream(filePath).pipe(res)
}

if (!existsSync(ROOT)) {
  console.error(`No web build found at ${ROOT}`)
  console.error("Run `npm run build:web` first, or use `npm run dev:web` for hot reload.")
  process.exit(1)
}

// The wa-sqlite WASM is fetched by expo-sqlite only after the JS bundle boots.
// Preload it from the HTML shell so it downloads in parallel with the bundle —
// this trims the boot critical path by one full asset download.
function findWasmUrl() {
  const assetsDir = join(ROOT, "assets")
  if (!existsSync(assetsDir)) return null
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return walk(full)
      return entry.name.endsWith(".wasm") ? [full] : []
    })
  const found = walk(assetsDir)
  if (found.length === 0) return null
  return "/" + relative(ROOT, found[0]).replaceAll("\\", "/")
}

const WASM_PRELOAD_URL = findWasmUrl()
if (WASM_PRELOAD_URL) {
  console.log(`Preloading ${WASM_PRELOAD_URL} from the HTML shell`)
}

// The expo-sqlite worker chunk is fetched when the database opens (after the
// bundle boots); preloading it warms the HTTP cache during the bundle download.
// A/B tested against no preload: adds ~1pt of perf variance on mobile
// (throttled) while reducing cold mid-boot latency on fast connections — kept
// on by default, disable with PRELOAD_WORKER=0.
const PRELOAD_WORKER = process.env.PRELOAD_WORKER !== "0"
function findWorkerUrl() {
  const webDir = join(ROOT, "_expo", "static", "js", "web")
  if (!existsSync(webDir)) return null
  const file = readdirSync(webDir).find(
    (name) => name.startsWith("worker-") && name.endsWith(".js"),
  )
  if (!file) return null
  return "/_expo/static/js/web/" + file
}

const WORKER_PRELOAD_URL = PRELOAD_WORKER ? findWorkerUrl() : null
if (WORKER_PRELOAD_URL) {
  console.log(`Preloading ${WORKER_PRELOAD_URL} from the HTML shell`)
}

const BROTLI_QUALITY = 5
const compressCache = new Map()
const agentMiddleware = createAgentMiddleware(createSnapshotStore())

function decorateHtml(raw) {
  let out = raw
  if (WASM_PRELOAD_URL && !out.includes('rel="preload" href="' + WASM_PRELOAD_URL + '"')) {
    out = out.replace(
      "</head>",
      `<link rel="preload" href="${WASM_PRELOAD_URL}" as="fetch" crossorigin="use-credentials">\n</head>`,
    )
  }
  if (WORKER_PRELOAD_URL && !out.includes('rel="preload" href="' + WORKER_PRELOAD_URL + '"')) {
    out = out.replace(
      "</head>",
      `<link rel="preload" href="${WORKER_PRELOAD_URL}" as="script">\n</head>`,
    )
  }
  return out
}

createServer((req, res) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless")
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin")

  // Agent API + MCP take the request when they recognize the path.
  const fallback = (innerReq, innerRes) => {
    const innerUrl = decodeURIComponent(
      new URL(innerReq.url ?? "/", `http://localhost:${PORT}`).pathname,
    )
    if (innerUrl.startsWith(YAZIO_PROXY_PREFIX)) {
      proxyYazioRequest(innerReq, innerRes).catch((error) => {
        console.error("[yazio-proxy]", error)
        if (!innerRes.headersSent) {
          innerRes.statusCode = 502
          innerRes.end("YAZIO proxy error")
        }
      })
      return
    }
    serveStatic(innerReq, innerRes, innerUrl)
  }

  agentMiddleware(req, res, fallback).catch((error) => {
    console.error("[agent-api]", error)
    if (!res.headersSent) {
      res.statusCode = 502
      res.end("Agent API error")
    }
  })
}).listen(PORT, () => {
  console.log(`Dietinator web build served at http://localhost:${PORT}`)
  console.log(
    "E2E: npm run test:e2e  |  Dev loop: npm run dev:web  |  Iterate: npm run test:e2e:dev",
  )
})
