import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { getDatabase } from "@/db/database"
import { getSettings, updateSettings } from "@/db/settings"
import type { AppSettings } from "@/types"
import { isLoggedIn } from "@/services/yazio/auth-storage"
import { initYazioClient as setupClient } from "@/services/yazio/client"
import { pushSnapshot } from "@/services/agent-bridge"

type AppContextValue = {
  ready: boolean
  authenticated: boolean
  settings: AppSettings
  yazioAvailable: boolean
  refreshAuth: () => Promise<void>
  refreshSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  setYazioAvailable: (value: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [settings, setSettings] = useState<AppSettings>({
    calorie_goal: 2000,
    protein_goal: 150,
    carbs_goal: 200,
    fat_goal: 65,
    units: "metric",
    yazio_sync_enabled: 0,
    food_database_country: "",
    update_check_enabled: 1,
    ai_enabled: 0,
    ai_provider: "openai",
    ai_base_url: "",
    ai_model: "",
    ai_system_prompt: "",
    agent_bridge_rev: 0,
    theme_preference: "system",
    water_goal_ml: 2500,
    height_cm: 0,
    target_weight_kg: 0,
  })
  const [yazioAvailable, setYazioAvailable] = useState(true)

  const refreshSettings = useCallback(async () => {
    const next = await getSettings()
    setSettings(next)
  }, [])

  const refreshAuth = useCallback(async () => {
    const loggedIn = await isLoggedIn()
    setAuthenticated(loggedIn)
    if (loggedIn) {
      await setupClient()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // All three reads are local, so boot takes as long as the slowest one.
        await Promise.all([getDatabase(), refreshSettings(), refreshAuth()])
      } catch {
        // Boot must never hang on a failure. A spinner with no recovery is worse
        // than starting up with local-only state.
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    // Web-host agent bridge: publish the initial snapshot so the /mcp endpoint
    // answers from the very first session.
    pushSnapshot().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [refreshAuth, refreshSettings])

  const updateSettingsFn = useCallback(
    async (partial: Partial<AppSettings>) => {
      await updateSettings(partial)
      await refreshSettings()
    },
    [refreshSettings],
  )

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      settings,
      yazioAvailable,
      refreshAuth,
      refreshSettings,
      updateSettings: updateSettingsFn,
      setYazioAvailable,
    }),
    [
      ready,
      authenticated,
      settings,
      yazioAvailable,
      refreshAuth,
      refreshSettings,
      updateSettingsFn,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
