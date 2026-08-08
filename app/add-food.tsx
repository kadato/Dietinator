import { useCallback, useEffect, useMemo, useState } from "react"
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { logFood, updateDiaryEntry } from "@/services/diary"
import { getFoodRemote } from "@/services/yazio/foods"
import { getFoodById, getIsFavorite, saveFoodToCache, toggleFavorite } from "@/db/food-cache"
import { getDiaryEntryById } from "@/db/diary"
import type { FoodServing, MealType, SearchFoodResult } from "@/types"
import {
  isPerGramNutrients,
  nutrientsForAmount,
  resolveNutrientsRefAmount,
} from "@/utils/nutrients"
import { formatNutrientsServingLabel, formatServingOption } from "@/utils/food-display"
import { routeParam } from "@/utils/route"
import { toDateKey } from "@/utils/date"
import { NutritionFactsCard } from "@/components/NutritionFactsCard"
import { PageContainer } from "@/components/PageContainer"
import { ModalContainer } from "@/components/ModalContainer"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { useToast } from "@/context/ToastContext"
import { spacing, type ColorPalette } from "@/theme"
import { MEAL_LABELS, MEAL_TYPES } from "@/utils/meals"

/**
 * Normalize a serving option against a product: per-100g products (detail API)
 * keep the ref amount so nutrient scaling stays correct.
 */
function resolveServing(food: SearchFoodResult, option: FoodServing): FoodServing {
  const unit = food.base_unit || "g"
  const ref = resolveNutrientsRefAmount(food.nutrients, food.serving, unit)
  const perHundred = Boolean(food.servings?.length) && ref === 100
  return {
    serving: option.serving,
    amount: option.amount,
    serving_quantity: perHundred
      ? ref
      : option.serving_quantity > 0
        ? option.serving_quantity
        : option.amount,
  }
}

