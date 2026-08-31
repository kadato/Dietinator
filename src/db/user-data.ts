import { getDatabase } from "./database"

/** True when any user-scoped table holds rows. Used to detect leaks on first tracked login. */
export async function hasAnyUserData(): Promise<boolean> {
  const db = await getDatabase()
  const [diary, weight, water, food, meals, chat] = await Promise.all([
    db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM diary_entries"),
    db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM weight_entries"),
    db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM water_log"),
    db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM food_cache"),
    db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM meals"),
    db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM ai_chat_messages"),
  ])
  return (
    Number(diary?.c ?? 0) > 0 ||
    Number(weight?.c ?? 0) > 0 ||
    Number(water?.c ?? 0) > 0 ||
    Number(food?.c ?? 0) > 0 ||
    Number(meals?.c ?? 0) > 0 ||
    Number(chat?.c ?? 0) > 0
  )
}

/** True when any demo-seeded row exists. Used to heal installs that leaked before per-user tracking. */
export async function hasDemoData(): Promise<boolean> {
  const db = await getDatabase()
  const [diary, weight, water, meals, food] = await Promise.all([
    db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM diary_entries WHERE id LIKE 'demo-%'",
    ),
    db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM weight_entries WHERE id LIKE 'demo-%'",
    ),
    db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM water_log WHERE id LIKE 'demo-%'"),
    db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM meals WHERE id LIKE 'demo-%'"),
    db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM food_cache WHERE yazio_product_id LIKE 'demo-%'",
    ),
  ])
  return (
    Number(diary?.c ?? 0) > 0 ||
    Number(weight?.c ?? 0) > 0 ||
    Number(water?.c ?? 0) > 0 ||
    Number(meals?.c ?? 0) > 0 ||
    Number(food?.c ?? 0) > 0
  )
}

/** Remove only demo-seeded rows. Used to auto-heal a real account that already leaked demo data. */
export async function clearDemoData(): Promise<void> {
  const db = await getDatabase()
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM diary_entries WHERE id LIKE 'demo-%';
      DELETE FROM weight_entries WHERE id LIKE 'demo-%';
      DELETE FROM water_log WHERE id LIKE 'demo-%';
      DELETE FROM meals WHERE id LIKE 'demo-%';
      DELETE FROM meal_items WHERE meal_id LIKE 'demo-%';
      DELETE FROM food_cache WHERE yazio_product_id LIKE 'demo-%';
    `)
    // Demo also seeds ai_chat_messages without demo- ids; clear them only when healing,
    // because a real account should not see the demo's sample conversation.
    // The demo's two messages are the only ones that exist right after a leak, so
    // clearing all chats here is safe and avoids fragile content matching.
    const chatCount = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM ai_chat_messages",
    )
    if (Number(chatCount?.c ?? 0) > 0) {
      // Only clear chats if demo data is present - caller already checked hasDemoData,
      // so this is specifically healing a leaked demo.
      await db.execAsync("DELETE FROM ai_chat_messages")
    }
  })
}

/** Wipe every per-user table and reset **all** settings to defaults so no account leaks into the next. */
export async function clearAllUserData(): Promise<void> {
  const db = await getDatabase()
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM diary_entries;
      DELETE FROM weight_entries;
      DELETE FROM water_log;
      DELETE FROM food_cache;
      DELETE FROM meals;
      DELETE FROM meal_items;
      DELETE FROM ai_chat_messages;
      DELETE FROM deleted_yazio_items;
    `)
    await db.runAsync(
      `UPDATE settings SET
        calorie_goal = 2000,
        protein_goal = 150,
        carbs_goal = 200,
        fat_goal = 65,
        units = 'metric',
        yazio_sync_enabled = 0,
        food_database_country = '',
        update_check_enabled = 1,
        ai_enabled = 0,
        ai_provider = 'openai',
        ai_base_url = '',
        ai_model = '',
        ai_system_prompt = '',
        agent_bridge_rev = 0,
        theme_preference = 'system',
        water_goal_ml = 2500,
        height_cm = 0,
        target_weight_kg = 0
      WHERE id = 1`,
    )
  })
}
