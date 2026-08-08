import { Yazio } from "yazio"

async function main() {
  const client = new Yazio({
    credentials: {
      username: process.env.YAZIO_EMAIL || "csenkoo2001@gmail.com",
      password: process.env.YAZIO_PASSWORD || "Yazio1337!",
    },
  })
  await client.auth.ensureAuthenticated?.()
  const today = new Date().toISOString().slice(0, 10)
  const data = await client.user.getConsumedItems({ date: today })
  const products = data.products || []
  const simples = data.simple_products || []
  const recipes = data.recipe_portions || []
  const items = [
    ...products.map((p) => ({ id: p.id, name: p.product?.name || "?" })),
    ...simples.map((s) => ({ id: s.id, name: s.name || "?" })),
    ...recipes.map((r) => ({ id: r.id, name: r.name || "?" })),
  ]
  console.log("today's consumed items:", items.length)
  for (const item of items) {
    console.log("  ", item.id, item.name)
  }
  for (const item of items) {
    try {
      await client.user.removeConsumedItem(item.id)
      console.log("removed", item.id, item.name)
    } catch (e) {
      console.log("failed", item.id, e.message)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
