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
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
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
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { SettingsSection } from "@/components/SettingsSection"
import { NumberStepper } from "@/components/NumberStepper"
import { FoodDatabaseCountryPicker } from "@/components/FoodDatabaseCountryPicker"
import { ThemePicker } from "@/components/ThemePicker"
import { SegmentedControl } from "@/components/SegmentedControl"
import { getTheme } from "@/theme/themes"
import { useLayout } from "@/hooks/useLayout"
import {
  getFoodDatabaseCountryLabel,
  resolveFoodDatabaseCountry,
} from "@/utils/food-database-country"
import { useTheme } from "@/hooks/useTheme"
import { confirmAction } from "@/utils/confirm"
import { formatNumber } from "@/utils/format"
import { computeMacroRatios } from "@/utils/nutrients"
import { routeParam } from "@/utils/route"
import { spacing, fonts, borders, radii } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Card } from "@ui/card"
import { Input, InputField } from "@ui/input"
import { Button, ButtonText } from "@ui/button"
import { Switch } from "@ui/switch"

type IconName = ComponentProps<typeof Feather>["name"]

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
    <Box
      className="h-10 w-10 shrink-0 items-center justify-center rounded-none border bg-background-100"
      style={{ borderWidth: borders.width, borderColor: colors.border, borderRadius: radii.none }}
    >
      <Feather name={icon} size={20} color={tint} />
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
  accent,
  mci,
}: {
  /** Feather glyph name, or an MCI name when `mci` is set. */
  icon: IconName | (string & {})
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
  /** Accent color for the icon well (macro rows use the meal accents). */
  accent?: string
  /** Render the glyph from MaterialCommunityIcons instead of Feather. */
  mci?: boolean
}) {
  const { colors } = useTheme()
  const tint = accent ?? colors.primary

  return (
    <View className={`px-4 py-3.5 ${!last ? "border-b border-outline-100" : ""}`}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <View
            className="h-10 w-10 shrink-0 items-center justify-center rounded-none border"
            style={{
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
              backgroundColor: `${tint}14`,
            }}
          >
            {mci ? (
              <MaterialCommunityIcons name={icon as never} size={20} color={tint} />
            ) : (
              <Feather name={icon as IconName} size={20} color={tint} />
            )}
          </View>
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

/** Goals-hub subtitle: the three macro icons carry the values, no P/C/F letters. */
function MacroGoalSubtitle({
  settings,
  colors,
}: {
  settings: AppSettings
  colors: ReturnType<typeof useTheme>["colors"]
}) {
  const items = [
    {
      icon: "zap" as const,
      color: colors.breakfast,
      value: `${Math.round(settings.protein_goal)}g`,
    },
    {
      icon: "box" as const,
      color: colors.lunch,
      value: `${Math.round(settings.carbs_goal)}g`,
    },
    {
      icon: "droplet" as const,
      color: colors.dinner,
      value: `${Math.round(settings.fat_goal)}g`,
    },
  ]
  return (
    <View className="mt-0.5 flex-row items-center gap-3">
      {items.map((item) => (
        <View key={item.icon} className="flex-row items-center gap-1">
          <Feather name={item.icon} size={11} color={item.color} />
          <Text size="xs" className="font-tabular text-typography-500">
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

const SETTINGS_SECTIONS = [
  {
    id: "goals",
    label: "Goals and Nutrition",
    icon: "flag" as const,
    getSubtitle: (s: AppSettings) =>
      `${Math.round(s.calorie_goal)} kcal · ${Math.round(s.protein_goal)}g P · ${Math.round(s.carbs_goal)}g C · ${Math.round(s.fat_goal)}g F`,
  },
  {
    id: "device",
    label: "Device and Preferences",
    icon: "sliders" as const,
    getSubtitle: (s: AppSettings, country: string) => {
      const pref = s.theme_preference ?? "system"
      const label = pref === "system" ? "System" : (getTheme(pref)?.label ?? pref)
      return `Database: ${getFoodDatabaseCountryLabel(country)} · ${s.units === "imperial" ? "Imperial" : "Metric"} · Theme: ${label}`
    },
  },
  {
    id: "data",
    label: "Data and Sync",
    icon: "folder" as const,
    getSubtitle: (s: AppSettings) =>
      s.yazio_sync_enabled === 1
        ? "Local and YAZIO sync · Export and backup"
        : "Local only · Export and backup",
  },
  {
    id: "account",
    label: "AI and Account",
    icon: "cpu" as const,
    getSubtitle: (s: AppSettings) =>
      s.ai_enabled === 1
        ? `AI active (${s.ai_provider}) · Agent API · Sign out`
        : `AI disabled · Agent API · Sign out`,
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
  const [calorieGoal, setCalorieGoal] = useState(String(Math.round(settings.calorie_goal)))
  const [proteinGoal, setProteinGoal] = useState(String(Math.round(settings.protein_goal)))
  const [carbsGoal, setCarbsGoal] = useState(String(Math.round(settings.carbs_goal)))
  const [fatGoal, setFatGoal] = useState(String(Math.round(settings.fat_goal)))
  const [waterGoal, setWaterGoal] = useState(String(Math.round(settings.water_goal_ml)))
  const [heightCm, setHeightCm] = useState(formatNumber(settings.height_cm))
  const [targetWeight, setTargetWeight] = useState(formatNumber(settings.target_weight_kg))
  const [goalError, setGoalError] = useState<string | null>(null)

  const goalsKey = `${Math.round(settings.calorie_goal)}|${Math.round(settings.protein_goal)}|${Math.round(settings.carbs_goal)}|${Math.round(settings.fat_goal)}|${Math.round(settings.water_goal_ml)}|${settings.height_cm}|${settings.target_weight_kg}`
  const [syncedGoalsKey, setSyncedGoalsKey] = useState(goalsKey)
  if (goalsKey !== syncedGoalsKey) {
    setSyncedGoalsKey(goalsKey)
    setCalorieGoal(String(Math.round(settings.calorie_goal)))
    setProteinGoal(String(Math.round(settings.protein_goal)))
    setCarbsGoal(String(Math.round(settings.carbs_goal)))
    setFatGoal(String(Math.round(settings.fat_goal)))
    setWaterGoal(String(Math.round(settings.water_goal_ml)))
    setHeightCm(formatNumber(settings.height_cm))
    setTargetWeight(formatNumber(settings.target_weight_kg))
  }

  const saveGoals = useCallback(async () => {
    if (saving) return
    const values = {
      calorie_goal: Math.round(Number(calorieGoal)),
      protein_goal: Math.round(Number(proteinGoal)),
      carbs_goal: Math.round(Number(carbsGoal)),
      fat_goal: Math.round(Number(fatGoal)),
      water_goal_ml: Math.round(Number(waterGoal)),
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
  const pPct = ratios.proteinPct
  const cPct = ratios.carbsPct
  const fPct = ratios.fatPct

  const isDirty =
    String(Math.round(settings.calorie_goal)) !== calorieGoal ||
    String(Math.round(settings.protein_goal)) !== proteinGoal ||
    String(Math.round(settings.carbs_goal)) !== carbsGoal ||
    String(Math.round(settings.fat_goal)) !== fatGoal ||
    String(Math.round(settings.water_goal_ml)) !== waterGoal ||
    formatNumber(settings.height_cm) !== heightCm ||
    formatNumber(settings.target_weight_kg) !== targetWeight

  const fieldErrors: Record<string, string> = {}
  if (goalError) {
    if (goalError.includes("Calories, protein")) {
      fieldErrors.calories = goalError
      fieldErrors.protein = goalError
      fieldErrors.carbs = goalError
      fieldErrors.fat = goalError
    } else if (goalError.includes("Height")) {
      fieldErrors.height = goalError
      fieldErrors.water = goalError
      fieldErrors.weight = goalError
    }
  }

  return (
    <>
      <SettingsSection title="Daily nutrition goals">
        <GoalInput
          icon="fire"
          mci
          label="Calories"
          value={calorieGoal}
          onChange={setCalorieGoal}
          onSubmit={saveGoals}
          step={50}
          min={500}
          unit="kcal"
          error={fieldErrors.calories}
        />
        <GoalInput
          icon="zap"
          accent={colors.breakfast}
          label="Protein"
          value={proteinGoal}
          onChange={setProteinGoal}
          onSubmit={saveGoals}
          step={5}
          min={10}
          unit="g"
          error={fieldErrors.protein}
        />
        <GoalInput
          icon="box"
          accent={colors.lunch}
          label="Carbohydrates"
          value={carbsGoal}
          onChange={setCarbsGoal}
          onSubmit={saveGoals}
          step={5}
          min={10}
          unit="g"
          error={fieldErrors.carbs}
        />
        <GoalInput
          icon="droplet"
          accent={colors.dinner}
          label="Fat"
          value={fatGoal}
          onChange={setFatGoal}
          onSubmit={saveGoals}
          step={5}
          min={5}
          unit="g"
          last
          error={fieldErrors.fat}
        />

        <View className="border-t border-outline-100 p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text size="xs" className="text-typography-500">
              Macro ratio
            </Text>
          </View>
          <View
            className="h-4 flex-row overflow-hidden rounded-none border bg-background-100"
            style={{
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
            }}
          >
            {pPct > 0 ? (
              <View
                style={{
                  flex: pPct,
                  backgroundColor: colors.breakfast,
                  borderRightWidth: cPct > 0 || fPct > 0 ? 1.5 : 0,
                  borderRightColor: colors.border,
                }}
              />
            ) : null}
            {cPct > 0 ? (
              <View
                style={{
                  flex: cPct,
                  backgroundColor: colors.lunch,
                  borderRightWidth: fPct > 0 ? 1.5 : 0,
                  borderRightColor: colors.border,
                }}
              />
            ) : null}
            {fPct > 0 ? (
              <View
                style={{
                  flex: fPct,
                  backgroundColor: colors.dinner,
                }}
              />
            ) : null}
          </View>
          <View className="mt-2 flex-row items-center justify-between text-xs">
            <Text size="xs" bold style={{ color: colors.breakfast }}>
              Protein {pPct}% ({Math.round(p)}g)
            </Text>
            <Text size="xs" bold style={{ color: colors.lunch }}>
              Carbs {cPct}% ({Math.round(c)}g)
            </Text>
            <Text size="xs" bold style={{ color: colors.dinner }}>
              Fat {fPct}% ({Math.round(f)}g)
            </Text>
          </View>
        </View>
      </SettingsSection>

      <SettingsSection title="Body and hydration">
        <GoalInput
          icon="droplet"
          label="Water intake goal"
          value={waterGoal}
          onChange={setWaterGoal}
          onSubmit={saveGoals}
          step={250}
          min={0}
          unit="ml"
          error={fieldErrors.water}
        />
        <GoalInput
          icon="user"
          label="Height"
          value={heightCm}
          onChange={setHeightCm}
          onSubmit={saveGoals}
          step={1}
          min={0}
          unit="cm"
          error={fieldErrors.height}
        />
        <GoalInput
          icon="activity"
          label="Target weight"
          value={targetWeight}
          onChange={setTargetWeight}
          onSubmit={saveGoals}
          step={0.5}
          min={0}
          unit="kg"
          last
          error={fieldErrors.weight}
        />
        {isDirty || goalError ? (
          <View
            className="gap-2 border-t border-outline-100 p-4"
            style={{
              backgroundColor: colors.surface,
              borderTopWidth: 1.5,
              borderTopColor: colors.border,
            }}
          >
            {goalError ? (
              <Text size="sm" bold className="mb-1" style={{ color: colors.danger }}>
                {goalError}
              </Text>
            ) : null}
            <Button
              size="md"
              className="rounded-none border bg-primary-500 active:bg-primary-600"
              style={{
                borderWidth: borders.width,
                borderColor: colors.primary,
                borderRadius: radii.none,
              }}
              onPress={saveGoals}
              disabled={saving}
            >
              <ButtonText
                style={{
                  fontFamily: fonts.mono,
                  textTransform: "uppercase",
                  letterSpacing: 0.06,
                  fontWeight: "800",
                  color: colors.onPrimary,
                }}
              >
                {saving ? "SAVING..." : "SAVE GOALS"}
              </ButtonText>
            </Button>
          </View>
        ) : null}
      </SettingsSection>
    </>
  )
}

function SettingsField({
  icon,
  accent,
  label,
  children,
}: {
  icon?: IconName
  accent?: string
  label: string
  children: ReactNode
}) {
  const { colors } = useTheme()
  const tint = accent ?? colors.primary
  return (
    <View className="border-b border-outline-100 px-4 py-3.5">
      <Box className="mb-2 flex-row items-center gap-2">
        {icon ? (
          <Box
            className="h-5 w-5 items-center justify-center rounded-none"
            style={{
              backgroundColor: `${tint}20`,
              borderWidth: borders.widthThin,
              borderColor: tint,
            }}
          >
            <Feather name={icon} size={11} color={tint} />
          </Box>
        ) : null}
        <Text
          size="xs"
          bold
          className="uppercase tracking-widest text-typography-500"
          style={{ fontFamily: fonts.mono, letterSpacing: 0.08 }}
        >
          {label}
        </Text>
      </Box>
      {children}
    </View>
  )
}

/** AI form with vibrant cyberpunk palette, model chips, telemetry cards, and distinct action buttons. */
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
        setAiError("No models returned. The endpoint may not expose a model list.")
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
      setAiError("Base URL is required (for example https://api.openai.com/v1).")
      return
    }
    if (!aiModel.trim()) {
      setAiError("Model name is required (for example gpt-4o-mini).")
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
      <SettingsField label="Provider Preset" icon="sliders" accent={colors.primary}>
        <Box className="flex-row flex-wrap gap-2">
          {AI_PROVIDER_IDS.map((provider) => {
            const selected = provider === aiProvider
            const providerColors: Record<string, string> = {
              openai: colors.lunch,
              ollama: colors.warning,
              anthropic: colors.breakfast,
              openrouter: colors.dinner,
              custom: colors.primary,
            }
            const tint = providerColors[provider] ?? colors.primary
            return (
              <Pressable
                key={provider}
                onPress={() => selectAiProvider(provider)}
                accessibilityRole="button"
                accessibilityLabel={`AI provider ${provider}`}
                accessibilityState={{ selected }}
                className="cursor-pointer flex-row items-center gap-1.5 rounded-none border px-3 py-2"
                style={{
                  borderWidth: borders.width,
                  borderColor: selected ? tint : colors.border,
                  backgroundColor: selected ? `${tint}20` : colors.surface,
                  borderRadius: radii.none,
                }}
              >
                <Box
                  className="h-2 w-2 rounded-none"
                  style={{ backgroundColor: selected ? tint : colors.textMuted }}
                />
                <Text
                  size="xs"
                  bold
                  style={{
                    color: selected ? tint : colors.text,
                    fontFamily: fonts.mono,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {AI_PROVIDER_PRESETS[provider].label}
                </Text>
              </Pressable>
            )
          })}
        </Box>
      </SettingsField>

      <SettingsField label="Base Endpoint URL" icon="globe" accent={colors.lunch}>
        <Input size="md" className="rounded-none border bg-background-50">
          <InputField
            value={aiBaseUrl}
            onChangeText={setAiBaseUrl}
            placeholder={AI_PROVIDER_PRESETS[aiProvider].base_url}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel="AI base URL"
            style={{ fontFamily: fonts.mono }}
          />
        </Input>
      </SettingsField>

      <SettingsField label="API Secret Key" icon="key" accent={colors.warning}>
        <View className="flex-row items-center gap-2">
          <Input size="md" className="flex-1 rounded-none border bg-background-50">
            <InputField
              value={aiApiKey}
              onChangeText={setAiApiKey}
              placeholder={aiProvider === "ollama" ? "Not required for local Ollama" : "sk-…"}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              accessibilityLabel="AI API key"
              style={{ fontFamily: fonts.mono }}
            />
          </Input>
          <Pressable
            onPress={() => setShowApiKey((s) => !s)}
            className="h-11 items-center justify-center rounded-none border px-3"
            style={{
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
              borderWidth: borders.width,
              borderRadius: radii.none,
            }}
            accessibilityRole="button"
            accessibilityLabel={showApiKey ? "Hide key" : "Show key"}
          >
            <Text
              size="xs"
              bold
              style={{
                color: colors.text,
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {showApiKey ? "Hide" : "Show"}
            </Text>
          </Pressable>
        </View>
      </SettingsField>

      <SettingsField label="Target Model" icon="cpu" accent={colors.breakfast}>
        <View className="flex-row items-center gap-2">
          <Input size="md" className="flex-1 rounded-none border bg-background-50">
            <InputField
              value={aiModel}
              onChangeText={setAiModel}
              placeholder={AI_PROVIDER_PRESETS[aiProvider].model}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void saveAiSettings()}
              accessibilityLabel="AI model name"
              style={{ fontFamily: fonts.mono }}
            />
          </Input>
          <Pressable
            onPress={() => void fetchAiModels()}
            disabled={fetchingModels}
            className="h-11 flex-row items-center gap-1.5 rounded-none border px-3"
            style={{
              backgroundColor: `${colors.breakfast}18`,
              borderColor: colors.breakfast,
              borderWidth: borders.width,
              borderRadius: radii.none,
              opacity: fetchingModels ? 0.6 : 1,
            }}
            accessibilityRole="button"
            accessibilityLabel="Fetch model list"
          >
            <Feather name="download" size={13} color={colors.breakfast} />
            <Text
              size="xs"
              bold
              style={{
                color: colors.breakfast,
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {fetchingModels ? "Fetching…" : "Fetch"}
            </Text>
          </Pressable>
        </View>

        {fetchedModels.length > 0 ? (
          <Box className="mt-2.5 gap-2">
            <Text
              size="xs"
              className="font-mono uppercase tracking-widest text-typography-500"
              style={{ fontFamily: fonts.mono, letterSpacing: 0.06 }}
            >
              {fetchedModels.length} models available — tap to select
            </Text>
            <Box className="flex-row flex-wrap gap-1.5">
              {fetchedModels.map((model) => (
                <Pressable
                  key={model}
                  onPress={() => setAiModel(model)}
                  className="rounded-none border px-2.5 py-1.5"
                  style={{
                    borderWidth: borders.width,
                    borderColor: aiModel === model ? colors.primary : colors.border,
                    backgroundColor: aiModel === model ? `${colors.primary}20` : colors.surfaceAlt,
                    borderRadius: radii.none,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select model ${model}`}
                >
                  <Text
                    size="xs"
                    bold={aiModel === model}
                    style={{
                      color: aiModel === model ? colors.primary : colors.text,
                      fontFamily: fonts.mono,
                    }}
                  >
                    {model}
                  </Text>
                </Pressable>
              ))}
            </Box>
          </Box>
        ) : null}
      </SettingsField>

      <SettingsField label="System Prompt (Optional)" icon="terminal" accent={colors.dinner}>
        <Input size="md" className="h-24 rounded-none border bg-background-50 p-2">
          <InputField
            value={aiSystemPrompt}
            onChangeText={setAiSystemPrompt}
            placeholder="Custom assistant instructions..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            accessibilityLabel="Custom AI system prompt"
            style={{ fontFamily: fonts.mono, fontSize: 12 }}
          />
        </Input>
      </SettingsField>

      {aiError ? (
        <View
          className="mx-4 my-2 border p-3"
          style={{
            borderColor: colors.danger,
            backgroundColor: `${colors.danger}18`,
            borderWidth: borders.width,
            borderRadius: radii.none,
          }}
        >
          <Box className="flex-row items-center gap-2">
            <Feather name="alert-triangle" size={16} color={colors.danger} />
            <Text
              size="xs"
              bold
              style={{
                color: colors.danger,
                fontFamily: fonts.mono,
                letterSpacing: 0.04,
              }}
            >
              {aiError}
            </Text>
          </Box>
        </View>
      ) : null}

      {testResult ? (
        <View
          className="mx-4 my-2 border p-3.5"
          style={{
            borderColor: testResult.ok ? colors.primary : colors.danger,
            backgroundColor: testResult.ok ? `${colors.primary}18` : `${colors.danger}18`,
            borderWidth: borders.width,
            borderRadius: radii.none,
          }}
        >
          <Box className="flex-row items-center gap-2">
            <Feather
              name={testResult.ok ? "check-circle" : "x-circle"}
              size={18}
              color={testResult.ok ? colors.primary : colors.danger}
            />
            <Box className="flex-1">
              <Text
                size="xs"
                bold
                className="uppercase tracking-widest"
                style={{
                  color: testResult.ok ? colors.primary : colors.danger,
                  fontFamily: fonts.mono,
                  letterSpacing: 0.08,
                }}
              >
                {testResult.ok ? "Telemetry Connection: Verified" : "Telemetry Connection: Failed"}
              </Text>
              <Text
                size="xs"
                className="mt-0.5"
                style={{
                  color: colors.text,
                  fontFamily: fonts.mono,
                }}
              >
                {testResult.message}
              </Text>
            </Box>
          </Box>
        </View>
      ) : null}

      <View className="gap-3 p-4">
        {/* Test Connection Button - styled prominently with colors and clear padding */}
        <Pressable
          onPress={() => void testAiConnection()}
          disabled={testingConnection}
          className="w-full flex-row items-center justify-center gap-2.5 rounded-none border px-4 py-3.5 active:opacity-80"
          style={{
            backgroundColor: `${colors.primary}20`,
            borderColor: colors.primary,
            borderWidth: borders.width,
            borderRadius: radii.none,
            opacity: testingConnection ? 0.6 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel="Test AI connection"
        >
          <Feather name="activity" size={16} color={colors.primary} />
          <Text
            size="sm"
            bold
            style={{
              color: colors.primary,
              fontFamily: fonts.mono,
              textTransform: "uppercase",
              letterSpacing: 0.08,
            }}
          >
            {testingConnection ? "Testing Telemetry..." : "Test Connection"}
          </Text>
        </Pressable>

        <Box className="flex-row gap-2">
          <Pressable
            onPress={() => router.push("/(tabs)/ai")}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-none border px-3 py-3 active:opacity-80"
            style={{
              backgroundColor: `${colors.lunch}18`,
              borderColor: colors.lunch,
              borderWidth: borders.width,
              borderRadius: radii.none,
            }}
            accessibilityRole="button"
            accessibilityLabel="Open AI chat"
          >
            <Feather name="message-square" size={14} color={colors.lunch} />
            <Text
              size="xs"
              bold
              style={{
                color: colors.lunch,
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.06,
              }}
            >
              Open AI Chat
            </Text>
          </Pressable>
          <Pressable
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
            className="flex-1 flex-row items-center justify-center gap-2 rounded-none border px-3 py-3 active:opacity-80"
            style={{
              backgroundColor: `${colors.danger}18`,
              borderColor: colors.danger,
              borderWidth: borders.width,
              borderRadius: radii.none,
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear chat history"
          >
            <Feather name="trash-2" size={14} color={colors.danger} />
            <Text
              size="xs"
              bold
              style={{
                color: colors.danger,
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.06,
              }}
            >
              Clear History
            </Text>
          </Pressable>
        </Box>

        <Button
          size="lg"
          className="mt-1 rounded-none border bg-primary-500 py-3.5 active:bg-primary-600"
          style={{
            borderWidth: borders.width,
            borderColor: colors.primary,
            borderRadius: radii.none,
          }}
          onPress={saveAiSettings}
          disabled={aiSaving}
        >
          <ButtonText
            style={{
              fontFamily: fonts.mono,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              fontWeight: "800",
              color: colors.onPrimary,
            }}
          >
            {aiSaving ? "SAVING AI SETTINGS…" : "SAVE AI SETTINGS"}
          </ButtonText>
        </Button>
      </View>
    </View>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { settings, updateSettings, refreshAuth, refreshSettings, authenticated } = useApp()
  const { showSuccess, showError } = useToast()
  const { checking, checkForUpdates } = useUpdates()
  const { colors } = useTheme()
  const { isWide, isLarge } = useLayout()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [profileCountry, setProfileCountry] = useState<string | null>(null)
  const [mcpExpanded, setMcpExpanded] = useState(false)
  const [activeSection, setActiveSection] = useState<SettingsSectionId | null>(null)
  const searchParams = useLocalSearchParams<{ section?: string }>()
  const sectionParam = (routeParam(searchParams.section) ?? null) as SettingsSectionId | null
  const effectiveSectionId =
    isWide && activeSection === null ? SETTINGS_SECTIONS[0].id : activeSection

  useEffect(() => {
    if (
      sectionParam &&
      SETTINGS_SECTIONS.some((s) => s.id === sectionParam) &&
      sectionParam !== activeSection
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deep link sync
      setActiveSection(sectionParam)
    } else if (!sectionParam && activeSection !== null) {
      // Tab press clears the query param so we must clear the local drilldown state
      // too - otherwise the old section survives tab switches because the screen
      // stays mounted. On wide the next effect will re-select the first tab.
      setActiveSection(null)
    }
  }, [sectionParam, activeSection])

  // On wide, default to the first tab instead of the hub cards
  useEffect(() => {
    if (isWide && activeSection === null && !sectionParam) {
      const first = SETTINGS_SECTIONS[0].id
      // eslint-disable-next-line react-hooks/set-state-in-effect -- wide default
      setActiveSection(first)
      router.setParams({ section: first } as never)
    }
  }, [isWide, activeSection, sectionParam, router])

  const openSection = useCallback(
    (id: SettingsSectionId) => {
      setActiveSection(id)
      scrollRef.current?.scrollTo({ y: 0, animated: false })
      router.setParams({ section: id } as never)
    },
    [router],
  )

  // One shared pop-to-hub for the header button and hardware Back alike.
  // On wide the hub cards are not used, so back stays on the first tab.
  const backToHub = useCallback(() => {
    if (isWide) {
      const first = SETTINGS_SECTIONS[0].id
      setActiveSection(first)
      scrollRef.current?.scrollTo({ y: 0, animated: false })
      router.setParams({ section: first } as never)
      return
    }
    setActiveSection(null)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    router.setParams({ section: undefined } as never)
  }, [router, isWide])

  // The drilldown lives in component state, invisible to the navigation
  // stack. Without this handler, system Back from any subsection exits the
  // whole app on Android.
  useEffect(() => {
    if (Platform.OS === "web" || effectiveSectionId === null) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      backToHub()
      return true
    })
    return () => sub.remove()
  }, [effectiveSectionId, backToHub])

  useEffect(() => {
    // The profile lookup only makes sense signed in; signed-out mounts were
    // firing a doomed network call on every open.
    if (!authenticated) return
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
  }, [authenticated])

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
      showSuccess("Backup saved. Keep it somewhere safe.", "Backup created")
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

  const currentSection = SETTINGS_SECTIONS.find((s) => s.id === effectiveSectionId)
  const safeTop = insets.top > 0 ? insets.top : Platform.OS === "android" ? 24 : 0

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: "transparent" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={safeTop}
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
            { padding: spacing.lg, paddingTop: insets.top + spacing.lg },
            isWide ? { maxWidth: isLarge ? 1360 : 1280 } : undefined,
          ]}
        >
          {effectiveSectionId === null ? (
            /* ========================================================== */
            /* 1. MASTER SETTINGS HUB OVERVIEW                            */
            /* ========================================================== */
            <>
              <Box className="mb-5">
                <Text
                  size="2xl"
                  bold
                  className="uppercase tracking-widest text-typography-900"
                  style={{
                    color: colors.textOnBackground,
                    fontFamily: fonts.mono,
                    letterSpacing: 0.04,
                  }}
                >
                  Settings
                </Text>
                <Text
                  size="xs"
                  className="mt-1 font-mono uppercase tracking-widest text-typography-500"
                  style={{ fontFamily: fonts.mono, letterSpacing: 0.06 }}
                >
                  Goals, preferences, data and account
                </Text>
              </Box>

              {isWide ? (
                <View
                  style={
                    {
                      display: "grid",
                      gridTemplateColumns: isLarge
                        ? "repeat(3, minmax(0, 1fr))"
                        : "repeat(2, minmax(0, 1fr))",
                      gap: isLarge ? 20 : 16,
                    } as never
                  }
                >
                  {SETTINGS_SECTIONS.map((section) => {
                    const isActive = effectiveSectionId === section.id
                    return (
                      <Pressable
                        key={section.id}
                        onPress={() => openSection(section.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${section.label}`}
                        hitSlop={4}
                        style={{
                          borderWidth: borders.width,
                          borderColor: isActive ? colors.primary : colors.border,
                          backgroundColor: isActive ? `${colors.primary}10` : colors.surface,
                          padding: 16,
                          gap: 12,
                          minHeight: 120,
                          flexDirection: "column",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box
                          className="h-11 w-11 shrink-0 items-center justify-center rounded-none border"
                          style={{
                            borderWidth: borders.width,
                            borderColor: colors.border,
                            backgroundColor: isActive ? colors.primary : `${colors.primary}12`,
                          }}
                        >
                          <Feather
                            name={section.icon}
                            size={22}
                            color={isActive ? colors.onPrimary : colors.primary}
                          />
                        </Box>
                        <Box className="w-full min-w-0">
                          <Text size="md" bold className="text-typography-900">
                            {section.label}
                          </Text>
                          {section.id === "goals" ? (
                            <MacroGoalSubtitle settings={settings} colors={colors} />
                          ) : (
                            <Text size="xs" numberOfLines={2} className="mt-1 text-typography-500">
                              {section.getSubtitle(settings, effectiveCountry)}
                            </Text>
                          )}
                        </Box>
                        <Box className="flex-row items-center gap-1">
                          <Text
                            size="xs"
                            bold
                            style={{
                              color: colors.primary,
                              fontFamily: fonts.mono,
                              textTransform: "uppercase",
                              letterSpacing: 0.06,
                            }}
                          >
                            Open
                          </Text>
                          <Feather name="arrow-right" size={12} color={colors.primary} />
                        </Box>
                      </Pressable>
                    )
                  })}
                </View>
              ) : (
                <Card
                  variant="elevated"
                  className="overflow-hidden rounded-none border p-0"
                  style={{
                    borderWidth: borders.width,
                    borderColor: colors.border,
                    borderRadius: radii.none,
                    boxShadow: "none",
                    elevation: 0,
                  }}
                >
                  {SETTINGS_SECTIONS.map((section, index) => {
                    const isLast = index === SETTINGS_SECTIONS.length - 1
                    return (
                      <Pressable
                        key={section.id}
                        onPress={() => openSection(section.id)}
                        className={`flex-row items-center gap-3.5 px-4 py-4 active:bg-background-100 ${
                          !isLast ? "border-b border-outline-100" : ""
                        }`}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${section.label}`}
                        hitSlop={4}
                      >
                        <Box
                          className="h-11 w-11 shrink-0 items-center justify-center rounded-none border bg-primary-500/10"
                          style={{
                            borderWidth: borders.width,
                            borderColor: colors.border,
                            borderRadius: radii.none,
                          }}
                        >
                          <Feather name={section.icon} size={22} color={colors.primary} />
                        </Box>
                        <Box className="min-w-0 flex-1">
                          <Text size="md" bold className="text-typography-900">
                            {section.label}
                          </Text>
                          {section.id === "goals" ? (
                            <MacroGoalSubtitle settings={settings} colors={colors} />
                          ) : (
                            <Text
                              size="xs"
                              numberOfLines={1}
                              className="mt-0.5 text-typography-500"
                            >
                              {section.getSubtitle(settings, effectiveCountry)}
                            </Text>
                          )}
                        </Box>
                        <Feather name="chevron-right" size={18} color={colors.textMuted} />
                      </Pressable>
                    )
                  })}
                </Card>
              )}
            </>
          ) : (
            /* ========================================================== */
            /* 2. SECTION DRILLDOWN VIEW                                  */
            /* ========================================================== */
            <>
              {/* Section Title */}
              <Box className="mb-2 flex-row items-center gap-3 pt-1">
                <Pressable
                  onPress={backToHub}
                  accessibilityRole="button"
                  accessibilityLabel="Back to settings"
                  hitSlop={8}
                  className="h-9 w-9 items-center justify-center rounded-none border"
                  style={{
                    borderWidth: borders.width,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Feather name="arrow-left" size={16} color={colors.text} />
                </Pressable>
                <Text
                  size="2xl"
                  bold
                  style={{
                    color: colors.textOnBackground,
                    fontFamily: fonts.mono,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {currentSection?.label}
                </Text>
              </Box>

              {isWide ? (
                <View
                  style={
                    {
                      display: "flex",
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 20,
                      paddingBottom: 16,
                      borderBottomWidth: 1.5,
                      borderBottomColor: colors.border,
                    } as never
                  }
                >
                  {SETTINGS_SECTIONS.map((s) => {
                    const active = s.id === effectiveSectionId
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => openSection(s.id)}
                        accessibilityRole="button"
                        accessibilityLabel={s.label}
                        accessibilityState={{ selected: active }}
                        hitSlop={4}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderWidth: borders.width,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primary : colors.surface,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Feather
                          name={s.icon}
                          size={14}
                          color={active ? colors.onPrimary : colors.textMuted}
                        />
                        <Text
                          size="xs"
                          bold
                          style={{
                            color: active ? colors.onPrimary : colors.text,
                            fontFamily: fonts.mono,
                            textTransform: "uppercase",
                            letterSpacing: 0.06,
                          }}
                        >
                          {s.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              ) : null}

              {/* Goals and Nutrition */}
              {effectiveSectionId === "goals" ? <GoalsSettings settings={settings} /> : null}

              {/* Device and Preferences */}
              {effectiveSectionId === "device" ? (
                <>
                  <SettingsSection title="Preferences">
                    <SettingsRow
                      icon="globe"
                      title="Food database country"
                      subtitle={
                        countryUsesProfileDefault && profileCountry
                          ? `Using your YAZIO profile (${getFoodDatabaseCountryLabel(profileCountry)}) until you pick one`
                          : getFoodDatabaseCountryLabel(effectiveCountry)
                      }
                      onPress={() => setCountryPickerOpen(true)}
                      accessibilityLabel="Change food database country"
                      right={<Feather name="chevron-right" size={20} color={colors.textMuted} />}
                    />
                    <SettingsRow
                      icon="activity"
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
                      icon="sun"
                      title="Theme"
                      subtitle={(() => {
                        const pref = settings.theme_preference ?? "system"
                        if (pref === "system") return "Follow your device setting"
                        const def = getTheme(pref)
                        return def ? `${def.label} · ${def.group}` : pref
                      })()}
                      last
                      stackOnNarrow
                      right={
                        <Pressable
                          onPress={() => setThemePickerOpen(true)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            borderWidth: borders.width,
                            borderColor: colors.border,
                            backgroundColor: colors.surfaceAlt,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: radii.none,
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Choose theme"
                        >
                          <View
                            style={{
                              width: 14,
                              height: 14,
                              backgroundColor: colors.primary,
                              borderWidth: borders.widthThin,
                              borderColor: colors.border,
                            }}
                          />
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: colors.text,
                              fontFamily: fonts.mono,
                              textTransform: "uppercase",
                              letterSpacing: 0.04,
                            }}
                          >
                            {(() => {
                              const pref = settings.theme_preference ?? "system"
                              if (pref === "system") return "System"
                              return getTheme(pref)?.label ?? pref
                            })()}
                          </Text>
                          <Feather name="chevron-down" size={12} color={colors.textMuted} />
                        </Pressable>
                      }
                    />
                  </SettingsSection>

                  <SettingsSection title="Updates">
                    <SettingsRow
                      icon="download-cloud"
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
                      icon="refresh-cw"
                      title={checking ? "Checking…" : "Check now"}
                      subtitle={`Version ${getCurrentVersion()} · releases on GitHub`}
                      last
                      onPress={() => void checkForUpdates({ manual: true })}
                      accessibilityLabel="Check for updates now"
                    />
                  </SettingsSection>
                </>
              ) : null}

              {/* YAZIO Sync — now under Data and Sync */}
              {effectiveSectionId === "data" ? (
                <SettingsSection title="YAZIO Cloud Sync">
                  {/* Connectivity Status Banner */}
                  <View
                    className="flex-row items-center gap-2.5 border-b px-4 py-3"
                    style={{
                      borderBottomWidth: 1.5,
                      borderBottomColor: colors.border,
                      backgroundColor: authenticated
                        ? settings.yazio_sync_enabled === 1
                          ? `${colors.primary}14`
                          : `${colors.warning}14`
                        : colors.surfaceAlt,
                    }}
                  >
                    <Box
                      className="h-2.5 w-2.5 rounded-none"
                      style={{
                        backgroundColor: authenticated
                          ? settings.yazio_sync_enabled === 1
                            ? colors.primary
                            : colors.warning
                          : colors.textMuted,
                      }}
                    />
                    <Text
                      size="xs"
                      bold
                      className="flex-1 uppercase tracking-widest text-typography-900"
                      style={{
                        fontFamily: fonts.mono,
                        letterSpacing: 0.08,
                        color: authenticated
                          ? settings.yazio_sync_enabled === 1
                            ? colors.primary
                            : colors.warning
                          : colors.textMuted,
                      }}
                    >
                      {authenticated
                        ? settings.yazio_sync_enabled === 1
                          ? "CLOUD SYNC: ACTIVE (BEST-EFFORT)"
                          : "CLOUD SYNC: PAUSED (LOCAL-ONLY)"
                        : "CLOUD SYNC: DISCONNECTED (NOT LOGGED IN)"}
                    </Text>
                  </View>

                  <SettingsRow
                    icon="repeat"
                    title="Automatic Cloud Sync"
                    subtitle="Push diary entries to YAZIO automatically as you log them"
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

                  <View className="gap-2.5 p-4">
                    <Pressable
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
                      className="flex-row items-center justify-center gap-2 rounded-none border px-4 py-3 active:opacity-80"
                      style={{
                        backgroundColor: `${colors.primary}18`,
                        borderColor: colors.primary,
                        borderWidth: borders.width,
                        borderRadius: radii.none,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Sync pending entries now"
                    >
                      <Feather name="upload-cloud" size={16} color={colors.primary} />
                      <Text
                        size="xs"
                        bold
                        className="font-mono uppercase tracking-widest"
                        style={{
                          color: colors.primary,
                          fontFamily: fonts.mono,
                          letterSpacing: 0.08,
                        }}
                      >
                        Sync Pending Entries Now
                      </Text>
                    </Pressable>

                    <Pressable
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
                      className="flex-row items-center justify-center gap-2 rounded-none border px-4 py-3 active:opacity-80"
                      style={{
                        backgroundColor: `${colors.lunch}18`,
                        borderColor: colors.lunch,
                        borderWidth: borders.width,
                        borderRadius: radii.none,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Import today from YAZIO"
                    >
                      <Feather name="download-cloud" size={16} color={colors.lunch} />
                      <Text
                        size="xs"
                        bold
                        className="font-mono uppercase tracking-widest"
                        style={{
                          color: colors.lunch,
                          fontFamily: fonts.mono,
                          letterSpacing: 0.08,
                        }}
                      >
                        Import Today From YAZIO
                      </Text>
                    </Pressable>
                  </View>
                </SettingsSection>
              ) : null}

              {/* Data and Backup */}
              {effectiveSectionId === "data" ? (
                <SettingsSection title="Data and Storage">
                  <SettingsRow
                    icon="download"
                    title="Export diary (JSON)"
                    subtitle="All entries as a JSON file"
                    onPress={() => void handleExport("json")}
                  />
                  <SettingsRow
                    icon="file-text"
                    title="Export diary (CSV)"
                    subtitle="All entries as a spreadsheet file"
                    onPress={() => void handleExport("csv")}
                  />
                  <SettingsRow
                    icon="archive"
                    title="Back up all data"
                    subtitle="Diary, cached foods and meals in one file"
                    onPress={handleBackup}
                  />
                  <SettingsRow
                    icon="inbox"
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
                    icon="trash-2"
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

              {/* Account and About — includes AI config, previously its own tile */}
              {effectiveSectionId === "account" ? (
                <>
                  <SettingsSection title="AI Assistant">
                    <SettingsRow
                      icon="cpu"
                      title="Enable AI Assistant"
                      subtitle="Chat with your diary. Key and data stay on this device. Full config in the AI tab."
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
                      onPress={() => {
                        if (settings.ai_enabled === 1) return
                        void updateSettings({ ai_enabled: 1 }).catch((e) =>
                          showError(e, "Could not update AI setting."),
                        )
                      }}
                    />
                    {settings.ai_enabled === 1 ? (
                      <>
                        <AiSettingsForm settings={settings} />
                        <View className="border-t border-outline-100 p-4">
                          <Text size="xs" className="text-typography-500">
                            AI provider config below. Also open chat in the AI tab.
                          </Text>
                          <Pressable
                            onPress={() => router.push("/(tabs)/ai")}
                            className="mt-3 flex-row items-center justify-center gap-2 rounded-none border px-4 py-3 active:opacity-80"
                            style={{
                              backgroundColor: `${colors.primary}14`,
                              borderColor: colors.primary,
                              borderWidth: borders.width,
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Open AI chat"
                          >
                            <Feather name="message-square" size={16} color={colors.primary} />
                            <Text
                              size="xs"
                              bold
                              style={{
                                color: colors.primary,
                                fontFamily: fonts.mono,
                                textTransform: "uppercase",
                                letterSpacing: 0.06,
                              }}
                            >
                              Open AI Chat
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    ) : null}
                  </SettingsSection>

                  {Platform.OS === "web" ? (
                    <SettingsSection title="Agent API (MCP)">
                      <SettingsRow
                        icon="terminal"
                        title="Agent API (MCP)"
                        subtitle="Let AI agents read and log to your diary"
                        last={!mcpExpanded}
                        onPress={() => setMcpExpanded((v) => !v)}
                        accessibilityLabel={
                          mcpExpanded ? "Hide Agent API details" : "Show Agent API details"
                        }
                        right={
                          <Feather
                            name={mcpExpanded ? "chevron-down" : "chevron-right"}
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
                                className="rounded-none border border-outline-100 bg-background-50 px-2 py-0.5"
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
                      icon="info"
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
          <ThemePicker
            visible={themePickerOpen}
            selected={settings.theme_preference ?? "system"}
            onClose={() => setThemePickerOpen(false)}
            onSelect={async (value) => {
              try {
                await updateSettings({ theme_preference: value })
              } catch (error) {
                showError(error, "Could not update theme.")
              }
            }}
          />
        </PageContainer>
      </ScrollView>

      {effectiveSectionId !== null && !isWide ? (
        <FabCluster
          bottomOffset={insets.bottom + 20}
          left={
            <Fab
              icon="arrow-left"
              tone="surface"
              onPress={backToHub}
              accessibilityLabel="Back to all settings"
            />
          }
        />
      ) : null}
    </KeyboardAvoidingView>
  )
}

function getMcpOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }
  return "http://localhost:9082"
}
