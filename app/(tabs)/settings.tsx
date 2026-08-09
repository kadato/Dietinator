import { useEffect, useState, type ComponentProps, type ReactNode } from "react"
import { Platform, Pressable, ScrollView, Share, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { useUpdates } from "@/context/UpdateContext"
import { getCurrentVersion } from "@/services/updates"
import { logoutYazio, getYazioProfile } from "@/services/yazio/client"
import { importFromYazio, syncPendingEntries } from "@/services/yazio/sync"
import { toDateKey } from "@/utils/date"
import { exportDiaryCsv, exportDiaryJson } from "@/services/diary"
import { clearFoodCache } from "@/db/food-cache"
import { createBackup, restoreBackup } from "@/services/backup"
import { pickBackupFile, saveBackupFile } from "@/services/backup-files"
import { clearChatMessages } from "@/db/ai-chat"
import {
  AI_PROVIDER_IDS,
  AI_PROVIDER_PRESETS,
  getAiProviderSettings,
  presetFor,
  saveAiApiKey,
} from "@/db/ai-settings"
import { fetchAvailableModels, testProviderConnection } from "@/services/ai/openai-client"
import type { AiProviderId, AiProviderSettings, AppSettings } from "@/types"
import { PageContainer } from "@/components/PageContainer"
import { SettingsSection } from "@/components/SettingsSection"
import { FoodDatabaseCountryPicker } from "@/components/FoodDatabaseCountryPicker"
import { SegmentedControl } from "@/components/SegmentedControl"
import {
  getFoodDatabaseCountryLabel,
  resolveFoodDatabaseCountry,
} from "@/utils/food-database-country"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { confirmAction } from "@/utils/confirm"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Input, InputField } from "@ui/input"
import { Button, ButtonText } from "@ui/button"
import { Switch } from "@ui/switch"

type IconName = ComponentProps<typeof Ionicons>["name"]

function SettingsRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  danger = false,
  last = false,
  accessibilityLabel,
}: {
  icon: IconName
  title: string
  subtitle?: string
  right?: ReactNode
  onPress?: () => void
  danger?: boolean
  last?: boolean
  accessibilityLabel?: string
}) {
  const { colors } = useTheme()
  const tint = danger ? colors.danger : colors.primary

  const content = (
    <>
      <Box className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background-muted">
        <Ionicons name={icon} size={20} color={tint} />
      </Box>
      <Box className="min-w-0 flex-1">
        <Text size="sm" className="text-typography-900">
          {title}
        </Text>
        {subtitle ? (
          <Text size="xs" className="mt-0.5 leading-4 text-typography-500">
            {subtitle}
          </Text>
        ) : null}
      </Box>
      {right}
    </>
  )

  const rowClassName = `flex-row items-center gap-3 px-4 py-3.5 ${
    !last ? "border-b border-outline-100" : ""
  }`

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        className={`${rowClassName} active:opacity-70`}
      >
        {content}
      </Pressable>
    )
  }

  return <View className={rowClassName}>{content}</View>
}

