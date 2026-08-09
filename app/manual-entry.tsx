import { useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { logManualEntry } from "@/services/diary"
import { useToast } from "@/context/ToastContext"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { routeParam } from "@/utils/route"
import { toDateKey } from "@/utils/date"
import { MEAL_LABELS } from "@/utils/meals"
import { ModalContainer } from "@/components/ModalContainer"
import type { MealType } from "@/types"
import { spacing, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

function MacroInput({
  label,
  value,
  onChange,
  placeholder = "0",
  styles,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <Box className="flex-1">
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        accessibilityLabel={label}
      />
    </Box>
  )
}

export default function ManualEntryScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ meal?: string; date?: string; quickAdd?: string }>()
  const mealType = (routeParam(params.meal) ?? "lunch") as MealType
  const date = routeParam(params.date) ?? toDateKey()
  const isQuickAdd = routeParam(params.quickAdd) === "1"
  const { showError, showWarning } = useToast()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const [name, setName] = useState("")
  const [kcal, setKcal] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
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
      // Dismiss the whole modal chain (log-meal → create-options) back to the dashboard.
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
      <ModalContainer hug maxWidth={520}>
        <Box className="flex-row items-center px-4 pb-2 pt-4">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <Text size="2xl" bold className="flex-1 text-center text-typography-900">
            {isQuickAdd ? "Quick Add" : "Manual entry"}
          </Text>
          <Box className="w-7" />
        </Box>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-4"
          keyboardShouldPersistTaps="handled"
        >
          <Text size="sm" className="mb-4 text-typography-500">
            {MEAL_LABELS[mealType]} · {date}
          </Text>

          {!isQuickAdd ? (
            <>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Homemade soup"
                placeholderTextColor="#9ca3af"
                accessibilityLabel="Food name"
              />
            </>
          ) : null}

          <Text style={styles.label}>Calories (kcal)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={kcal}
            onChangeText={setKcal}
            placeholder="0"
            placeholderTextColor="#9ca3af"
            accessibilityLabel="Calories"
          />

          <Box className="flex-row gap-3">
            <MacroInput label="Protein (g)" value={protein} onChange={setProtein} styles={styles} />
            <MacroInput label="Carbs (g)" value={carbs} onChange={setCarbs} styles={styles} />
            <MacroInput label="Fat (g)" value={fat} onChange={setFat} styles={styles} />
          </Box>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.saveBtn, saving && styles.saveDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Add to diary"
          >
            <Text style={styles.saveText}>{saving ? "Saving..." : "Add to diary"}</Text>
          </Pressable>
        </View>
      </ModalContainer>
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    label: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.md,
      color: colors.text,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 28,
      paddingHorizontal: 32,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    saveDisabled: { opacity: 0.6 },
    saveText: { color: colors.onPrimary, fontWeight: "700", fontSize: 16 },
  })
