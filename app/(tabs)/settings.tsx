import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from "react-native"
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
import { NumberStepper } from "@/components/NumberStepper"
import { FoodDatabaseCountryPicker } from "@/components/FoodDatabaseCountryPicker"
import { SegmentedControl } from "@/components/SegmentedControl"
import {
  getFoodDatabaseCountryLabel,
  resolveFoodDatabaseCountry,
} from "@/utils/food-database-country"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { confirmAction } from "@/utils/confirm"
import { formatNumber } from "@/utils/format"
import { computeMacroRatios } from "@/utils/nutrients"
import { spacing } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Card } from "@ui/card"
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
  stackOnNarrow = false,
  accessibilityLabel,
}: {
  icon: IconName
  title: string
  subtitle?: string
  right?: ReactNode
  onPress?: () => void
  danger?: boolean
  last?: boolean
  /** Renders `right` under the text instead of beside it on narrow screens. */
  stackOnNarrow?: boolean
  accessibilityLabel?: string
}) {
  const { colors } = useTheme()
  const { width } = useLayout()
  const tint = danger ? colors.danger : colors.primary
  const stacked = stackOnNarrow && width < 480

  const iconBox = (
    <Box className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background-100">
      <Ionicons name={icon} size={20} color={tint} />
    </Box>
  )
  const titleBox = (
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
  )

  const content = stacked ? (
    <>
      <Box className="w-full flex-row items-center gap-3">
        {iconBox}
        {titleBox}
      </Box>
      {right}
    </>
  ) : (
    <>
      {iconBox}
      {titleBox}
      {right}
    </>
  )

  const rowClassName = `${
    stacked ? "flex-col items-stretch gap-3" : "flex-row items-center gap-3"
  } px-4 py-3.5 ${!last ? "border-b border-outline-100" : ""}`

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        className={`${rowClassName} active:opacity-80`}
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
  onSubmit,
  step,
  min = 0,
  unit,
  last = false,
  error,
  inputWidth = 76,
}: {
  icon: IconName
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  step: number
  min?: number
  unit: string
  last?: boolean
  error?: string
  inputWidth?: number
}) {
  const { colors } = useTheme()

  return (
    <View className={`px-4 py-3.5 ${!last ? "border-b border-outline-100" : ""}`}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <Box className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background-100">
            <Ionicons name={icon} size={20} color={colors.primary} />
          </Box>
          <View className="min-w-0 flex-1">
            <Text size="sm" bold className="text-typography-900">
              {label}
            </Text>
            {unit ? (
              <Text size="xs" className="text-typography-500">
                {unit}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <NumberStepper
            value={value}
            onChangeText={onChange}
            onSubmit={onSubmit}
            step={step}
            min={min}
            size="sm"
            inputWidth={inputWidth}
            accessibilityLabel={`${label} in ${unit}`}
          />
        </View>
      </View>
      {error ? (
        <Text size="xs" bold className="mt-1" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const SETTINGS_SECTIONS = [
  {
    id: "goals",
    label: "Goals & Nutrition",
    icon: "flag-outline" as const,
    getSubtitle: (s: AppSettings) =>
      `${formatNumber(s.calorie_goal)} kcal · ${s.protein_goal}g P · ${s.carbs_goal}g C · ${s.fat_goal}g F`,
  },
  {
    id: "general",
    label: "General & Preferences",
    icon: "options-outline" as const,
    getSubtitle: (s: AppSettings, country: string) =>
      `Database: ${getFoodDatabaseCountryLabel(country)} · ${s.units === "imperial" ? "Imperial" : "Metric"} · Theme: ${s.theme_preference ?? "system"}`,
  },
  {
    id: "ai",
    label: "AI Assistant",
    icon: "sparkles-outline" as const,
    getSubtitle: (s: AppSettings) =>
      s.ai_enabled === 1 ? `Active (${s.ai_provider})` : "Disabled · Chat with diary",
  },
  {
    id: "sync",
    label: "YAZIO Sync",
    icon: "sync-outline" as const,
    getSubtitle: (s: AppSettings) =>
      s.yazio_sync_enabled === 1 ? "Syncing enabled (best-effort)" : "Sync disabled (local only)",
  },
  {
    id: "data",
    label: "Data & Backup",
    icon: "folder-open-outline" as const,
    getSubtitle: () => "Export diary (JSON/CSV) · Full backup & restore",
  },
  {
    id: "about",
    label: "About & Account",
    icon: "information-circle-outline" as const,
    getSubtitle: () => `Version ${getCurrentVersion()} · Agent API & Sign out`,
  },
] as const

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"]

/**
 * Goals tab owns its own form state so typing in one field never re-renders
 * the rest of the settings screen.
 */
function GoalsSettings({ settings }: { settings: AppSettings }) {
  const { updateSettings } = useApp()
  const { showError, showSuccess } = useToast()
  const { colors } = useTheme()
  const [saving, setSaving] = useState(false)
  const [calorieGoal, setCalorieGoal] = useState(formatNumber(settings.calorie_goal))
  const [proteinGoal, setProteinGoal] = useState(formatNumber(settings.protein_goal))
  const [carbsGoal, setCarbsGoal] = useState(formatNumber(settings.carbs_goal))
  const [fatGoal, setFatGoal] = useState(formatNumber(settings.fat_goal))
  const [waterGoal, setWaterGoal] = useState(formatNumber(settings.water_goal_ml))
  const [heightCm, setHeightCm] = useState(formatNumber(settings.height_cm))
  const [targetWeight, setTargetWeight] = useState(formatNumber(settings.target_weight_kg))
  const [goalError, setGoalError] = useState<string | null>(null)

  const goalsKey = `${settings.calorie_goal}|${settings.protein_goal}|${settings.carbs_goal}|${settings.fat_goal}|${settings.water_goal_ml}|${settings.height_cm}|${settings.target_weight_kg}`
  const [syncedGoalsKey, setSyncedGoalsKey] = useState(goalsKey)
  if (goalsKey !== syncedGoalsKey) {
    setSyncedGoalsKey(goalsKey)
    setCalorieGoal(formatNumber(settings.calorie_goal))
    setProteinGoal(formatNumber(settings.protein_goal))
    setCarbsGoal(formatNumber(settings.carbs_goal))
    setFatGoal(formatNumber(settings.fat_goal))
    setWaterGoal(formatNumber(settings.water_goal_ml))
    setHeightCm(formatNumber(settings.height_cm))
    setTargetWeight(formatNumber(settings.target_weight_kg))
  }

  const saveGoals = useCallback(async () => {
    if (saving) return
    const values = {
      calorie_goal: Number(calorieGoal),
      protein_goal: Number(proteinGoal),
      carbs_goal: Number(carbsGoal),
      fat_goal: Number(fatGoal),
      water_goal_ml: Number(waterGoal),
      height_cm: Number(heightCm),
      target_weight_kg: Number(targetWeight),
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
      setGoalError("Calories, protein, carbs and fat must be positive numbers.")
      return
    }
    if (
      values.water_goal_ml < 0 ||
      values.height_cm < 0 ||
      values.target_weight_kg < 0 ||
      (values.height_cm > 0 && values.height_cm < 60)
    ) {
      setGoalError("Height must be at least 60 cm; water and weight can be 0 to disable.")
      return
    }
    setGoalError(null)
    setSaving(true)
    try {
      await updateSettings(values)
      showSuccess("Goals saved.", "Settings")
    } catch (error) {
      showError(error, "Could not save goals.")
    } finally {
      setSaving(false)
    }
  }, [
    calorieGoal,
    carbsGoal,
    fatGoal,
    heightCm,
    proteinGoal,
    saving,
    showError,
    showSuccess,
    targetWeight,
    updateSettings,
    waterGoal,
  ])

  const p = Number(proteinGoal) || 0
  const c = Number(carbsGoal) || 0
  const f = Number(fatGoal) || 0
  const ratios = computeMacroRatios(p, c, f)
  const macroKcal = ratios.macroKcal
  const pPct = ratios.proteinPct
  const cPct = ratios.carbsPct
  const fPct = ratios.fatPct

  return (
    <>
      <SettingsSection title="Daily nutrition goals">
        <GoalInput
          icon="flame-outline"
          label="Calories"
          value={calorieGoal}
          onChange={setCalorieGoal}
          onSubmit={saveGoals}
          step={50}
          min={500}
          unit="kcal"
        />
        <GoalInput
          icon="barbell-outline"
          label="Protein"
          value={proteinGoal}
          onChange={setProteinGoal}
          onSubmit={saveGoals}
          step={5}
          min={10}
          unit="g"
        />
        <GoalInput
          icon="leaf-outline"
          label="Carbohydrates"
          value={carbsGoal}
          onChange={setCarbsGoal}
          onSubmit={saveGoals}
          step={5}
          min={10}
          unit="g"
        />
        <GoalInput
          icon="water-outline"
          label="Fat"
          value={fatGoal}
          onChange={setFatGoal}
          onSubmit={saveGoals}
          step={5}
          min={5}
          unit="g"
          last
        />

        <View className="border-t border-outline-100 p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text size="xs" className="text-typography-500">
              Macro ratio ({macroKcal} kcal from macros)
            </Text>
          </View>
          <View className="h-3 flex-row overflow-hidden rounded-full bg-background-100">
            {pPct > 0 ? <View style={{ flex: pPct, backgroundColor: "#3b82f6" }} /> : null}
            {cPct > 0 ? <View style={{ flex: cPct, backgroundColor: "#f59e0b" }} /> : null}
            {fPct > 0 ? <View style={{ flex: fPct, backgroundColor: "#ef4444" }} /> : null}
          </View>
          <View className="mt-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
              <Text size="xs" className="text-typography-600">
                P: {pPct}% ({p * 4} kcal)
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
              <Text size="xs" className="text-typography-600">
                C: {cPct}% ({c * 4} kcal)
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: "#ef4444" }} />
              <Text size="xs" className="text-typography-600">
                F: {fPct}% ({f * 9} kcal)
              </Text>
            </View>
          </View>
        </View>
      </SettingsSection>

      <SettingsSection title="Water & body goals">
        <GoalInput
          icon="water-outline"
          label="Daily water goal"
          value={waterGoal}
          onChange={setWaterGoal}
          onSubmit={saveGoals}
          step={250}
          min={0}
          unit="ml"
        />
        <GoalInput
          icon="body-outline"
          label="Height"
          value={heightCm}
          onChange={setHeightCm}
          onSubmit={saveGoals}
          step={1}
          min={0}
          unit="cm"
        />
        <GoalInput
          icon="scale-outline"
          label="Target weight"
          value={targetWeight}
          onChange={setTargetWeight}
          onSubmit={saveGoals}
          step={0.5}
          min={0}
          unit="kg"
          last
        />
        <View className="gap-3 border-t border-outline-100 p-4">
          {goalError ? (
            <Text size="sm" bold className="mb-1" style={{ color: colors.danger }}>
              {goalError}
            </Text>
          ) : null}
          <Text size="xs" className="leading-4 text-typography-500">
            Height and target weight are optional (set to 0 to disable). BMI shows on Stats once
            height and weight are logged.
          </Text>

          <Button
            size="lg"
            className="mt-2 rounded-2xl bg-primary-500 py-3.5 active:bg-primary-600"
            onPress={saveGoals}
            disabled={saving}
          >
            <ButtonText>{saving ? "Saving goals…" : "Save goals"}</ButtonText>
          </Button>
        </View>
      </SettingsSection>
    </>
  )
}

function SettingsField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="border-b border-outline-100 px-4 py-3.5">
      <Text size="xs" bold className="mb-2 uppercase text-typography-500">
        {label}
      </Text>
      {children}
    </View>
  )
}

/** AI form — isolated state so typing an API key or model never re-renders other parts. */
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

  const saveAiSettings = useCallback(async () => {
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
      showSuccess("AI settings saved.", "Settings")
    } catch (error) {
      showError(error, "Could not save AI settings.")
    } finally {
      setAiSaving(false)
    }
  }, [
    aiApiKey,
    aiBaseUrl,
    aiModel,
    aiProvider,
    aiSystemPrompt,
    showError,
    showSuccess,
    updateSettings,
  ])

  if (!aiFormLoaded) {
    return (
      <View className="items-center border-t border-outline-100 py-10">
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

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
      </SettingsField>

      <SettingsField label="Base URL">
        <Input size="md">
          <InputField
            value={aiBaseUrl}
            onChangeText={setAiBaseUrl}
            placeholder={AI_PROVIDER_PRESETS[aiProvider].base_url}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel="AI base URL"
          />
        </Input>
      </SettingsField>

      <SettingsField label="API Key">
        <View className="flex-row items-center gap-2">
          <Input size="md" className="flex-1">
            <InputField
              value={aiApiKey}
              onChangeText={setAiApiKey}
              placeholder={aiProvider === "ollama" ? "Not required for local Ollama" : "sk-…"}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              accessibilityLabel="AI API key"
            />
          </Input>
          <Button
            size="sm"
            variant="outline"
            action="secondary"
            onPress={() => setShowApiKey((s) => !s)}
          >
            <ButtonText>{showApiKey ? "Hide" : "Show"}</ButtonText>
          </Button>
        </View>
      </SettingsField>

      <SettingsField label="Model">
        <View className="flex-row items-center gap-2">
          <Input size="md" className="flex-1">
            <InputField
              value={aiModel}
              onChangeText={setAiModel}
              placeholder={AI_PROVIDER_PRESETS[aiProvider].model}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void saveAiSettings()}
              accessibilityLabel="AI model name"
            />
          </Input>
          <Button
            size="sm"
            variant="outline"
            action="secondary"
            onPress={() => void fetchAiModels()}
            disabled={fetchingModels}
          >
            <ButtonText>{fetchingModels ? "Fetching…" : "Fetch list"}</ButtonText>
          </Button>
        </View>

        {fetchedModels.length > 0 ? (
          <Box className="mt-2 flex-row flex-wrap gap-1.5">
            {fetchedModels.slice(0, 10).map((model) => (
              <Pressable
                key={model}
                onPress={() => setAiModel(model)}
                className={`rounded-full border px-2.5 py-1 ${
                  aiModel === model
                    ? "border-primary-500 bg-primary-500/15"
                    : "border-outline-200 bg-background-50"
                }`}
                accessibilityRole="button"
                accessibilityLabel={`Select model ${model}`}
              >
                <Text size="xs" style={{ color: aiModel === model ? colors.primary : colors.text }}>
                  {model}
                </Text>
              </Pressable>
            ))}
          </Box>
        ) : null}
      </SettingsField>

      <SettingsField label="System prompt (optional)">
        <Input size="md" className="h-24">
          <InputField
            value={aiSystemPrompt}
            onChangeText={setAiSystemPrompt}
            placeholder="Custom assistant instructions, e.g. dietary preferences or tone"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            accessibilityLabel="Custom AI system prompt"
          />
        </Input>
      </SettingsField>

      {aiError ? (
        <View className="border-b border-outline-100 px-4 py-3">
          <Text size="xs" bold style={{ color: colors.danger }}>
            {aiError}
          </Text>
        </View>
      ) : null}

      {testResult ? (
        <View className="border-b border-outline-100 px-4 py-3">
          <Text size="xs" bold style={{ color: testResult.ok ? colors.primary : colors.danger }}>
            {testResult.ok ? "✓ " : "✗ "}
            {testResult.message}
          </Text>
        </View>
      ) : null}

      <View className="gap-3 p-4">
        <Box className="flex-row flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            action="primary"
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
            onPress={() => router.push("/(tabs)/ai")}
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

        <Button
          size="lg"
          className="mt-2 rounded-2xl bg-primary-500 py-3.5 active:bg-primary-600"
          onPress={saveAiSettings}
          disabled={aiSaving}
        >
          <ButtonText>{aiSaving ? "Saving AI settings…" : "Save AI settings"}</ButtonText>
        </Button>
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
  const scrollRef = useRef<ScrollView>(null)
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [profileCountry, setProfileCountry] = useState<string | null>(null)
  const [mcpExpanded, setMcpExpanded] = useState(false)
  const [activeSection, setActiveSection] = useState<SettingsSectionId | null>(null)

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

  const currentSection = SETTINGS_SECTIONS.find((s) => s.id === activeSection)

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background-0"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="pb-36"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <PageContainer
          grow={false}
          contentStyle={[
            { padding: spacing.md, paddingTop: insets.top + spacing.md },
            isWide ? { maxWidth: 860 } : undefined,
          ]}
        >
          {activeSection === null ? (
            /* ========================================================== */
            /* 1. MASTER SETTINGS HUB OVERVIEW                            */
            /* ========================================================== */
            <>
              <Box className="mb-5">
                <Text size="2xl" bold style={{ color: colors.textOnBackground }}>
                  Settings
                </Text>
                <Text size="xs" className="mt-1 text-typography-500">
                  Goals, preferences, data & account
                </Text>
              </Box>

              <Card variant="elevated" className="overflow-hidden rounded-3xl p-0 shadow-soft-1">
                {SETTINGS_SECTIONS.map((section, index) => {
                  const isLast = index === SETTINGS_SECTIONS.length - 1
                  return (
                    <Pressable
                      key={section.id}
                      onPress={() => {
                        setActiveSection(section.id)
                        scrollRef.current?.scrollTo({ y: 0, animated: false })
                      }}
                      className={`flex-row items-center gap-3.5 px-4 py-4 active:bg-background-100 ${
                        !isLast ? "border-b border-outline-100" : ""
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel={`${section.label} settings`}
                    >
                      <Box className="h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-500/10">
                        <Ionicons name={section.icon} size={22} color={colors.primary} />
                      </Box>
                      <Box className="min-w-0 flex-1">
                        <Text size="md" bold className="text-typography-900">
                          {section.label}
                        </Text>
                        <Text size="xs" numberOfLines={1} className="mt-0.5 text-typography-500">
                          {section.getSubtitle(settings, effectiveCountry)}
                        </Text>
                      </Box>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  )
                })}
              </Card>

              <Box className="mt-6">
                <Button size="lg" variant="outline" action="negative" onPress={handleLogout}>
                  <ButtonText>Sign out of YAZIO</ButtonText>
                </Button>
              </Box>
            </>
          ) : (
            /* ========================================================== */
            /* 2. SECTION DRILLDOWN VIEW                                  */
            /* ========================================================== */
            <>
              {/* Back Button & Section Title */}
              <Box className="mb-4">
                <Pressable
                  onPress={() => {
                    setActiveSection(null)
                    scrollRef.current?.scrollTo({ y: 0, animated: false })
                  }}
                  hitSlop={8}
                  className="flex-row items-center gap-1 py-1"
                  accessibilityRole="button"
                  accessibilityLabel="Back to all settings"
                >
                  <Ionicons name="chevron-back" size={20} color={colors.primary} />
                  <Text size="sm" bold style={{ color: colors.primary }}>
                    All Settings
                  </Text>
                </Pressable>
                <Box className="mt-1 flex-row items-center justify-between">
                  <Text size="2xl" bold style={{ color: colors.textOnBackground }}>
                    {currentSection?.label}
                  </Text>
                </Box>
              </Box>

              {/* Goals & Nutrition */}
              {activeSection === "goals" ? <GoalsSettings settings={settings} /> : null}

              {/* General & Preferences */}
              {activeSection === "general" ? (
                <>
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
                      stackOnNarrow
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
                      stackOnNarrow
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
                </>
              ) : null}

              {/* AI Assistant */}
              {activeSection === "ai" ? (
                <SettingsSection title="AI Assistant">
                  <SettingsRow
                    icon="sparkles-outline"
                    title="Enable AI Assistant"
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
                    last={settings.ai_enabled !== 1}
                  />

                  {settings.ai_enabled === 1 ? <AiSettingsForm settings={settings} /> : null}
                </SettingsSection>
              ) : null}

              {/* YAZIO Sync */}
              {activeSection === "sync" ? (
                <SettingsSection title="YAZIO Sync">
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
                        showSuccess(
                          count === 1 ? "Synced 1 entry." : `Synced ${count} entries.`,
                          "Sync",
                        )
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

              {/* Data & Backup */}
              {activeSection === "data" ? (
                <SettingsSection title="Data & Storage">
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

              {/* About & Account */}
              {activeSection === "about" ? (
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
                            production). The snapshot bridge is same-origin only and never stores
                            data on disk.
                          </Text>
                          <Box className="mt-2 flex-row flex-wrap gap-1.5">
                            {[
                              "get_diary",
                              "get_diary_stats",
                              "get_water",
                              "get_weight",
                              "get_meals",
                              "get_favorite_foods",
                              "get_goals",
                              "get_settings",
                              "get_health_summary",
                              "log_food",
                              "log_water",
                              "log_weight",
                              "log_meal",
                              "save_meal",
                              "update_food_entry",
                              "delete_food_entry",
                              "delete_water",
                              "delete_weight",
                              "delete_meal",
                              "toggle_favorite",
                              "set_goals",
                              "set_units",
                              "set_profile",
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

                  <SettingsSection title="Account">
                    <SettingsRow
                      icon="information-circle-outline"
                      title="Dietinator"
                      subtitle={`Version ${getCurrentVersion()} · Local-first tracker`}
                      last
                    />
                  </SettingsSection>

                  <Box className="mt-4">
                    <Button size="lg" variant="outline" action="negative" onPress={handleLogout}>
                      <ButtonText>Sign out of YAZIO</ButtonText>
                    </Button>
                  </Box>
                </>
              ) : null}

              {/* Bottom Quick Return to Overview */}
              <Box className="mt-8 flex-row items-center justify-center">
                <Pressable
                  onPress={() => {
                    setActiveSection(null)
                    scrollRef.current?.scrollTo({ y: 0, animated: false })
                  }}
                  className="flex-row items-center gap-1.5 rounded-full bg-background-100 px-4 py-2 active:bg-background-200"
                  accessibilityRole="button"
                  accessibilityLabel="Return to Settings overview"
                >
                  <Ionicons name="arrow-back" size={16} color={colors.text} />
                  <Text size="sm" bold style={{ color: colors.text }}>
                    All Settings
                  </Text>
                </Pressable>
              </Box>
            </>
          )}

          <FoodDatabaseCountryPicker
            visible={countryPickerOpen}
            selectedCode={effectiveCountry}
            onClose={() => setCountryPickerOpen(false)}
            onSelect={async (code) => {
              try {
                await updateSettings({ food_database_country: code })
                setProfileCountry(null)
              } catch (error) {
                showError(error, "Could not save food database country.")
              }
            }}
          />
        </PageContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function getMcpOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }
  return "http://localhost:8082"
}
