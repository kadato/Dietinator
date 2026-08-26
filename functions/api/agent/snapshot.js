export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 })
  }
  // Accept the snapshot on Pages. Pages Functions are stateless, so we
  // do not persist it. The local dev server in scripts/mcp-server.cjs keeps
  // the snapshot in memory for /mcp. Returning 204 keeps the web build
  // from logging POST 405 in the console when served from Cloudflare Pages.
  try {
    await context.request.arrayBuffer()
  } catch {
    // ignore body read errors
  }
  return new Response(null, { status: 204 })
}
