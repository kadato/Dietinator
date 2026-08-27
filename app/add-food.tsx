import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { LoadingSpinner } from "@/components/LoadingSpinner"
import { useLocalSearchParams } from "expo-router"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { getDiaryEntriesForDate, logFood, updateDiaryEntry } from "@/services/diary"
import { getFoodRemote, isUsableCacheRow } from "@/services/yazio/foods"
import {
  cachedToSearchResult,
  getCachedFoodById,
  getFoodById,
  getIsFavorite,
  toggleFavorite,
} from "@/db/food-cache"
import { getDiaryEntryById } from "@/db/diary"
import type { DiaryEntry, FoodServing, MealType, SearchFoodResult } from "@/types"
import {
  isBaseUnitServingLabel,
  normalizePerGramFood,
  nutrientsForAmount,
  resolveNutrientsRefAmount,
  sumNutrients,
} from "@/utils/nutrients"
import { formatNutrientsServingLabel, formatServingOption, displayUnit } from "@/utils/food-display"
import { routeParam } from "@/utils/route"
import { toDateKey } from "@/utils/date"
import { DailyImpactCard } from "@/components/DailyImpactCard"
import { NutritionFactsCard } from "@/components/NutritionFactsCard"
import { NumberStepper } from "@/components/NumberStepper"
import { PageContainer } from "@/components/PageContainer"
import { ModalContainer } from "@/components/ModalContainer"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { useSafeBack } from "@/hooks/useSafeBack"
import { useApp } from "@/context/AppContext"
import { useLayout } from "@/hooks/useLayout"
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible"
import { useToast } from "@/context/ToastContext"
import { spacing, fonts, type ColorPalette } from "@/theme"
import { MEAL_LABELS, MEAL_TYPES } from "@/utils/meals"

/**
 * Normalize a serving option against a product.
 *
 * `serving_quantity` always carries the amount of base units that the stored
 * `nutrients` refer to (the nutrient reference amount). For per-100 g/ml
 * products that is 100; for countable products (each, cup, serving, whole)
 * it is 1 base unit (or the product's default portion). Scaling from this
 * reference keeps calories correct for every named serving, so picking
 * "2 each" on a per-piece product must double, not match, the base energy.
 */
function resolveServing(food: SearchFoodResult, option: FoodServing): FoodServing {
  const unit = food.base_unit || "g"
  const ref = resolveNutrientsRefAmount(food.nutrients, food.serving, unit)
  return {
    serving: option.serving,
    amount: option.amount,
    serving_quantity: ref,
  }
}

/**
 * Resolve a product for the add-food screen. Renders instantly from any
 * cached row, with per-gram search rows normalized for display, and patches
 * in the real product detail when the network answers, so the nutrition
 * preview never waits for YAZIO when the food has been seen before.
 *
 * `needsRefresh` is true for rows that must be replaced by a fresh fetch:
 * search rows (per-gram data, no serving options), legacy rows written before
 * the source marker existed, and any row whose stored data is ambiguous.
 * The caller then refreshes in the background and swaps the screen over.
 */
async function resolveFoodForDisplay(
  productId: string,
  cancelled: boolean,
): Promise<{
  food: SearchFoodResult
  favorite: boolean
  needsRefresh: boolean
  /** Base-unit amount logged the last time this food was consumed. */
  lastAmount: number | null
} | null> {
  const cachedRow = await getCachedFoodById(productId)
  if (!cancelled && cachedRow) {
    const cachedFood = cachedToSearchResult(cachedRow)
    if (cachedFood) {
      const perGram =
        cachedRow.source === "search" &&
        (cachedFood.base_unit === "g" || cachedFood.base_unit === "ml")
      const display = perGram ? normalizePerGramFood(cachedFood) : cachedFood
      return {
        food: { ...display },
        favorite: cachedRow.is_favorite === 1,
        needsRefresh: !isUsableCacheRow(cachedRow, cachedFood),
        lastAmount: cachedRow.last_amount,
      }
    }
  }

  const resolved = (await getFoodRemote(productId)) ?? (await getFoodById(productId))
  if (!resolved) return null
  const initialServing = resolved.servings?.[0] ?? resolved.serving
  return {
    food: { ...resolved, serving: resolveServing(resolved, initialServing) },
    favorite: await getIsFavorite(resolved.product_id),
    needsRefresh: false,
    lastAmount: null,
  }
}

