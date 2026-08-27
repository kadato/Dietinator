import { useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { logManualEntry } from "@/services/diary"
import { useToast } from "@/context/ToastContext"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { useSafeBack } from "@/hooks/useSafeBack"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"
import { routeParam } from "@/utils/route"
import { toDateKey, formatDisplayDate } from "@/utils/date"
import { MEAL_LABELS, MEAL_ICONS } from "@/utils/meals"
import { ModalContainer } from "@/components/ModalContainer"
import { NumberStepper } from "@/components/NumberStepper"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import type { MealType } from "@/types"
import { spacing, fonts, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Input, InputField } from "@ui/input"

function MacroInput({
  icon,
  accent,
  label,
  value,
  onChange,
  onSubmit,
  placeholder = "0",
}: {
  icon: keyof typeof Feather.glyphMap
  accent: string
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
}) {
  const { colors } = useTheme()
  return (
    <Box
      className="flex-row items-center justify-between rounded-none border bg-background-50 px-3 py-2.5"
      style={{
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 0,
        backgroundColor: colors.surface,
      }}
    >
      <Box className="flex-row items-center gap-2.5">
        <Box
          className="h-8 w-8 items-center justify-center rounded-none border"
          style={{
            backgroundColor: `${accent}18`,
            borderColor: colors.border,
            borderWidth: 1.5,
            borderRadius: 0,
          }}
        >
          <Feather name={icon} size={15} color={accent} />
        </Box>
        <Text
          size="xs"
          bold
          className="text-typography-900"
          style={{ fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 }}
        >
          {label}
        </Text>
      </Box>
      <NumberStepper
        value={value}
        onChangeText={onChange}
        onSubmit={onSubmit}
        step={1}
        min={0}
        size="sm"
        inputWidth={64}
        placeholder={placeholder}
        accessibilityLabel={label}
      />
    </Box>
  )
}

export default function ManualEntryScreen() {
  const router = useRouter()
  const safeBack = useSafeBack()
  useEscapeToClose(true, safeBack)
  const params = useLocalSearchParams<{ meal?: string; date?: string; quickAdd?: string }>()
  const mealType = (routeParam(params.meal) ?? "lunch") as MealType
  const date = routeParam(params.date) ?? toDateKey()
  const isQuickAdd = routeParam(params.quickAdd) === "1"
  const { showError, showWarning } = useToast()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const [name, setName] = useState("")
  const [kcal, setKcal] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (saving) return
    const kcalValue = Number(kcal)
    if (isQuickAdd) {
      if (!kcalValue || kcalValue <= 0) {
        showWarning("Enter calories for the quick add.", "Missing calories")
        return
      }
    } else if (!name.trim() || !kcalValue || kcalValue <= 0) {
      showWarning("Enter a name and calories.", "Missing fields")
      return
    }
    setSaving(true)
    try {
      await logManualEntry({
        date,
        mealType,
        name: isQuickAdd ? "Quick add" : name.trim(),
        kcal: Math.round(kcalValue),
        protein: Math.round(Number(protein) || 0),
        carbs: Math.round(Number(carbs) || 0),
        fat: Math.round(Number(fat) || 0),
      })
      router.dismissAll()
    } catch (error) {
      showError(error, "Could not save entry.")
    } finally {
      setSaving(false)
    }
  }

  const safeBottom = insets.bottom
  const baseTop = insets.top > 0 ? insets.top : Platform.OS === "android" ? 24 : 0
  const safeTop = baseTop + 28

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={safeTop}
    >
      <ModalContainer maxWidth={520} outerClassName="bg-background-50">
        <Box className="flex-row items-center gap-3 px-4 pb-2 pt-3">
          <Box
            className="h-10 w-10 items-center justify-center rounded-none border"
            style={{
              backgroundColor: `${colors.primary}18`,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
            }}
          >
            <Feather
              name={isQuickAdd ? "zap" : MEAL_ICONS[mealType] || "edit-3"}
              size={18}
              color={colors.primary}
            />
          </Box>
          <Box>
            <Text
              size="xl"
              bold
              className="uppercase tracking-widest text-typography-900"
              style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
            >
              {isQuickAdd ? "Quick Add" : "New Food"}
            </Text>
            <Text
              size="xs"
              className="mt-0.5 font-mono uppercase tracking-widest text-typography-500"
              style={{ fontFamily: fonts.mono, letterSpacing: 0.06 }}
            >
              {MEAL_LABELS[mealType]} · {formatDisplayDate(date)}
            </Text>
          </Box>
        </Box>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-28 pt-2"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {!isQuickAdd ? (
            <>
              <Text style={styles.label}>Name</Text>
              <Input
                size="md"
                variant="outline"
                className="mb-3 rounded-none border bg-background-50"
                style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
              >
                <InputField
                  value={name}
                  onChangeText={setName}
                  placeholder="Homemade soup"
                  accessibilityLabel="Food name"
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSave()}
                  maxFontSizeMultiplier={2}
                  style={{ fontFamily: fonts.mono }}
                />
              </Input>
            </>
          ) : null}

          <Text style={styles.label}>Calories (kcal)</Text>
          <NumberStepper
            value={kcal}
            onChangeText={setKcal}
            onSubmit={() => void handleSave()}
            step={10}
            min={0}
            accessibilityLabel="Calories"
            placeholder="0"
            style={{ marginBottom: spacing.md }}
          />

          <Text style={styles.label}>Nutrient Breakdown</Text>
          <Box className="gap-2">
            <MacroInput
              icon="zap"
              accent={colors.breakfast}
              label="Protein (g)"
              value={protein}
              onChange={setProtein}
              onSubmit={() => void handleSave()}
            />
            <MacroInput
              icon="box"
              accent={colors.lunch}
              label="Carbs (g)"
              value={carbs}
              onChange={setCarbs}
              onSubmit={() => void handleSave()}
            />
            <MacroInput
              icon="droplet"
              accent={colors.dinner}
              label="Fat (g)"
              value={fat}
              onChange={setFat}
              onSubmit={() => void handleSave()}
            />
          </Box>
        </ScrollView>
      </ModalContainer>

      <FabCluster
        bottomOffset={safeBottom + 20}
        left={
          <Fab icon="arrow-left" tone="surface" onPress={safeBack} accessibilityLabel="Go back" />
        }
        right={
          <Fab
            icon="check"
            onPress={handleSave}
            disabled={saving}
            accessibilityLabel="Add to diary"
          />
        }
      />
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.08,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
  })
