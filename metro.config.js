// Polyfill runs in scripts/polyfill-os.cjs before Expo CLI loads. metro.config.js is too late for it.
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const YAZIO_API_BASE = "https://yzapi.yazio.com/v15"
const YAZIO_PROXY_PREFIX = "/api/yazio"

// MCP server and agent snapshot bridge. Shared with scripts/serve-dist.mjs.
const { createSnapshotStore, createAgentMiddleware } = require("./scripts/mcp-server.cjs")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// The Node native watcher is slow on Windows with this repo's about 460k files.
// Watch startup can outrun Metro's 4-minute timeout and the server crashes.
// Watchman is installed and fast. Use it for the file-map crawl and watch.
config.resolver.useWatchman = true

// On Windows, pnpm deep node_modules plus the per-process file-handle
// limit, about 8K on this machine, can trigger EMFILE during Metro crawl and
// concurrent dev SSR renders. Capping workers keeps peak concurrent file
// opens low. Transforms are still fast with 2.
config.maxWorkers = 2

// Required for expo-sqlite on web (wa-sqlite.wasm).
config.resolver.assetExts.push("wasm")

// react-native-svg fetchData.ts imports `buffer` on native. Alias it to the
// npm polyfill. This is the documented react-native-svg setup for Expo.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve("buffer/"),
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
  const requestUrl = new URL(req.url ?? "/", "http://localhost")
  const targetPath = requestUrl.pathname.replace(YAZIO_PROXY_PREFIX, "") + requestUrl.search
  const targetUrl = `${YAZIO_API_BASE}${targetPath}`

  const headers = { ...req.headers }
  delete headers.host
  delete headers.connection

  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  const body = hasBody ? await readRequestBody(req) : undefined

  // A hung upstream must fail fast as a 502, not leave the browser spinning.
  // The app wraps YAZIO calls in withRetry and will retry a 502.
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

// SharedArrayBuffer requires cross-origin isolation headers.
config.server.enhanceMiddleware = (middleware) => {
  const agentMiddleware = createAgentMiddleware(createSnapshotStore())
  const fs = require("fs")
  const path = require("path")
  const publicDir = path.join(__dirname, "public")
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless")
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin")

    // Dev PWA assets: manifest icon at /assets/icon.png lives in public/assets.
    // Metro's asset pipeline serves hashed Expo assets, not the plain public file,
    // so the browser's manifest fetch would 404 without this static fallback.
    try {
      const urlPath = req.url?.split("?")[0]?.split("#")[0]
      if (
        urlPath &&
        urlPath !== "/" &&
        !urlPath.startsWith("/api/") &&
        !urlPath.startsWith("/_expo/")
      ) {
        const filePath = path.join(publicDir, urlPath)
        if (
          filePath.startsWith(publicDir) &&
          fs.existsSync(filePath) &&
          fs.statSync(filePath).isFile()
        ) {
          const ext = path.extname(filePath).toLowerCase()
          const mime =
            ext === ".png"
              ? "image/png"
              : ext === ".json"
                ? "application/json"
                : ext === ".ico"
                  ? "image/x-icon"
                  : ext === ".js"
                    ? "application/javascript"
                    : "application/octet-stream"
          res.setHeader("Content-Type", mime)
          fs.createReadStream(filePath).pipe(res)
          return
        }
      }
    } catch {}

    // Agent API, then YAZIO proxy, then Metro. Only when nothing above handled it.
    const fallback = (innerReq, innerRes) => {
      if (innerReq.url?.startsWith(YAZIO_PROXY_PREFIX)) {
        proxyYazioRequest(innerReq, innerRes).catch((error) => {
          console.error("[yazio-proxy]", error)
          if (!innerRes.headersSent) {
            innerRes.statusCode = 502
            innerRes.end("YAZIO proxy error")
          }
        })
        return
      }
      return middleware(innerReq, innerRes, next)
    }

    agentMiddleware(req, res, fallback).catch((error) => {
      console.error("[agent-api]", error)
      if (!res.headersSent) {
        res.statusCode = 502
        res.end("Agent API error")
      }
    })
    return
  }
}

module.exports = withNativeWind(config, { input: "./global.css" })
