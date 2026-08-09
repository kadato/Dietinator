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
import {
  cachedToSearchResult,
  getCachedFoodById,
  getFoodById,
  getIsFavorite,
  toggleFavorite,
} from "@/db/food-cache"
import { getDiaryEntryById } from "@/db/diary"
import type { FoodServing, MealType, SearchFoodResult } from "@/types"
import {
  normalizePerGramFood,
  nutrientsForAmount,
  resolveNutrientsRefAmount,
} from "@/utils/nutrients"
import { formatNutrientsServingLabel, formatServingOption } from "@/utils/food-display"
import { routeParam } from "@/utils/route"
import { toDateKey } from "@/utils/date"
import { NutritionFactsCard } from "@/components/NutritionFactsCard"
import { PageContainer } from "@/components/PageContainer"
import { ModalContainer } from "@/components/ModalContainer"
import { Fab } from "@/components/Fab"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible"
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

/**
 * Resolve a product for the add-food screen. Renders instantly from any
 * cached row — per-gram search rows are normalized for display — and patches
 * in the real product detail when the network answers, so the nutrition
 * preview never waits for YAZIO when the food has been seen before.
 */
async function resolveFoodForDisplay(
  productId: string,
  cancelled: boolean,
): Promise<{ food: SearchFoodResult; favorite: boolean } | null> {
  const cachedRow = await getCachedFoodById(productId)
  if (!cancelled && cachedRow) {
    const cachedFood = cachedToSearchResult(cachedRow)
    if (cachedFood) {
      const perGram =
        cachedRow.source === "search" &&
        (cachedFood.base_unit === "g" || cachedFood.base_unit === "ml")
      const display = perGram ? normalizePerGramFood(cachedFood) : cachedFood
      return { food: { ...display }, favorite: cachedRow.is_favorite === 1 }
    }
  }

  // Background: real detail (or a fresh cache refresh) replaces the instant
  // render when it arrives; the screen is already usable meanwhile.
  const resolved = (await getFoodRemote(productId)) ?? (await getFoodById(productId))
  if (!resolved) return null
  const initialServing = resolved.servings?.[0] ?? resolved.serving
  return {
    food: { ...resolved, serving: resolveServing(resolved, initialServing) },
    favorite: await getIsFavorite(resolved.product_id),
  }
}

export default function AddFoodScreen() {
  const router = useRouter()

  const safeBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/(tabs)")
    }
  }, [router])
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const { showError, showWarning } = useToast()
  const insets = useSafeAreaInsets()
  const keyboardOpen = useKeyboardVisible()
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
      safeBack()
    }
  }, [productId, entryId, safeBack])

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
          safeBack()
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
        const resolved = await resolveFoodForDisplay(entry.food_id, cancelled)
        if (!cancelled && resolved) {
          setFood(resolved.food)
          setIsFavorite(resolved.favorite)
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
  }, [entryId, safeBack, showError])

  // New-entry mode: load product details.
  useEffect(() => {
    if (!productId || entryId) return
    let cancelled = false
    ;(async () => {
      setLoadingFood(true)
      try {
        const resolved = await resolveFoodForDisplay(productId, cancelled)
        if (!cancelled && resolved) {
          setFood(resolved.food)
          setAmount(String(resolved.food.serving.amount))
          setIsFavorite(resolved.favorite)
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
      const next = await toggleFavorite(productId, food)
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
      safeBack()
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
            <Pressable onPress={() => safeBack()} accessibilityRole="button">
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
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.md, paddingBottom: 120 },
          ]}
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
              maxFontSizeMultiplier={1.4}
            />

            {preview && (
              <NutritionFactsCard
                nutrients={preview}
                servingLabel={formatNutrientsServingLabel(food, Number(amount) || 0)}
              />
            )}
          </PageContainer>
        </ScrollView>
      </ModalContainer>

      {!keyboardOpen ? (
        <View style={styles.fabLayer} pointerEvents="box-none">
          <View style={[styles.fabLeft, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
            <Fab tone="surface" icon="close" onPress={safeBack} accessibilityLabel="Cancel" />
          </View>
          <View style={[styles.fabRight, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
            <Fab
              icon="checkmark"
              onPress={handleSave}
              disabled={saving}
              accessibilityLabel={isEditing ? "Update entry" : "Add to diary"}
            />
          </View>
        </View>
      ) : null}
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
    fabLayer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    fabLeft: {
      position: "absolute",
      left: 20,
      alignItems: "flex-start",
    },
    fabRight: {
      position: "absolute",
      right: 20,
      alignItems: "flex-end",
    },
  })
