export async function onRequest(context) {
  const url = new URL(context.request.url)
  const since = Number(url.searchParams.get("since") || "0")
  const revision = Number.isFinite(since) && since >= 0 ? since : 0
  const body = JSON.stringify({ changes: [], revision })
  return new Response(body, {
    headers: { "content-type": "application/json" },
  })
}
