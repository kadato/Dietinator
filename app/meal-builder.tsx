import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native"
import { useLocalSearchParams } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useDebounce } from "@/hooks/useDebounce"
import { useFoodSearch } from "@/hooks/useFoodSearch"
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible"
import { useTheme } from "@/hooks/useTheme"
import { useSafeBack } from "@/hooks/useSafeBack"
import { useToast } from "@/context/ToastContext"
import { deleteMeal, getMealById, mealTotals, saveMeal } from "@/services/meals"
import { getFavoriteFoods, getRecentFoods } from "@/db/food-cache"
import { mergeFoodResults } from "@/utils/food-search"
import type { MealItem, SearchFoodResult } from "@/types"
import { nutrientsForAmount } from "@/utils/nutrients"
import { routeParam } from "@/utils/route"
import { confirmAction } from "@/utils/confirm"
import { ModalContainer } from "@/components/ModalContainer"
import { FoodListItem } from "@/components/FoodListItem"
import { MacroPills } from "@/components/MacroPills"
import { NumberStepper } from "@/components/NumberStepper"
import { NutritionFactsCard } from "@/components/NutritionFactsCard"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { fonts } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Input, InputField } from "@ui/input"

function servingAmountFor(food: SearchFoodResult): number {
  return food.serving.amount > 0 ? food.serving.amount : 100
}