/** Fresh product detail (with named serving options) for the background patch-in. */
async function resolveFoodFresh(
  productId: string,
  cancelled: boolean,
): Promise<SearchFoodResult | null> {
  const fresh = await getFoodRemote(productId)
  if (!fresh || cancelled) return null
  const initialServing = fresh.servings?.[0] ?? fresh.serving
  return { ...fresh, serving: resolveServing(fresh, initialServing) }
}

export default function AddFoodScreen() {
  const safeBack = useSafeBack()
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
  const { settings } = useApp()
  const [food, setFood] = useState<SearchFoodResult | null>(null)
  const [loadingFood, setLoadingFood] = useState(Boolean(productId) || Boolean(entryId))
  const [isFavorite, setIsFavorite] = useState(false)
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [favoriteToggling, setFavoriteToggling] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<MealType>(mealType)
  const [dayEntries, setDayEntries] = useState<DiaryEntry[]>([])
  // True once the user edits the amount. Background detail patches must not
  // clobber a typed or history-prefilled portion.
  const amountTouched = useRef(false)

  useEffect(() => {
    let cancelled = false
    getDiaryEntriesForDate(date, { remote: false })
      .then((entries) => {
        if (!cancelled) {
          setDayEntries(entryId ? entries.filter((e) => e.id !== entryId) : entries)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [date, entryId])

  const currentDayNutrients = useMemo(() => sumNutrients(dayEntries), [dayEntries])

  useEffect(() => {
    if (!productId && !entryId) {
      safeBack()
    }
  }, [productId, entryId, safeBack])

  // Edit mode: load the existing entry and resolve its food (cache, then remote).
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
          // Manual entries have no product, so treat stored totals as the base.
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
          if (resolved.needsRefresh) {
            const fresh = await resolveFoodFresh(entry.food_id, cancelled)
            if (!cancelled && fresh) setFood(fresh)
          }
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
          // Remember the portion used last time; fall back to the serving default.
          setAmount(
            resolved.lastAmount != null
              ? String(resolved.lastAmount)
              : String(resolved.food.serving.amount),
          )
          setIsFavorite(resolved.favorite)
          if (resolved.needsRefresh) {
            const fresh = await resolveFoodFresh(productId, cancelled)
            if (!cancelled && fresh) {
              setFood(fresh)
              // Only adopt the detail default when nothing was prefilled/typed.
              if (!amountTouched.current && resolved.lastAmount == null) {
                setAmount(String(fresh.serving.amount))
              }
            }
          }
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
    const options = food.servings?.length ? food.servings : [food.serving]
    // Some products ship duplicate serving entries (same name + amount).
    // Keep the first occurrence so every chip maps to a distinct amount.
    const seen = new Set<string>()
    return options.filter((option) => {
      const key = `${option.serving}-${option.amount}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [food])

  const preview = useMemo(() => {
    if (!food) return null
    const amt = Number(amount) || 0
    if (amt <= 0) return null
    return nutrientsForAmount(food.nutrients, food.serving, amt, food.base_unit)
  }, [food, amount])

  /**
   * Stepper step follows the selected serving. A named portion such as
   * "1 medium (118g)" steps whole portions, so every press adds the same
   * per-portion value, 118, 236, 354. Plain g or ml servings step 10,
   * countable base units such as each step 1.
   */
  const stepperStep = useMemo(() => {
    const baseUnit = food?.base_unit || "g"
    if (!(baseUnit === "g" || baseUnit === "ml")) return 1
    const name = food?.serving.serving ?? ""
    if (name && !isBaseUnitServingLabel(name, baseUnit)) {
      return food?.serving.amount || 10
    }
    return 10
  }, [food])

  const selectServing = useCallback(
    (option: FoodServing) => {
      if (!food) return
      setFood({ ...food, serving: resolveServing(food, option) })
      setAmount(String(option.amount))
    },
    [food],
  )

  const handleToggleFavorite = async () => {
    if (!food || !productId || favoriteToggling) return
    setFavoriteToggling(true)
    try {
      const next = await toggleFavorite(productId, food)
      setIsFavorite(next)
    } catch (error) {
      showError(error, "Could not update favorite.")
    } finally {
      setFavoriteToggling(false)
    }
  }

  const handleSave = async () => {
    if (saving) return
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
          <LoadingSpinner size={32} />
        </PageContainer>
      </View>
    )
  }

  if (!food) {
    return (
      <View style={styles.center}>
        <PageContainer variant="narrow" contentStyle={styles.centerContent}>
          <Feather name="cloud-off" size={44} color={colors.danger} />
          <Text style={styles.loadingText}>Could not load this food.</Text>
          {productId || entryId ? (
            <Pressable
              onPress={() => safeBack()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.link}>Go back</Text>
            </Pressable>
          ) : null}
        </PageContainer>
      </View>
    )
  }

  const unit = food.base_unit || "g"
  const selectedServingKey = `${food.serving.serving}-${food.serving.amount}`

  const safeBottom = insets.bottom
  const baseTop = insets.top > 0 ? insets.top : Platform.OS === "android" ? 24 : 0
  const safeTop = baseTop + 80

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={safeTop}
    >
      <ModalContainer maxWidth={560}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: spacing.sm, paddingBottom: safeBottom + 96 },
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <PageContainer
            grow={false}
            variant={isWide ? "wide" : "default"}
            contentStyle={isWide ? [styles.page, { maxWidth: 520 }] : styles.page}
          >
            {/* Header: Title, Producer, Date, Favorite, Close */}
            <View style={styles.headerBlock}>
              <View style={styles.titleRow}>
                <View style={styles.titleBlock}>
                  <Text style={styles.title} numberOfLines={2}>
                    {food.name}
                  </Text>
                  {food.producer ? <Text style={styles.producer}>{food.producer}</Text> : null}
                </View>
                {!isEditing ? (
                  <Pressable
                    onPress={handleToggleFavorite}
                    disabled={favoriteToggling}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    accessibilityState={{ disabled: favoriteToggling }}
                    style={{
                      opacity: favoriteToggling ? 0.5 : 1,
                      backgroundColor: isFavorite ? `${colors.warning}18` : "transparent",
                      borderWidth: isFavorite ? 1.5 : 0,
                      borderColor: colors.warning,
                      padding: 6,
                      borderRadius: 0,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={isFavorite ? "star" : "star-outline"}
                      size={26}
                      color={isFavorite ? colors.warning : colors.textMuted}
                    />
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.subtitle}>
                {MEAL_LABELS[selectedMeal]} · {date}
              </Text>
            </View>

            {/* Meal Selector (Edit Mode) */}
            {isEditing ? (
              <View style={styles.mealSection}>
                <Text style={styles.sectionLabel}>Meal</Text>
                <View style={styles.mealRow}>
                  {MEAL_TYPES.map((meal) => {
                    const active = meal === selectedMeal
                    return (
                      <Pressable
                        key={meal}
                        style={[styles.mealChip, active && styles.mealChipSelected]}
                        onPress={() => setSelectedMeal(meal)}
                        accessibilityRole="button"
                        accessibilityLabel={MEAL_LABELS[meal]}
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.mealChipText, active && styles.mealChipTextSelected]}>
                          {MEAL_LABELS[meal]}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : null}

            {/* Compact Portion and Serving Controls - above the fold for thumb reach */}
            <View style={styles.portionCard}>
              <View style={styles.portionHeaderRow}>
                <Text style={styles.portionTitle}>Portion and Serving</Text>
                <Text style={styles.unitBadge}>Base unit: {displayUnit(unit)}</Text>
              </View>

              {/* Serving Unit Chips */}
              {servingOptions.length > 0 ? (
                <View style={styles.servingBlock}>
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
                </View>
              ) : null}

              {/* Amount Stepper Control */}
              <View style={styles.stepperContainer}>
                <NumberStepper
                  value={amount}
                  onChangeText={(text) => {
                    amountTouched.current = true
                    setAmount(text)
                  }}
                  onSubmit={() => void handleSave()}
                  step={stepperStep}
                  decimals={1}
                  accessibilityLabel={`Amount in ${displayUnit(unit)}`}
                />
              </View>

              {/* Quick Multiplier Chips */}
              <View style={styles.multiplierRow}>
                {[0.5, 1, 1.5, 2, 3].map((mult) => (
                  <Pressable
                    key={mult}
                    onPress={() => {
                      const base = food.serving.amount || (unit === "g" || unit === "ml" ? 100 : 1)
                      const val = Math.round(base * mult * 10) / 10
                      amountTouched.current = true
                      setAmount(String(val))
                    }}
                    style={styles.multiplierChip}
                    accessibilityRole="button"
                    accessibilityLabel={`Scale to ${mult}x serving`}
                  >
                    <Text style={styles.multiplierText}>{mult}×</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {preview && (
              <View style={styles.nutritionSection}>
                <NutritionFactsCard
                  nutrients={preview}
                  servingLabel={formatNutrientsServingLabel(food, Number(amount) || 0)}
                  baseAmount={Number(amount) || 100}
                  baseUnit={food.base_unit || "g"}
                />
                <DailyImpactCard
                  currentDayNutrients={currentDayNutrients}
                  itemNutrients={preview}
                  settings={settings}
                />
              </View>
            )}
          </PageContainer>
        </ScrollView>
      </ModalContainer>

      {!keyboardOpen ? (
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
              accessibilityLabel={isEditing ? "Update entry" : "Add to diary"}
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
    scroll: { flex: 1 },
    content: { flexGrow: 1 },
    page: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
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
    headerBlock: {
      marginBottom: 2,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    titleBlock: { flex: 1 },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: -0.2,
      fontFamily: fonts.mono,
    },
    producer: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 2,
      fontFamily: fonts.mono,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 3,
      fontFamily: fonts.mono,
    },
    mealSection: {
      marginBottom: 2,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
      fontFamily: fonts.mono,
    },
    mealRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    mealChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: 0,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    mealChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    mealChipText: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "600",
      fontFamily: fonts.mono,
    },
    mealChipTextSelected: {
      color: colors.onPrimary,
      fontFamily: fonts.mono,
    },
    nutritionSection: {
      gap: spacing.xs,
    },
    portionCard: {
      backgroundColor: colors.surface,
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    portionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 2,
    },
    portionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: 0.2,
      fontFamily: fonts.mono,
    },
    unitBadge: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
    },
    servingBlock: {
      marginBottom: 2,
    },
    servingRow: {
      flexDirection: "row",
      gap: 6,
      paddingBottom: 2,
    },
    chip: {
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: 7,
      borderRadius: 0,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
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
      fontFamily: fonts.mono,
    },
    chipTextSelected: {
      color: colors.onPrimary,
      fontWeight: "700",
      fontFamily: fonts.mono,
    },
    stepperContainer: {
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 2,
    },
    multiplierRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 2,
    },
    multiplierChip: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 7,
      borderRadius: 0,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    multiplierText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
  })
