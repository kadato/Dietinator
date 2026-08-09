import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useDebounce } from "@/hooks/useDebounce"
import { useFoodSearch } from "@/hooks/useFoodSearch"
import { useTheme } from "@/hooks/useTheme"
import { useToast } from "@/context/ToastContext"
import { deleteMeal, getMealById, mealTotals, saveMeal } from "@/services/meals"
import type { MealItem, SearchFoodResult } from "@/types"
import { nutrientsForAmount } from "@/utils/nutrients"
import { routeParam } from "@/utils/route"
import { confirmAction } from "@/utils/confirm"
import { ModalContainer } from "@/components/ModalContainer"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Input, InputField } from "@ui/input"

function servingAmountFor(food: SearchFoodResult): number {
  return food.serving.amount > 0 ? food.serving.amount : 100
}

export default function MealBuilderScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ mealId?: string }>()
  const mealId = routeParam(params.mealId)
  const isEditing = Boolean(mealId)

  const { colors } = useTheme()
  const { showError, showSuccess, showWarning } = useToast()

  const [name, setName] = useState("")
  const [items, setItems] = useState<MealItem[]>([])
  const [query, setQuery] = useState("")
  const debounced = useDebounce(query, 200)
  const [loadingMeal, setLoadingMeal] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  const { foods: results, loading: searching } = useFoodSearch(debounced)

  // Edit mode: load the saved meal.
  useEffect(() => {
    if (!mealId) return
    let cancelled = false
    ;(async () => {
      try {
        const meal = await getMealById(mealId)
        if (cancelled) return
        if (!meal) {
          showError(new Error("Meal not found."), "It may have been deleted.")
          router.back()
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
  }, [mealId, router, showError])

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

  const itemKcal = useCallback(
    (item: MealItem) =>
      nutrientsForAmount(item.nutrients, item.serving, item.amount, item.base_unit).kcal,
    [],
  )

  const handleSave = async () => {
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
      router.back()
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
          router.back()
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
            {isEditing ? "Edit meal" : "New meal"}
          </Text>
          <Box className="w-7" />
        </Box>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <Text size="sm" className="mb-4 text-typography-500">
            Saved meals are ready to log into any meal slot.
          </Text>

          <Text size="xs" bold className="mb-1.5 text-typography-600">
            MEAL NAME
          </Text>
          <Input size="md" variant="outline" className="mb-4 bg-background-50">
            <InputField
              placeholder="e.g. Cornflakes with milk"
              value={name}
              onChangeText={setName}
              autoCorrect={false}
              accessibilityLabel="Meal name"
            />
          </Input>

          {items.length > 0 ? (
            <>
              <Text size="xs" bold className="mb-1.5 text-typography-600">
                IN YOUR MEAL · {Math.round(totals.kcal)} KCAL
              </Text>
              {items.map((item) => (
                <Box
                  key={item.product_id}
                  className="mb-2 flex-row items-center gap-2 rounded-2xl border border-outline-200 bg-background-50 px-3 py-2.5"
                >
                  <Box className="min-w-0 flex-1">
                    <Text size="md" bold className="text-typography-900" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text size="xs" className="mt-0.5 text-typography-500">
                      {Math.round(itemKcal(item))} kcal
                    </Text>
                  </Box>
                  <TextInput
                    className="w-20 rounded-lg border border-outline-300 bg-background-0 px-3 py-2 text-right text-typography-900"
                    keyboardType="decimal-pad"
                    value={item.amount === 0 ? "" : String(item.amount)}
                    onChangeText={(value) => setItemAmount(item.product_id, value)}
                    accessibilityLabel={`Amount for ${item.name} in ${item.base_unit}`}
                  />
                  <Text size="xs" className="w-6 text-typography-500">
                    {item.base_unit}
                  </Text>
                  <Pressable
                    onPress={() => removeItem(item.product_id)}
                    hitSlop={8}
                    className="p-1"
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.name}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                </Box>
              ))}
            </>
          ) : (
            <Text size="sm" className="mb-5 mt-2 px-6 text-center leading-5 text-typography-500">
              No foods in this meal yet — use the search below to add them.
            </Text>
          )}

          <Text size="xs" bold className="mb-1.5 mt-4 text-typography-600">
            ADD FOODS
          </Text>
          <Input size="md" variant="rounded" className="mb-2 bg-background-50">
            <InputField
              placeholder="Search foods..."
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search foods to add"
            />
          </Input>
          {searching ? <ActivityIndicator className="py-2" color={colors.primary} /> : null}
          {results.map((food) => (
            <Pressable
              key={food.product_id}
              className="mb-2 flex-row items-center rounded-2xl border border-outline-200 bg-background-50 px-4 py-3 active:opacity-90"
              onPress={() => addFood(food)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${food.name}`}
            >
              <Box className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary-500/15">
                <Ionicons name="add" size={20} color={colors.primary} />
              </Box>
              <Box className="min-w-0 flex-1">
                <Text size="md" bold className="text-typography-900" numberOfLines={1}>
                  {food.name}
                </Text>
                <Text size="xs" className="mt-0.5 text-typography-500" numberOfLines={1}>
                  {food.producer?.trim()
                    ? `${food.producer}, ${Math.round(food.nutrients.kcal)} kcal per ${food.serving.serving}`
                    : `${Math.round(food.nutrients.kcal)} kcal per ${food.serving.serving}`}
                </Text>
              </Box>
            </Pressable>
          ))}
          {!searching && query.trim().length > 0 && results.length === 0 ? (
            <Text size="sm" className="py-3 text-center text-typography-500">
              No foods found. Try a different search.
            </Text>
          ) : null}

          <Pressable
            className={`mt-6 items-center rounded-xl py-3.5 ${saving ? "opacity-60" : ""}`}
            style={{ backgroundColor: colors.primary }}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? "Save meal changes" : "Create meal"}
          >
            <Text size="md" bold className="text-typography-0">
              {saving ? "Saving..." : isEditing ? "Save changes" : "Create meal"}
            </Text>
          </Pressable>

          {isEditing ? (
            <Pressable
              className="mt-4 items-center"
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete meal"
            >
              <Text size="md" bold style={{ color: colors.danger }}>
                Delete meal
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </ModalContainer>
    </KeyboardAvoidingView>
  )
}