export default function MealBuilderScreen() {
  const safeBack = useSafeBack()
  const params = useLocalSearchParams<{ mealId?: string }>()
  const mealId = routeParam(params.mealId)
  const isEditing = Boolean(mealId)

  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { showError, showSuccess, showWarning } = useToast()
  const keyboardOpen = useKeyboardVisible()

  const [name, setName] = useState("")
  const [items, setItems] = useState<MealItem[]>([])
  const [query, setQuery] = useState("")
  const debounced = useDebounce(query, 200)
  const [loadingMeal, setLoadingMeal] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  const emptyQuery = useCallback(async () => {
    const [favorites, recent] = await Promise.all([getFavoriteFoods(), getRecentFoods(20)])
    return mergeFoodResults(favorites, recent)
  }, [])

  const { foods: results, loading: searching } = useFoodSearch(debounced, { emptyQuery })

  const isBlank = !debounced.trim()
  const cappedResults = useMemo(() => results.slice(0, isBlank ? 12 : 30), [isBlank, results])

  useEffect(() => {
    if (!mealId) return
    let cancelled = false
    ;(async () => {
      try {
        const meal = await getMealById(mealId)
        if (cancelled) return
        if (!meal) {
          showError(new Error("Meal not found."), "It may have been deleted.")
          safeBack()
          return
        }
        setName(meal.name)
        setItems(meal.items)
      } catch (error) {
        if (!cancelled) showError(error, "Could not load meal.")
      } finally {
        if (!cancelled) setLoadingMeal(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mealId, safeBack, showError])

  const addFood = useCallback((food: SearchFoodResult) => {
    const addAmount = servingAmountFor(food)
    setItems((prev) => {
      const existing = prev.find((item) => item.product_id === food.product_id)
      if (existing) {
        return prev.map((item) =>
          item.product_id === food.product_id
            ? { ...item, amount: Math.round((item.amount + addAmount) * 10) / 10 }
            : item,
        )
      }
      return [
        ...prev,
        {
          product_id: food.product_id,
          name: food.name,
          producer: food.producer ?? "",
          amount: addAmount,
          base_unit: food.base_unit || "g",
          nutrients: food.nutrients,
          serving: food.serving,
        },
      ]
    })
  }, [])

  const setItemAmount = useCallback((productId: string, value: string) => {
    const parsed = Number(value)
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, amount: value === "" ? 0 : Number.isFinite(parsed) ? parsed : item.amount }
          : item,
      ),
    )
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId))
  }, [])

  const totals = useMemo(() => mealTotals({ items }), [items])

  const itemNutrients = useCallback(
    (item: MealItem) =>
      nutrientsForAmount(item.nutrients, item.serving, item.amount, item.base_unit),
    [],
  )

  const handleSave = async () => {
    if (saving) return
    if (!name.trim()) {
      showWarning("Give your meal a name.", "Missing name")
      return
    }
    if (items.length === 0) {
      showWarning("Add at least one food to the meal.", "No foods yet")
      return
    }
    setSaving(true)
    try {
      await saveMeal({ id: mealId ?? undefined, name: name.trim(), items })
      showSuccess(isEditing ? "Meal updated." : "Meal saved.", isEditing ? "Updated" : "Saved")
      safeBack()
    } catch (error) {
      showError(error, "Could not save meal.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    if (!mealId) return
    confirmAction({
      title: "Delete meal?",
      message: `Remove "${name.trim() || "this meal"}" from your meals?`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await deleteMeal(mealId)
          showSuccess("Meal deleted.", "Done")
          safeBack()
        } catch (error) {
          showError(error, "Could not delete meal.")
        }
      },
    })
  }

  if (loadingMeal) {
    return (
      <Box className="flex-1 items-center justify-center bg-background-0">
        <ActivityIndicator color={colors.primary} />
      </Box>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background-0"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ModalContainer maxWidth={640}>
        <Box
          className="flex-row items-center justify-between px-3 pb-2"
          style={{ paddingTop: insets.top > 0 ? insets.top + 8 : 16 }}
        >
          <Box className="w-10" />
          <Text
            size="xl"
            bold
            className="flex-1 text-center font-mono uppercase tracking-widest text-typography-900"
            style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
          >
            {isEditing ? "Edit meal" : "New meal"}
          </Text>
          {isEditing ? (
            <Pressable
              onPress={handleDelete}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-none border bg-background-100 active:bg-background-200"
              style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
              accessibilityRole="button"
              accessibilityLabel="Delete meal"
            >
              <Feather name="trash-2" size={18} color={colors.danger} />
            </Pressable>
          ) : (
            <Box className="w-10" />
          )}
        </Box>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-3 pb-32"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Text
            size="xs"
            className="mb-4 font-mono uppercase tracking-widest text-typography-500"
            style={{ fontFamily: fonts.mono, letterSpacing: 0.06 }}
          >
            Ready to log into any meal slot.
          </Text>

          <Text
            size="xs"
            bold
            className="mb-1.5 font-mono uppercase tracking-widest text-typography-600"
            style={{ fontFamily: fonts.mono, letterSpacing: 0.08 }}
          >
            Meal name
          </Text>
          <Input
            size="md"
            variant="outline"
            className="mb-4 rounded-none border bg-background-50"
            style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
          >
            <InputField
              placeholder="Cornflakes with milk"
              value={name}
              onChangeText={setName}
              autoCorrect={false}
              accessibilityLabel="Meal name"
              returnKeyType="done"
              onSubmitEditing={() => void handleSave()}
              style={{ fontFamily: fonts.mono }}
            />
          </Input>

          {items.length > 0 ? (
            <>
              <Text
                size="xs"
                bold
                className="mb-1.5 font-mono uppercase tracking-widest text-typography-600"
                style={{ fontFamily: fonts.mono, letterSpacing: 0.08 }}
              >
                In your meal · {Math.round(totals.kcal)} kcal
              </Text>
              {items.map((item) => {
                const itemN = itemNutrients(item)
                return (
                  <Box
                    key={item.product_id}
                    className="mb-2.5 flex-row items-center gap-2.5 border bg-background-50 px-3.5 py-3"
                    style={{
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      borderRadius: 0,
                      backgroundColor: colors.surface,
                      boxShadow: "none",
                      elevation: 0,
                    }}
                  >
                    <Box className="min-w-0 flex-1">
                      <Text
                        size="md"
                        bold
                        className="font-mono uppercase tracking-widest text-typography-900"
                        style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Box className="mt-1 min-w-0 flex-row flex-wrap items-center gap-1.5">
                        <Text
                          size="xs"
                          className="font-mono uppercase tabular-nums tracking-widest text-typography-500"
                          style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
                        >
                          {Math.round(itemN.kcal)} kcal
                        </Text>
                        <MacroPills
                          protein={itemN.protein}
                          carbs={itemN.carbs}
                          fat={itemN.fat}
                          size="xs"
                        />
                      </Box>
                    </Box>
                    <NumberStepper
                      value={item.amount === 0 ? "" : String(item.amount)}
                      onChangeText={(value) => setItemAmount(item.product_id, value)}
                      onSubmit={() => void handleSave()}
                      step={item.base_unit === "g" || item.base_unit === "ml" ? 10 : 1}
                      decimals={1}
                      size="sm"
                      accessibilityLabel={`Amount for ${item.name} in ${item.base_unit}`}
                    />
                    <Text
                      size="xs"
                      className="w-6 font-mono uppercase text-typography-500"
                      style={{ fontFamily: fonts.mono }}
                    >
                      {item.base_unit}
                    </Text>
                    <Pressable
                      onPress={() => removeItem(item.product_id)}
                      hitSlop={6}
                      className="h-8 w-8 items-center justify-center rounded-none border"
                      style={{
                        backgroundColor: `${colors.danger}14`,
                        borderWidth: 1.5,
                        borderColor: colors.border,
                        borderRadius: 0,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.name}`}
                    >
                      <Feather name="trash-2" size={15} color={colors.danger} />
                    </Pressable>
                  </Box>
                )
              })}

              <Box className="mb-4 mt-2">
                <NutritionFactsCard
                  nutrients={totals}
                  servingLabel={
                    items.length === 1 ? "1 food in meal" : `${items.length} foods in meal total`
                  }
                  baseAmount={items.reduce((s, i) => s + (i.amount || 0), 0) || 100}
                />
              </Box>
            </>
          ) : (
            <Text
              size="sm"
              className="mb-5 mt-2 px-6 text-center font-mono leading-5 text-typography-500"
              style={{ fontFamily: fonts.mono }}
            >
              No foods in this meal yet. Use the search below to add them.
            </Text>
          )}

          <Text
            size="xs"
            bold
            className="mb-1.5 mt-4 font-mono uppercase tracking-widest text-typography-600"
            style={{ fontFamily: fonts.mono, letterSpacing: 0.08 }}
          >
            Add foods
          </Text>
          <Input
            size="md"
            variant="outline"
            className="mb-2 rounded-none border bg-background-50"
            style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
          >
            <InputField
              placeholder="Search foods..."
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              accessibilityLabel="Search foods to add"
              style={{ fontFamily: fonts.mono }}
            />
          </Input>
          {isBlank && results.length > 0 ? (
            <Text
              size="xs"
              bold
              className="mb-2 mt-1 font-mono uppercase tracking-widest text-typography-600"
              style={{ fontFamily: fonts.mono, letterSpacing: 0.08 }}
            >
              Favorite and recent picks
            </Text>
          ) : null}
          {searching ? <ActivityIndicator className="py-2" color={colors.primary} /> : null}
          {cappedResults.map((food) => (
            <FoodListItem
              key={food.product_id}
              food={food}
              accentColor={colors.primary}
              onPress={() => addFood(food)}
              onQuickAdd={() => addFood(food)}
              quickAddVariant="pill"
            />
          ))}
          {!searching && !isBlank && query.trim().length > 0 && results.length > 30 ? (
            <Text
              size="xs"
              className="py-2 text-center font-mono uppercase tracking-widest text-typography-500"
              style={{ fontFamily: fonts.mono }}
            >
              Showing the first 30 results. Refine your search for more.
            </Text>
          ) : null}
          {!searching && !isBlank && query.trim().length > 0 && results.length === 0 ? (
            <Text
              size="sm"
              className="py-3 text-center font-mono text-typography-500"
              style={{ fontFamily: fonts.mono }}
            >
              No foods found. Try a different search.
            </Text>
          ) : null}

          {isEditing ? (
            <Pressable
              className="mt-8 items-center rounded-none active:opacity-80"
              onPress={handleDelete}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Delete meal"
              style={{ borderWidth: 1.5, borderColor: "transparent", borderRadius: 0 }}
            >
              <Text
                size="md"
                bold
                className="font-mono uppercase tracking-widest"
                style={{ color: colors.danger, fontFamily: fonts.mono, letterSpacing: 0.06 }}
              >
                Delete meal
              </Text>
            </Pressable>
          ) : null}
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
              onPress={() => void handleSave()}
              disabled={saving}
              accessibilityLabel={isEditing ? "Save meal changes" : "Create meal"}
            />
          }
        />
      ) : null}
    </KeyboardAvoidingView>
  )
}
