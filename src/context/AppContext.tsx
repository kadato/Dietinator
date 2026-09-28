import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { getDatabase } from "@/db/database"
import { getSettings, updateSettings } from "@/db/settings"
import type { AppSettings } from "@/types"
import { getCredentials, isLoggedIn } from "@/services/yazio/auth-storage"
import { initYazioClient as setupClient } from "@/services/yazio/client"
import { healLeakedDemoDataIfNeeded, initializeActiveAccountFromAuth } from "@/services/account"
import { pushSnapshot } from "@/services/agent-bridge"

type AppContextValue = {
  ready: boolean
  dbHealthy: boolean
  bootError: string | null
  authenticated: boolean
  settings: AppSettings
  yazioAvailable: boolean
  refreshAuth: () => Promise<void>
  refreshSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  setYazioAvailable: (value: boolean) => void
  retryBoot: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [dbHealthy, setDbHealthy] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)
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

  const boot = useCallback(async () => {
    setBootError(null)
    try {
      await getDatabase()
      setDbHealthy(true)
    } catch (error) {
      setDbHealthy(false)
      setBootError(error instanceof Error ? error.message : "Database failed to open.")
    }
    const results = await Promise.allSettled([refreshSettings(), refreshAuth()])
    if (results.some((r) => r.status === "rejected")) {
      const first = results.find((r) => r.status === "rejected")
      if (first?.status === "rejected") {
        const message = first.reason instanceof Error ? first.reason.message : "Boot step failed."
        setBootError((prev) => prev ?? message)
      }
    }
    try {
      await initializeActiveAccountFromAuth(getCredentials, isLoggedIn)
    } catch (error) {
      setBootError((prev) => prev ?? (error instanceof Error ? error.message : null))
    }
    try {
      await healLeakedDemoDataIfNeeded()
    } catch (error) {
      setBootError((prev) => prev ?? (error instanceof Error ? error.message : null))
    }
  }, [refreshAuth, refreshSettings])

  const retryBoot = useCallback(async () => {
    setReady(false)
    await boot()
    setReady(true)
  }, [boot])

  useEffect(() => {
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    ;(async () => {
      // Hard fallback: boot must finish even if SQLite or SecureStore hangs
      // after a storage clear. 3.5s is enough for a cold start but short
      // enough that a stuck splash never looks frozen. Health flags still
      // record which step failed so the UI can offer retry.
      timeout = setTimeout(() => {
        if (!cancelled) setReady(true)
      }, 3500)
      try {
        await boot()
      } finally {
        if (timeout) clearTimeout(timeout)
        if (!cancelled) setReady(true)
      }
    })()
    // Web-host agent bridge: publish the initial snapshot so the /mcp endpoint
    // answers from the very first session.
    pushSnapshot().catch(() => undefined)
    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
    }
  }, [boot])

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
      dbHealthy,
      bootError,
      authenticated,
      settings,
      yazioAvailable,
      refreshAuth,
      refreshSettings,
      updateSettings: updateSettingsFn,
      setYazioAvailable,
      retryBoot,
    }),
    [
      ready,
      dbHealthy,
      bootError,
      authenticated,
      settings,
      yazioAvailable,
      refreshAuth,
      refreshSettings,
      updateSettingsFn,
      retryBoot,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
