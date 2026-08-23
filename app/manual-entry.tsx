import { useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { logManualEntry } from "@/services/diary"
import { useToast } from "@/context/ToastContext"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { useSafeBack } from "@/hooks/useSafeBack"
import { useLayout } from "@/hooks/useLayout"
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible"
import { routeParam } from "@/utils/route"
import { toDateKey, formatDisplayDate } from "@/utils/date"
import { MEAL_LABELS } from "@/utils/meals"
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
  label,
  value,
  onChange,
  onSubmit,
  placeholder = "0",
  styles,
  stacked,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  styles: ReturnType<typeof createStyles>
  stacked?: boolean
}) {
  return (
    <Box className={stacked ? "w-full" : "flex-1"}>
      <Text style={styles.label}>{label}</Text>
      <NumberStepper
        value={value}
        onChangeText={onChange}
        onSubmit={onSubmit}
        step={1}
        size="sm"
        placeholder={placeholder}
        accessibilityLabel={label}
      />
    </Box>
  )
}

export default function ManualEntryScreen() {
  const router = useRouter()
  const safeBack = useSafeBack()
  const params = useLocalSearchParams<{ meal?: string; date?: string; quickAdd?: string }>()
  const mealType = (routeParam(params.meal) ?? "lunch") as MealType
  const date = routeParam(params.date) ?? toDateKey()
  const isQuickAdd = routeParam(params.quickAdd) === "1"
  const { showError, showWarning } = useToast()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const { width } = useLayout()
  const keyboardOpen = useKeyboardVisible()
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
        name: isQuickAdd ? "Quick add" : name,
        kcal: kcalValue,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
      })
      router.dismissAll()
    } catch (error) {
      showError(error, "Could not save entry.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ModalContainer hug maxWidth={520} outerClassName="bg-background-50">
        <Box
          className="flex-row items-center px-3 pb-2"
          style={{ paddingTop: insets.top > 0 ? insets.top + 8 : 20 }}
        >
          <Box>
            <Text
              size="2xl"
              bold
              className="uppercase tracking-widest text-typography-900"
              style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
            >
              {isQuickAdd ? "Quick Add" : "Manual entry"}
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
          contentContainerClassName="px-3 pb-28 pt-2"
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
            accessibilityLabel="Calories"
            placeholder="0"
            style={{ marginBottom: spacing.md }}
          />

          {width < 360 ? (
            <Box className="gap-3">
              <MacroInput
                label="Protein (g)"
                value={protein}
                onChange={setProtein}
                onSubmit={() => void handleSave()}
                styles={styles}
                stacked
              />
              <MacroInput
                label="Carbs (g)"
                value={carbs}
                onChange={setCarbs}
                onSubmit={() => void handleSave()}
                styles={styles}
                stacked
              />
              <MacroInput
                label="Fat (g)"
                value={fat}
                onChange={setFat}
                onSubmit={() => void handleSave()}
                styles={styles}
                stacked
              />
            </Box>
          ) : (
            <Box className="flex-row gap-3">
              <MacroInput
                label="Protein (g)"
                value={protein}
                onChange={setProtein}
                onSubmit={() => void handleSave()}
                styles={styles}
              />
              <MacroInput
                label="Carbs (g)"
                value={carbs}
                onChange={setCarbs}
                onSubmit={() => void handleSave()}
                styles={styles}
              />
              <MacroInput
                label="Fat (g)"
                value={fat}
                onChange={setFat}
                onSubmit={() => void handleSave()}
                styles={styles}
              />
            </Box>
          )}
        </ScrollView>
      </ModalContainer>

      {!keyboardOpen ? (
        <FabCluster
          bottomOffset={insets.bottom + 20}
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
      ) : null}
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