export default function AddFoodScreen() {
  const router = useRouter()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const { showError, showWarning } = useToast()
  const params = useLocalSearchParams<{
    meal: string
    date: string
    productId?: string
    entryId?: string
  }>()

  const mealType = (routeParam(params.meal) ?? "lunch") as MealType
  const date = routeParam(params.date) ?? toDateKey()
  const productId = routeParam(params.productId)
  const entryId = routeParam(params.entryId)
  const isEditing = Boolean(entryId)

  const [food, setFood] = useState<SearchFoodResult | null>(null)
  const [loadingFood, setLoadingFood] = useState(Boolean(productId) || Boolean(entryId))
  const [isFavorite, setIsFavorite] = useState(false)
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<MealType>(mealType)

  useEffect(() => {
    if (!productId && !entryId) {
      router.back()
    }
  }, [productId, entryId, router])

  // Edit mode: load the existing entry and resolve its food (cache → remote).
  useEffect(() => {
    if (!entryId) return
    let cancelled = false
    ;(async () => {
      setLoadingFood(true)
      try {
        const entry = await getDiaryEntryById(entryId)
        if (!entry) {
          showError(new Error("Entry not found."), "It may have been deleted.")
          router.back()
          return
        }
        setSelectedMeal(entry.meal_type)
        setAmount(String(entry.amount))
        if (!entry.food_id) {
          // Manual entries have no product — treat stored totals as the base.
          const nutrients = {
            kcal: entry.kcal,
            protein: entry.protein,
            carbs: entry.carbs,
            fat: entry.fat,
          }
          const ref = entry.amount > 0 ? entry.amount : 1
          setFood({
            product_id: `manual-${entryId}`,
            name: entry.food_name,
            producer: "",
            nutrients,
            serving: { serving: entry.unit, amount: ref, serving_quantity: ref },
            base_unit: entry.unit,
            is_verified: false,
          })
          setLoadingFood(false)
          return
        }
        const resolved = (await getFoodRemote(entry.food_id)) ?? (await getFoodById(entry.food_id))
        if (cancelled) return
        if (!resolved) {
          showError(new Error("Could not load food details"), "Try again or pick another item.")
          setLoadingFood(false)
          return
        }
        const initialServing = resolved.servings?.[0] ?? resolved.serving
        setFood({
          ...resolved,
          serving: resolveServing(resolved, initialServing),
        })
        setIsFavorite(await getIsFavorite(resolved.product_id))
      } catch {
        if (!cancelled) {
          showError(new Error("Could not load food details"), "Try again or pick another item.")
        }
      } finally {
        if (!cancelled) setLoadingFood(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entryId, router, showError])

  // New-entry mode: load product details.
  useEffect(() => {
    if (!productId || entryId) return
    let cancelled = false
    ;(async () => {
      setLoadingFood(true)
      try {
        let resolved = (await getFoodRemote(productId)) ?? (await getFoodById(productId))
        if (
          resolved &&
          isPerGramNutrients(
            resolved.nutrients,
            resolved.base_unit || "g",
            resolved.serving.serving_quantity,
          )
        ) {
          const refreshed = await getFoodRemote(productId)
          if (refreshed) resolved = refreshed
        }
        if (!cancelled && resolved) {
          const initialServing = resolved.servings?.[0] ?? resolved.serving
          setFood({
            ...resolved,
            serving: resolveServing(resolved, initialServing),
          })
          setAmount(String(initialServing.amount))
          setIsFavorite(await getIsFavorite(productId))
        }
      } catch {
        if (!cancelled) {
          showError(new Error("Could not load food details"), "Try again or pick another item.")
        }
      } finally {
        if (!cancelled) setLoadingFood(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [productId, entryId, showError])

  const servingOptions = useMemo((): FoodServing[] => {
    if (!food) return []
    if (food.servings?.length) return food.servings
    return [food.serving]
  }, [food])

  const preview = useMemo(() => {
    if (!food) return null
    const amt = Number(amount) || 0
    if (amt <= 0) return null
    return nutrientsForAmount(food.nutrients, food.serving, amt, food.base_unit)
  }, [food, amount])

  const selectServing = useCallback(
    (option: FoodServing) => {
      if (!food) return
      setFood({ ...food, serving: resolveServing(food, option) })
      setAmount(String(option.amount))
    },
    [food],
  )

  const handleToggleFavorite = async () => {
    if (!food || !productId) return
    try {
      await saveFoodToCache(food)
      const next = await toggleFavorite(productId)
      setIsFavorite(next)
    } catch (error) {
      showError(error, "Could not update favorite.")
    }
  }

  const handleSave = async () => {
    if (!food) return
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      showWarning("Enter a positive amount.", "Invalid amount")
      return
    }
    setSaving(true)
    try {
      if (isEditing && entryId) {
        await updateDiaryEntry({ id: entryId, amount: amt, mealType: selectedMeal })
      } else {
        let resolved = food
        if (!resolved.nutrients.kcal && productId) {
          const remote = await getFoodRemote(productId)
          if (remote) resolved = remote
        }
        await logFood({ date, mealType: selectedMeal, food: resolved, amount: amt })
      }
      router.back()
    } catch (error) {
      showError(error, "Could not save entry.")
    } finally {
      setSaving(false)
    }
  }

  if (loadingFood) {
    return (
      <View style={styles.center}>
        <PageContainer variant="narrow" contentStyle={styles.centerContent}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading food details…</Text>
        </PageContainer>
      </View>
    )
  }

  if (!food) {
    return (
      <View style={styles.center}>
        <PageContainer variant="narrow" contentStyle={styles.centerContent}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Could not load this food.</Text>
          {productId || entryId ? (
            <Pressable onPress={() => router.back()} accessibilityRole="button">
              <Text style={styles.link}>Go back</Text>
            </Pressable>
          ) : null}
        </PageContainer>
      </View>
    )
  }

  const unit = food.base_unit || "g"
  const selectedServingKey = `${food.serving.serving}-${food.serving.amount}`

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ModalContainer maxWidth={560}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <PageContainer
            grow={false}
            variant="narrow"
            contentStyle={isWide ? [styles.page, { maxWidth: 520 }] : styles.page}
          >
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>{food.name}</Text>
                {food.producer ? <Text style={styles.producer}>{food.producer}</Text> : null}
              </View>
              {!isEditing ? (
                <Pressable
                  onPress={handleToggleFavorite}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Text style={styles.star}>{isFavorite ? "★" : "☆"}</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.subtitle}>
              {MEAL_LABELS[selectedMeal]} · {date}
            </Text>

            {isEditing ? (
              <>
                <Text style={styles.label}>Meal</Text>
                <View style={styles.mealRow}>
                  {MEAL_TYPES.map((meal) => {
                    const active = meal === selectedMeal
                    return (
                      <Pressable
                        key={meal}
                        style={[styles.chip, active && styles.chipSelected]}
                        onPress={() => setSelectedMeal(meal)}
                        accessibilityRole="button"
                        accessibilityLabel={MEAL_LABELS[meal]}
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextSelected]}>
                          {MEAL_LABELS[meal]}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionLabel}>Serving size</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.servingRow}
              keyboardShouldPersistTaps="handled"
            >
              {servingOptions.map((option) => {
                const key = `${option.serving}-${option.amount}`
                const selected = key === selectedServingKey
                return (
                  <Pressable
                    key={key}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => selectServing(option)}
                    accessibilityRole="button"
                    accessibilityLabel={`Serving: ${formatServingOption(option, unit)}`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {formatServingOption(option, unit)}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <Text style={styles.label}>Amount ({unit})</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              accessibilityLabel={`Amount in ${unit}`}
            />

            {preview && (
              <NutritionFactsCard
                nutrients={preview}
                servingLabel={formatNutrientsServingLabel(food, Number(amount) || 0)}
              />
            )}
          </PageContainer>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.saveBtn, saving && styles.saveDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? "Update entry" : "Add to diary"}
          >
            <Text style={styles.saveText}>
              {saving ? "Saving..." : isEditing ? "Update entry" : "Add to diary"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.cancel}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </ModalContainer>
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    content: { flexGrow: 1 },
    page: { padding: spacing.lg },
    center: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
      gap: spacing.md,
    },
    loadingText: { color: colors.textMuted, fontSize: 14 },
    link: { color: colors.primary, marginTop: spacing.md },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    titleBlock: { flex: 1 },
    title: { fontSize: 24, fontWeight: "700", color: colors.text },
    star: { fontSize: 28, color: colors.warning, paddingTop: 2 },
    producer: {
      fontSize: 15,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    subtitle: {
      color: colors.textMuted,
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      marginBottom: spacing.sm,
    },
    mealRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "500",
    },
    chipTextSelected: {
      color: colors.onPrimary,
    },
    servingRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingBottom: spacing.md,
    },
    label: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.md,
      color: colors.text,
      fontSize: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    footer: {
      padding: spacing.lg,
      paddingTop: spacing.md,
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      padding: spacing.md,
      alignItems: "center",
    },
    saveDisabled: { opacity: 0.6 },
    saveText: { color: colors.onPrimary, fontWeight: "700", fontSize: 16 },
    cancel: { alignItems: "center" },
    cancelText: { color: colors.textMuted },
  })
