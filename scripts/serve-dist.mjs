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
import { createReadStream, existsSync, statSync } from "node:fs"
import { join, normalize } from "node:path"
import { gzipSync } from "node:zlib"
import { fileURLToPath } from "node:url"

const PORT = Number(process.env.PORT ?? 8082)
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "dist")

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

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: body?.length ? body : undefined,
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

  // Hashed build assets never change → cache forever. The HTML shell and the
  // service worker must always revalidate so app updates ship immediately.
  if (/^\/_expo\/static\//.test(urlPath)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
  } else if (urlPath === "/" || urlPath.endsWith(".html") || urlPath === "/sw.js") {
    res.setHeader("Cache-Control", "no-cache")
  } else {
    res.setHeader("Cache-Control", "public, max-age=3600")
  }

  if (req.headers["accept-encoding"]?.includes("gzip") && /\.(js|css|html|json|svg)$/.test(ext)) {
    const raw = createReadStream(filePath)
    const chunks = []
    raw.on("data", (c) => chunks.push(c))
    raw.on("end", () => {
      const gzipped = gzipSync(Buffer.concat(chunks))
      res.setHeader("Content-Encoding", "gzip")
      res.setHeader("Content-Length", String(gzipped.length))
      res.end(gzipped)
    })
    raw.on("error", () => {
      res.statusCode = 500
      res.end("Read error")
    })
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

createServer((req, res) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless")
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin")

  const urlPath = decodeURIComponent(new URL(req.url ?? "/", `http://localhost:${PORT}`).pathname)

  if (urlPath.startsWith(YAZIO_PROXY_PREFIX)) {
    proxyYazioRequest(req, res).catch((error) => {
      console.error("[yazio-proxy]", error)
      if (!res.headersSent) {
        res.statusCode = 502
        res.end("YAZIO proxy error")
      }
    })
    return
  }

  serveStatic(req, res, urlPath)
}).listen(PORT, () => {
  console.log(`Dietinator web build served at http://localhost:${PORT}`)
  console.log(
    "E2E: npm run test:e2e  |  Dev loop: npm run dev:web  |  Iterate: npm run test:e2e:dev",
  )
})