function GoalInput({
  icon,
  label,
  value,
  onChange,
  last = false,
}: {
  icon: IconName
  label: string
  value: string
  onChange: (v: string) => void
  last?: boolean
}) {
  const { isWide } = useLayout()
  const { colors: themeColors } = useTheme()
  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 ${!last ? "border-b border-outline-100" : ""}`}
    >
      <Box className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background-muted">
        <Ionicons name={icon} size={20} color={themeColors.primary} />
      </Box>
      <Text size="sm" className="min-w-0 flex-1 text-typography-900">
        {label}
      </Text>
      <Input size="sm" variant="outline" className={isWide ? "w-[140px]" : "w-[100px]"}>
        <InputField
          keyboardType="numeric"
          value={value}
          onChangeText={onChange}
          className="text-right"
          accessibilityLabel={`${label} goal`}
          maxFontSizeMultiplier={1.4}
        />
      </Input>
    </View>
  )
}

function SettingsField({
  label,
  children,
  last = false,
}: {
  label: string
  children: ReactNode
  last?: boolean
}) {
  return (
    <View className={`px-4 py-3.5 ${!last ? "border-b border-outline-100" : ""}`}>
      <Text size="xs" className="mb-1.5 text-typography-500">
        {label}
      </Text>
      {children}
    </View>
  )
}

const SETTINGS_TABS = [
  { id: "goals", label: "Goals", icon: "flag-outline" },
  { id: "general", label: "General", icon: "options-outline" },
  { id: "ai", label: "AI", icon: "sparkles-outline" },
  { id: "sync", label: "Sync", icon: "sync-outline" },
  { id: "data", label: "Data", icon: "folder-open-outline" },
  { id: "about", label: "About", icon: "information-circle-outline" },
] as const

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"]

/**
 * Goals tab owns its own form state so typing in one field never re-renders
 * the rest of the settings screen. Values re-sync when settings change
 * elsewhere (e.g. a YAZIO import) via the React-recommended
 * "adjust state during render" pattern.
 */
function GoalsSettings({ settings }: { settings: AppSettings }) {
  const { updateSettings } = useApp()
  const { showError, showSuccess } = useToast()
  const { colors } = useTheme()
  const [calorieGoal, setCalorieGoal] = useState(String(settings.calorie_goal))
  const [proteinGoal, setProteinGoal] = useState(String(settings.protein_goal))
  const [carbsGoal, setCarbsGoal] = useState(String(settings.carbs_goal))
  const [fatGoal, setFatGoal] = useState(String(settings.fat_goal))
  const [goalError, setGoalError] = useState<string | null>(null)

  const goalsKey = `${settings.calorie_goal}|${settings.protein_goal}|${settings.carbs_goal}|${settings.fat_goal}`
  const [syncedGoalsKey, setSyncedGoalsKey] = useState(goalsKey)
  if (goalsKey !== syncedGoalsKey) {
    setSyncedGoalsKey(goalsKey)
    setCalorieGoal(String(settings.calorie_goal))
    setProteinGoal(String(settings.protein_goal))
    setCarbsGoal(String(settings.carbs_goal))
    setFatGoal(String(settings.fat_goal))
  }

  const saveGoals = async () => {
    const values = {
      calorie_goal: Number(calorieGoal),
      protein_goal: Number(proteinGoal),
      carbs_goal: Number(carbsGoal),
      fat_goal: Number(fatGoal),
    }
    if (
      !values.calorie_goal ||
      values.calorie_goal <= 0 ||
      !values.protein_goal ||
      values.protein_goal <= 0 ||
      !values.carbs_goal ||
      values.carbs_goal <= 0 ||
      !values.fat_goal ||
      values.fat_goal <= 0
    ) {
      setGoalError("All goals must be positive numbers.")
      return
    }
    setGoalError(null)
    try {
      await updateSettings(values)
      showSuccess("Goals updated.", "Saved")
    } catch (error) {
      showError(error, "Could not save goals.")
    }
  }

  return (
    <SettingsSection title="Daily goals">
      <GoalInput
        icon="flame-outline"
        label="Calories (kcal)"
        value={calorieGoal}
        onChange={setCalorieGoal}
      />
      <GoalInput
        icon="fish-outline"
        label="Protein (g)"
        value={proteinGoal}
        onChange={setProteinGoal}
      />
      <GoalInput
        icon="nutrition-outline"
        label="Carbs (g)"
        value={carbsGoal}
        onChange={setCarbsGoal}
      />
      <GoalInput icon="water-outline" label="Fat (g)" value={fatGoal} onChange={setFatGoal} last />
      <View className="gap-2 border-t border-outline-100 p-4">
        {goalError ? (
          <Text size="sm" bold className="mb-1" style={{ color: colors.danger }}>
            {goalError}
          </Text>
        ) : null}
        <Button size="md" onPress={saveGoals}>
          <ButtonText>Save goals</ButtonText>
        </Button>
      </View>
    </SettingsSection>
  )
}

/** AI tab form — isolated state so typing an API key or model never re-renders the screen. */
function AiSettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter()
  const { updateSettings } = useApp()
  const { showError, showSuccess } = useToast()
  const { colors } = useTheme()
  const [aiBaseUrl, setAiBaseUrl] = useState("")
  const [aiModel, setAiModel] = useState("")
  const [aiApiKey, setAiApiKey] = useState("")
  const [aiSystemPrompt, setAiSystemPrompt] = useState("")
  const [aiProvider, setAiProvider] = useState<AiProviderId>("custom")
  const [aiFormLoaded, setAiFormLoaded] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const provider: AiProviderSettings = await getAiProviderSettings()
        if (cancelled) return
        setAiBaseUrl(provider.base_url)
        setAiModel(provider.model)
        setAiSystemPrompt(provider.system_prompt)
        setAiProvider(provider.provider)
        setAiFormLoaded(true)
      } catch {
        if (!cancelled) setAiFormLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const aiSettingsForTest = (): AiProviderSettings => ({
    enabled: true,
    provider: aiProvider,
    base_url: aiBaseUrl.trim() || presetFor(aiProvider).base_url,
    api_key: aiApiKey.trim(),
    model: aiModel.trim() || presetFor(aiProvider).model,
    system_prompt: aiSystemPrompt,
  })

  const selectAiProvider = (provider: AiProviderId) => {
    setAiProvider(provider)
    setAiBaseUrl(AI_PROVIDER_PRESETS[provider].base_url)
    setAiModel(AI_PROVIDER_PRESETS[provider].model)
    setFetchedModels([])
    setTestResult(null)
  }

  const fetchAiModels = async () => {
    if (!aiApiKey.trim()) {
      setAiError("Add an API key first, then fetch the model list.")
      return
    }
    setAiError(null)
    setFetchingModels(true)
    try {
      const models = await fetchAvailableModels(aiSettingsForTest())
      setFetchedModels(models)
      if (models.length === 0) {
        setAiError("No models returned — the endpoint may not expose a model list.")
      }
    } catch {
      setAiError("Could not fetch models from this endpoint.")
    } finally {
      setFetchingModels(false)
    }
  }

  const testAiConnection = async () => {
    setAiError(null)
    setTestResult(null)
    setTestingConnection(true)
    try {
      setTestResult(await testProviderConnection(aiSettingsForTest()))
    } finally {
      setTestingConnection(false)
    }
  }

  const saveAiSettings = async () => {
    if (!aiBaseUrl.trim()) {
      setAiError("Base URL is required (e.g. https://api.openai.com/v1).")
      return
    }
    if (!aiModel.trim()) {
      setAiError("Model name is required (e.g. gpt-4o-mini).")
      return
    }
    setAiError(null)
    setAiSaving(true)
    try {
      await Promise.all([
        updateSettings({
          ai_provider: aiProvider,
          ai_base_url: aiBaseUrl.trim(),
          ai_model: aiModel.trim(),
          ai_system_prompt: aiSystemPrompt.trim(),
        }),
        saveAiApiKey(aiApiKey),
      ])
      setTestResult(null)
      showSuccess("AI assistant settings saved.", "Saved")
    } catch (error) {
      showError(error, "Could not save AI settings.")
    } finally {
      setAiSaving(false)
    }
  }

  if (!aiFormLoaded) return null

  return (
    <View className="border-t border-outline-100">
      <SettingsField label="Provider preset">
        <Box className="flex-row flex-wrap gap-1.5">
          {AI_PROVIDER_IDS.map((provider) => {
            const selected = provider === aiProvider
            return (
              <Pressable
                key={provider}
                onPress={() => selectAiProvider(provider)}
                accessibilityRole="button"
                accessibilityLabel={`AI provider ${provider}`}
                accessibilityState={{ selected }}
                className={`rounded-full border px-3 py-1.5 active:opacity-80 ${
                  selected
                    ? "border-primary-500 bg-primary-500/10"
                    : "border-outline-200 bg-background-50"
                }`}
              >
                <Text
                  size="xs"
                  bold={selected}
                  style={{ color: selected ? colors.primary : colors.textMuted }}
                >
                  {AI_PROVIDER_PRESETS[provider].label}
                </Text>
              </Pressable>
            )
          })}
        </Box>
        <Text size="xs" className="mt-2 text-typography-500">
          Picking a preset fills the base URL and a default model. Then add your API key.
        </Text>
      </SettingsField>
      <SettingsField label="Base URL (OpenAI, OpenRouter, Ollama…)">
        <Input size="sm" variant="outline">
          <InputField
            value={aiBaseUrl}
            onChangeText={setAiBaseUrl}
            placeholder="https://api.openai.com/v1"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="AI provider base URL"
            maxFontSizeMultiplier={1.4}
          />
        </Input>
      </SettingsField>
      <SettingsField label="Model">
        <Input size="sm" variant="outline">
          <InputField
            value={aiModel}
            onChangeText={setAiModel}
            placeholder="gpt-4o-mini"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="AI model name"
            maxFontSizeMultiplier={1.4}
          />
        </Input>
        {fetchedModels.length > 0 ? (
          <Box className="mt-2 flex-row flex-wrap gap-1.5">
            {fetchedModels.map((model) => (
              <Pressable
                key={model}
                onPress={() => setAiModel(model)}
                accessibilityRole="button"
                accessibilityLabel={`Use model ${model}`}
                className={`rounded-full border px-2.5 py-1 active:opacity-80 ${
                  model === aiModel
                    ? "border-primary-500 bg-primary-500/10"
                    : "border-outline-200 bg-background-50"
                }`}
              >
                <Text
                  size="xs"
                  style={{ color: model === aiModel ? colors.primary : colors.textMuted }}
                >
                  {model}
                </Text>
              </Pressable>
            ))}
          </Box>
        ) : null}
      </SettingsField>
      <SettingsField label="API key (stored in the device keystore)">
        <Box className="flex-row items-center gap-2">
          <Box className="flex-1">
            <Input size="sm" variant="outline">
              <InputField
                value={aiApiKey}
                onChangeText={(value) => {
                  setAiApiKey(value)
                  setTestResult(null)
                }}
                placeholder="sk-…"
                secureTextEntry={!showApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="AI API key"
                maxFontSizeMultiplier={1.4}
              />
            </Input>
          </Box>
          <Pressable
            onPress={() => setShowApiKey((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showApiKey ? "Hide API key" : "Show API key"}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-background-100"
          >
            <Ionicons
              name={showApiKey ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        </Box>
      </SettingsField>
      <SettingsField label="Extra instructions (optional)" last>
        <Input size="sm" variant="outline">
          <InputField
            value={aiSystemPrompt}
            onChangeText={setAiSystemPrompt}
            placeholder="e.g. Keep answers short and use metric units"
            multiline
            accessibilityLabel="AI extra instructions"
          />
        </Input>
      </SettingsField>
      <View className="gap-2 border-t border-outline-100 p-4">
        {aiError ? (
          <Text size="sm" bold className="mb-1" style={{ color: colors.danger }}>
            {aiError}
          </Text>
        ) : null}
        {testResult ? (
          <Box className="flex-row items-center gap-2 rounded-xl border border-outline-100 bg-background-50 px-3 py-2">
            <Ionicons
              name={testResult.ok ? "checkmark-circle" : "close-circle"}
              size={18}
              color={testResult.ok ? colors.primary : colors.danger}
            />
            <Text size="xs" className="flex-1 text-typography-600">
              {testResult.message}
            </Text>
          </Box>
        ) : null}
        <Button size="md" onPress={saveAiSettings} disabled={aiSaving}>
          <ButtonText>{aiSaving ? "Saving…" : "Save AI settings"}</ButtonText>
        </Button>
        <Box className="flex-row flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            action="secondary"
            className="min-w-[140px] flex-1"
            onPress={() => void fetchAiModels()}
            disabled={fetchingModels}
          >
            <ButtonText>{fetchingModels ? "Fetching…" : "Fetch models"}</ButtonText>
          </Button>
          <Button
            size="sm"
            variant="outline"
            action="secondary"
            className="min-w-[140px] flex-1"
            onPress={() => void testAiConnection()}
            disabled={testingConnection}
          >
            <ButtonText>{testingConnection ? "Testing…" : "Test connection"}</ButtonText>
          </Button>
          <Button
            size="sm"
            variant="outline"
            action="secondary"
            className="min-w-[140px] flex-1"
            onPress={() => router.push("/ai-chat")}
          >
            <ButtonText>Open AI chat</ButtonText>
          </Button>
          <Button
            size="sm"
            variant="outline"
            action="secondary"
            className="min-w-[140px] flex-1"
            onPress={() =>
              confirmAction({
                title: "Clear chat history?",
                message: "Removes the saved AI conversation from this device.",
                confirmLabel: "Clear",
                onConfirm: async () => {
                  try {
                    await clearChatMessages()
                    showSuccess("Chat history cleared.", "Done")
                  } catch (error) {
                    showError(error, "Could not clear chat history.")
                  }
                },
              })
            }
          >
            <ButtonText>Clear chat history</ButtonText>
          </Button>
        </Box>
      </View>
    </View>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { settings, updateSettings, refreshAuth, refreshSettings } = useApp()
  const { showSuccess, showError } = useToast()
  const { checking, checkForUpdates } = useUpdates()
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const insets = useSafeAreaInsets()
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [profileCountry, setProfileCountry] = useState<string | null>(null)
  const [mcpExpanded, setMcpExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTabId>("goals")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const profile = await getYazioProfile()
        if (!cancelled) {
          setProfileCountry(profile?.food_database_country ?? null)
        }
      } catch {
        if (!cancelled) setProfileCountry(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const effectiveCountry = resolveFoodDatabaseCountry(
    settings.food_database_country,
    profileCountry,
  )
  const countryUsesProfileDefault = !settings.food_database_country?.trim()

  const handleLogout = async () => {
    try {
      await logoutYazio()
    } catch (error) {
      showError(error, "Could not clear stored credentials.", "Sign out")
    }
    await refreshAuth()
    router.replace("/login")
  }

  const handleExport = async (format: "json" | "csv") => {
    try {
      const content = format === "json" ? await exportDiaryJson() : await exportDiaryCsv()
      await Share.share({ message: content, title: `diary-export.${format}` })
    } catch (error) {
      showError(error, "Could not export diary.")
    }
  }

  const handleBackup = async () => {
    try {
      const payload = await createBackup()
      await saveBackupFile(payload)
      showSuccess("Backup saved — keep it somewhere safe.", "Backup created")
    } catch (error) {
      showError(error, "Could not create backup.")
    }
  }

  const handleRestore = async () => {
    try {
      const content = await pickBackupFile()
      let payload: unknown
      try {
        payload = JSON.parse(content)
      } catch {
        throw new Error("This file is not valid JSON.")
      }
      const { diaryEntries, foodCache, meals } = await restoreBackup(payload)
      await Promise.all([refreshSettings(), refreshAuth()])
      showSuccess(
        `Restored ${diaryEntries} diary entries, ${foodCache} cached foods and ${meals} meals.`,
        "Backup restored",
      )
    } catch (error) {
      showError(error, "Could not restore backup.")
    }
  }

  return (
    <ScrollView className="flex-1 bg-background-0" contentContainerClassName="pb-16">
      <PageContainer
        grow={false}
        contentStyle={[
          { padding: 16, paddingTop: insets.top + 24 },
          isWide ? { maxWidth: 860 } : undefined,
        ]}
      >
        <Box className="-mx-4 mb-6 flex-row flex-wrap gap-1.5 px-4">
          {SETTINGS_TABS.map((tab) => {
            const active = tab.id === activeTab
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                accessibilityRole="button"
                accessibilityLabel={`${tab.label} settings`}
                accessibilityState={{ selected: active }}
                className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 active:opacity-80 ${
                  active
                    ? "border-primary-500 bg-primary-500/10"
                    : "border-outline-200 bg-background-50"
                }`}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={active ? colors.primary : colors.textMuted}
                />
                <Text
                  size="sm"
                  bold={active}
                  style={{ color: active ? colors.primary : colors.textMuted }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            )
          })}
        </Box>

        {activeTab === "goals" ? <GoalsSettings settings={settings} /> : null}

        {activeTab === "general" ? (
          <SettingsSection title="Preferences">
            <SettingsRow
              icon="globe-outline"
              title="Food database country"
              subtitle={
                countryUsesProfileDefault && profileCountry
                  ? `Using your YAZIO profile (${getFoodDatabaseCountryLabel(profileCountry)}) until you pick one`
                  : getFoodDatabaseCountryLabel(effectiveCountry)
              }
              onPress={() => setCountryPickerOpen(true)}
              accessibilityLabel="Change food database country"
              right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            />
            <SettingsRow
              icon="speedometer-outline"
              title="Units"
              subtitle={
                settings.units === "imperial"
                  ? "Weight and water in pounds and fluid ounces"
                  : "Weight and water in kilograms and liters"
              }
              right={
                <SegmentedControl
                  value={settings.units === "imperial" ? "imperial" : "metric"}
                  options={[
                    { value: "metric", label: "Metric" },
                    { value: "imperial", label: "Imperial" },
                  ]}
                  onChange={async (units) => {
                    try {
                      await updateSettings({ units })
                    } catch (error) {
                      showError(error, "Could not update units.")
                    }
                  }}
                />
              }
            />
            <SettingsRow
              icon="contrast-outline"
              title="Theme"
              subtitle={
                settings.theme_preference === "light"
                  ? "Always light"
                  : settings.theme_preference === "dark"
                    ? "Always dark"
                    : "Follow your device setting"
              }
              last
              right={
                <SegmentedControl
                  value={settings.theme_preference ?? "system"}
                  options={[
                    { value: "system", label: "System" },
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ]}
                  onChange={async (theme) => {
                    try {
                      await updateSettings({ theme_preference: theme })
                    } catch (error) {
                      showError(error, "Could not update theme.")
                    }
                  }}
                />
              }
            />
          </SettingsSection>
        ) : null}

        {activeTab === "general" ? (
          <SettingsSection title="Updates">
            <SettingsRow
              icon="arrow-down-circle-outline"
              title="Check for updates"
              subtitle="Look for new versions on GitHub when the app starts"
              right={
                <Switch
                  value={settings.update_check_enabled === 1}
                  accessibilityLabel="Check for updates on startup"
                  onValueChange={async (v) => {
                    try {
                      await updateSettings({ update_check_enabled: v ? 1 : 0 })
                    } catch (error) {
                      showError(error, "Could not update update-check setting.")
                    }
                  }}
                />
              }
            />
            <SettingsRow
              icon="refresh-outline"
              title={checking ? "Checking…" : "Check now"}
              subtitle={`Version ${getCurrentVersion()} · releases on GitHub`}
              last
              onPress={() => void checkForUpdates({ manual: true })}
              accessibilityLabel="Check for updates now"
            />
          </SettingsSection>
        ) : null}

        <FoodDatabaseCountryPicker
          visible={countryPickerOpen}
          selectedCode={effectiveCountry}
          onClose={() => setCountryPickerOpen(false)}
          onSelect={async (code) => {
            try {
              await updateSettings({ food_database_country: code })
              setProfileCountry(null)
              showSuccess(`Search now uses ${getFoodDatabaseCountryLabel(code)}.`, "Food database")
            } catch (error) {
              showError(error, "Could not save food database country.")
            }
          }}
        />

        {activeTab === "ai" ? (
          <SettingsSection title="AI assistant">
            <SettingsRow
              icon="sparkles-outline"
              title="AI assistant"
              subtitle="Chat with your diary on device. Your API key never leaves the app"
              right={
                <Switch
                  value={settings.ai_enabled === 1}
                  accessibilityLabel="Enable AI assistant"
                  onValueChange={async (v) => {
                    try {
                      await updateSettings({ ai_enabled: v ? 1 : 0 })
                    } catch (error) {
                      showError(error, "Could not update AI setting.")
                    }
                  }}
                />
              }
              last={!settings.ai_enabled}
            />

            {settings.ai_enabled === 1 ? <AiSettingsForm settings={settings} /> : null}
          </SettingsSection>
        ) : null}

        {activeTab === "sync" ? (
          <SettingsSection title="YAZIO sync">
            <SettingsRow
              icon="sync-outline"
              title="Sync diary to YAZIO"
              subtitle="Upload new entries as you log them (best-effort)"
              right={
                <Switch
                  value={settings.yazio_sync_enabled === 1}
                  accessibilityLabel="Sync diary to YAZIO"
                  onValueChange={async (v) => {
                    try {
                      await updateSettings({ yazio_sync_enabled: v ? 1 : 0 })
                    } catch (error) {
                      showError(error, "Could not update sync setting.")
                    }
                  }}
                />
              }
            />
            <SettingsRow
              icon="cloud-upload-outline"
              title="Sync pending entries now"
              subtitle="Send unsynced diary entries to YAZIO"
              onPress={async () => {
                try {
                  const count = await syncPendingEntries()
                  showSuccess(count === 1 ? "Synced 1 entry." : `Synced ${count} entries.`, "Sync")
                } catch (error) {
                  showError(error, "Could not sync entries to YAZIO.")
                }
              }}
            />
            <SettingsRow
              icon="cloud-download-outline"
              title="Import today from YAZIO"
              subtitle="Pull today's foods and refresh your goals"
              last
              onPress={async () => {
                try {
                  const { imported, skipped, failed } = await importFromYazio(toDateKey())
                  await refreshSettings()
                  const parts = ["Goals updated."]
                  if (imported > 0) {
                    parts.push(
                      imported === 1
                        ? "Imported 1 food for today."
                        : `Imported ${imported} foods for today.`,
                    )
                  } else if (skipped > 0 && failed === 0) {
                    parts.push("Today's foods are already up to date.")
                  }
                  if (failed > 0) {
                    parts.push(`${failed} item(s) could not be loaded.`)
                  }
                  showSuccess(parts.join(" "), "Imported from YAZIO")
                } catch (error) {
                  showError(error, "Could not import from YAZIO.")
                }
              }}
            />
          </SettingsSection>
        ) : null}

        {activeTab === "data" ? (
          <SettingsSection title="Data">
            <SettingsRow
              icon="download-outline"
              title="Export diary (JSON)"
              subtitle="All entries as a JSON file"
              onPress={() => void handleExport("json")}
            />
            <SettingsRow
              icon="document-text-outline"
              title="Export diary (CSV)"
              subtitle="All entries as a spreadsheet file"
              onPress={() => void handleExport("csv")}
            />
            <SettingsRow
              icon="archive-outline"
              title="Back up all data"
              subtitle="Diary, cached foods and meals in one file"
              onPress={handleBackup}
            />
            <SettingsRow
              icon="file-tray-full-outline"
              title="Restore from backup"
              subtitle="Replace local data with a backup file"
              onPress={() =>
                confirmAction({
                  title: "Restore backup?",
                  message:
                    "This replaces all current diary entries, cached foods and meals on this device.",
                  confirmLabel: "Restore",
                  onConfirm: handleRestore,
                })
              }
            />
            <SettingsRow
              icon="trash-outline"
              title="Clear food cache"
              subtitle="Remove cached YAZIO foods"
              danger
              last
              onPress={() => {
                confirmAction({
                  title: "Clear cache?",
                  message: "Removes cached YAZIO foods.",
                  confirmLabel: "Clear",
                  onConfirm: async () => {
                    try {
                      await clearFoodCache()
                      showSuccess("Food cache cleared.", "Done")
                    } catch (error) {
                      showError(error, "Could not clear food cache.")
                    }
                  },
                })
              }}
            />
          </SettingsSection>
        ) : null}

        {activeTab === "about" ? (
          <>
            {Platform.OS === "web" ? (
              <SettingsSection title="Agent API (MCP)">
                <SettingsRow
                  icon="terminal-outline"
                  title="Agent API (MCP)"
                  subtitle="Let AI agents read and log to your diary"
                  last={!mcpExpanded}
                  onPress={() => setMcpExpanded((v) => !v)}
                  accessibilityLabel={
                    mcpExpanded ? "Hide Agent API details" : "Show Agent API details"
                  }
                  right={
                    <Ionicons
                      name={mcpExpanded ? "chevron-down" : "chevron-forward"}
                      size={20}
                      color={colors.textMuted}
                    />
                  }
                />
                {mcpExpanded ? (
                  <View className="gap-1 border-t border-outline-100 p-4">
                    <Text size="sm" className="leading-5 text-typography-500">
                      Point Claude Desktop, Cursor or any MCP client at{" "}
                      <Text size="sm" className="text-typography-900">
                        {getMcpOrigin()}/mcp
                      </Text>{" "}
                      to work with your diary.
                    </Text>
                    <Text size="xs" className="mt-2 leading-4 text-typography-500">
                      Set MCP_API_KEY on the server to protect the endpoint (required in
                      production). The snapshot bridge is same-origin only and never stores data on
                      disk.
                    </Text>
                    <Box className="mt-2 flex-row flex-wrap gap-1.5">
                      {[
                        "get_diary",
                        "get_diary_stats",
                        "get_goals",
                        "get_settings",
                        "get_meals",
                        "log_food",
                        "log_meal",
                        "update_food_entry",
                        "delete_food_entry",
                        "set_goals",
                        "set_units",
                      ].map((tool) => (
                        <Box
                          key={tool}
                          className="rounded-full border border-outline-100 bg-background-50 px-2 py-0.5"
                        >
                          <Text size="xs" className="font-mono text-typography-600">
                            {tool}
                          </Text>
                        </Box>
                      ))}
                    </Box>
                  </View>
                ) : null}
              </SettingsSection>
            ) : null}

            <Button size="lg" variant="outline" action="negative" onPress={handleLogout}>
              <ButtonText>Sign out</ButtonText>
            </Button>
          </>
        ) : null}
      </PageContainer>
    </ScrollView>
  )
}

function getMcpOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }
  return "http://localhost:8082"
}
