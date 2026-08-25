const YAZIO_API_BASE = "https://yzapi.yazio.com/v15"

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const targetPath = url.pathname.replace(/^\/api\/yazio/, "") + url.search
  const targetUrl = `${YAZIO_API_BASE}${targetPath}`

  const headers = new Headers(context.request.headers)
  headers.delete("host")
  headers.delete("connection")
  headers.delete("cf-connecting-ip")
  headers.delete("cf-ray")
  headers.delete("cf-ipcountry")
  headers.delete("x-forwarded-for")
  headers.delete("x-forwarded-proto")

  const hasBody = context.request.method !== "GET" && context.request.method !== "HEAD"
  const body = hasBody ? await context.request.arrayBuffer() : undefined

  let upstream
  try {
    upstream = await fetch(targetUrl, {
      method: context.request.method,
      headers,
      body: body && body.byteLength ? body : undefined,
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    return new Response(`YAZIO proxy error: ${err.message}`, { status: 502 })
  }

  const resHeaders = new Headers(upstream.headers)
  resHeaders.delete("content-encoding")
  resHeaders.delete("content-length")
  resHeaders.delete("transfer-encoding")

  return new Response(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  })
}
