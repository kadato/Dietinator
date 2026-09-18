import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useDebounce } from "@/hooks/useDebounce"
import { useFoodSearch } from "@/hooks/useFoodSearch"
import { useTheme } from "@/hooks/useTheme"
import { useSafeBack } from "@/hooks/useSafeBack"
import { useToast } from "@/context/ToastContext"
import { deleteMeal, duplicateMeal, getMealById, mealTotals, saveMeal } from "@/services/meals"
import { consumePendingMealFood } from "@/services/meal-scan-pending"
import { getFavoriteFoods, getRecentFoods } from "@/db/food-cache"
import { mergeFoodResults } from "@/utils/food-search"
import type { MealItem, SearchFoodResult } from "@/types"
import { nutrientsForAmount } from "@/utils/nutrients"
import { routeParam } from "@/utils/route"
import { confirmAction } from "@/utils/confirm"
import { ModalContainer } from "@/components/ModalContainer"
import { FoodListItem } from "@/components/FoodListItem"
import { MacroPills } from "@/components/MacroPills"
import { NutritionFactsCard } from "@/components/NutritionFactsCard"
import { NumberStepper } from "@/components/NumberStepper"

import { fonts, spacing, borders, radii, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Input, InputField } from "@ui/input"

function servingAmountFor(food: SearchFoodResult): number {
  return food.serving.amount > 0 ? food.serving.amount : 100
}

export default function MealBuilderScreen() {
  const safeBack = useSafeBack()
  const router = useRouter()
  const params = useLocalSearchParams<{ mealId?: string }>()
  const mealId = routeParam(params.mealId)
  const isEditing = Boolean(mealId)

  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const bottomStyles = useMemo(() => createBottomStyles(colors), [colors])
  const { showError, showSuccess, showWarning } = useToast()

  const [name, setName] = useState("")
  const [items, setItems] = useState<MealItem[]>([])
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<TextInput>(null)
  const debounced = useDebounce(query, 200)
  const [loadingMeal, setLoadingMeal] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const openSearch = useCallback(() => {
    setSearchOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setQuery("")
    setSearchOpen(false)
    searchInputRef.current?.blur()
  }, [])

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"

    const onShow = (e: { endCoordinates?: { height?: number } }) => {
      if (Platform.OS === "ios") {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      }
      setKeyboardHeight(e.endCoordinates?.height ?? 0)
    }
    const onHide = () => {
      if (Platform.OS === "ios") {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      }
      setKeyboardHeight(0)
    }

    const showSub = Keyboard.addListener(showEvent, onShow)
    const hideSub = Keyboard.addListener(hideEvent, onHide)

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.visualViewport) return
    const vv = window.visualViewport
    const update = () => {
      const offset = Math.max(0, Math.round(window.innerHeight - vv.height))
      setKeyboardHeight(offset > 50 ? offset : 0)
    }
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])

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

  // A barcode scanned from this screen lands here on return. The builder stays
  // mounted under the scan modal, so the pending food is picked up on focus
  // without losing the typed name or the items already added.
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingMealFood()
      if (pending) {
        addFood(pending)
        showSuccess(`${pending.name} added.`, "Scanned")
      }
    }, [addFood, showSuccess]),
  )

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

  const handleDuplicate = async () => {
    if (!mealId) return
    try {
      const dup = await duplicateMeal(mealId)
      showSuccess(`Duplicated "${dup.name}".`, "Meal duplicated")
      safeBack()
    } catch (error) {
      showError(error, "Could not duplicate meal.")
    }
  }

  if (loadingMeal) {
    return (
      <Box
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.surfaceAlt }}
      >
        <ActivityIndicator color={colors.primary} />
      </Box>
    )
  }

  const safeBottom = insets.bottom
  const bottomOffset = keyboardHeight > 0 ? keyboardHeight + 8 : safeBottom + 12

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <ModalContainer surface maxWidth={640}>
        <Box className="flex-row items-center justify-between px-3 pb-2 pt-3">
          <Box className="w-10" />
          <Text
            size="xl"
            bold
            className="flex-1 text-center font-mono uppercase tracking-widest"
            style={{ color: colors.text, fontFamily: fonts.mono, letterSpacing: 0.04 }}
          >
            {isEditing ? "Edit meal" : "New meal"}
          </Text>
          {isEditing ? (
            <Box className="flex-row items-center gap-2">
              <Pressable
                onPress={handleDuplicate}
                hitSlop={8}
                className="h-10 w-10 items-center justify-center rounded-none border active:bg-background-200"
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderRadius: radii.none,
                }}
                accessibilityRole="button"
                accessibilityLabel="Duplicate meal"
              >
                <Feather name="copy" size={18} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={handleDelete}
                hitSlop={8}
                className="h-10 w-10 items-center justify-center rounded-none border active:bg-background-200"
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderRadius: radii.none,
                }}
                accessibilityRole="button"
                accessibilityLabel="Delete meal"
              >
                <Feather name="trash-2" size={18} color={colors.danger} />
              </Pressable>
            </Box>
          ) : (
            <Box className="w-10" />
          )}
        </Box>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: keyboardHeight > 0 ? keyboardHeight + 96 : 132,
          }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Box className="px-3">
            <Text
              size="xs"
              className="mb-4 font-mono uppercase tracking-widest"
              style={{ color: colors.textMuted, fontFamily: fonts.mono, letterSpacing: 0.06 }}
            >
              Ready to log into any meal slot.
            </Text>

            <Text
              size="xs"
              bold
              className="mb-1.5 font-mono uppercase tracking-widest"
              style={{ color: colors.text, fontFamily: fonts.mono, letterSpacing: 0.08 }}
            >
              Meal name
            </Text>
            <Input
              size="md"
              variant="outline"
              className="mb-4 rounded-none border"
              style={{
                backgroundColor: colors.surface,
                borderWidth: borders.width,
                borderColor: colors.border,
                borderRadius: radii.none,
              }}
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
                  className="mb-1.5 font-mono uppercase tracking-widest"
                  style={{ color: colors.text, fontFamily: fonts.mono, letterSpacing: 0.08 }}
                >
                  In your meal · {Math.round(totals.kcal)} kcal
                </Text>
                {items.map((item) => {
                  const itemN = itemNutrients(item)
                  return (
                    <Box
                      key={item.product_id}
                      className="mb-2.5 flex-row items-center gap-2.5 border px-3.5 py-3"
                      style={{
                        borderWidth: borders.width,
                        borderColor: colors.border,
                        borderRadius: radii.none,
                        backgroundColor: colors.surface,
                        boxShadow: "none",
                        elevation: 0,
                      }}
                    >
                      <Box className="min-w-0 flex-1">
                        <Text
                          size="md"
                          bold
                          className="font-mono uppercase tracking-widest"
                          style={{
                            color: colors.text,
                            fontFamily: fonts.mono,
                            letterSpacing: 0.04,
                          }}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Box className="mt-1 min-w-0 flex-row flex-wrap items-center gap-1.5">
                          <Text
                            size="xs"
                            className="font-mono uppercase tabular-nums tracking-widest"
                            style={{
                              color: colors.textMuted,
                              fontFamily: fonts.mono,
                              letterSpacing: 0.04,
                            }}
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
                        className="w-6 font-mono uppercase"
                        style={{ color: colors.textMuted, fontFamily: fonts.mono }}
                      >
                        {item.base_unit}
                      </Text>
                      <Pressable
                        onPress={() => removeItem(item.product_id)}
                        hitSlop={6}
                        className="h-8 w-8 items-center justify-center rounded-none border"
                        style={{
                          backgroundColor: `${colors.danger}14`,
                          borderWidth: borders.width,
                          borderColor: colors.border,
                          borderRadius: radii.none,
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
                className="mb-5 mt-2 px-6 text-center font-mono leading-5"
                style={{ color: colors.textMuted, fontFamily: fonts.mono }}
              >
                No foods in this meal yet. Use the search below to add them.
              </Text>
            )}

            <Text
              size="xs"
              bold
              className="mb-1.5 mt-4 font-mono uppercase tracking-widest"
              style={{ color: colors.text, fontFamily: fonts.mono, letterSpacing: 0.08 }}
            >
              Add foods
            </Text>
            {isBlank && results.length > 0 ? (
              <Text
                size="xs"
                bold
                className="mb-2 mt-1 font-mono uppercase tracking-widest"
                style={{ color: colors.text, fontFamily: fonts.mono, letterSpacing: 0.08 }}
              >
                Favorite and recent picks
              </Text>
            ) : null}
            {searching ? <ActivityIndicator className="py-2" color={colors.primary} /> : null}
          </Box>

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

          <Box className="px-3">
            {!searching && !isBlank && query.trim().length > 0 && results.length > 30 ? (
              <Text
                size="xs"
                className="py-2 text-center font-mono uppercase tracking-widest"
                style={{ color: colors.textMuted, fontFamily: fonts.mono }}
              >
                Showing the first 30 results. Refine your search for more.
              </Text>
            ) : null}
            {!searching && !isBlank && query.trim().length > 0 && results.length === 0 ? (
              <Text
                size="sm"
                className="py-3 text-center font-mono"
                style={{ color: colors.textMuted, fontFamily: fonts.mono }}
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
                style={{
                  borderWidth: borders.width,
                  borderColor: "transparent",
                  borderRadius: radii.none,
                }}
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
          </Box>
        </ScrollView>

        {/* Bottom floating keys, same as food search: back, expanding search,
            scan, save. Enclosed in ModalContainer so on big screens it is
            anchored inside the modal column, identical to the meal search page. */}
        <View
          style={[bottomStyles.bottomCluster, { bottom: bottomOffset }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={safeBack}
            hitSlop={8}
            style={bottomStyles.dockIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          {searchOpen ? (
            <View style={[bottomStyles.searchExpanded, { borderColor: colors.primary }]}>
              <Pressable
                onPress={closeSearch}
                hitSlop={8}
                style={bottomStyles.searchCollapse}
                accessibilityRole="button"
                accessibilityLabel="Close search"
              >
                <Feather name="chevron-down" size={22} color={colors.textMuted} />
              </Pressable>
              <TextInput
                ref={searchInputRef}
                style={bottomStyles.searchInput}
                className="logmeal-search-input"
                placeholder="Search foods…"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoFocus
                returnKeyType="search"
                enterKeyHint="search"
                onSubmitEditing={() => searchInputRef.current?.blur()}
                accessibilityLabel="Search foods"
              />
              {query.length > 0 ? (
                <Pressable
                  style={bottomStyles.searchClear}
                  onPress={() => setQuery("")}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Feather name="x-circle" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={openSearch}
              hitSlop={8}
              style={bottomStyles.searchFab}
              accessibilityRole="button"
              accessibilityLabel="Search foods"
            >
              <Feather name="search" size={20} color={colors.textMuted} />
              <Text style={bottomStyles.searchFabText}>Search foods…</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push({ pathname: "/scan", params: { from: "meal-builder" } })}
            hitSlop={8}
            style={[bottomStyles.dockIconBtn, bottomStyles.dockScanBtn]}
            accessibilityRole="button"
            accessibilityLabel="Scan barcode"
          >
            <MaterialCommunityIcons name="barcode-scan" size={24} color={colors.onPrimary} />
          </Pressable>
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving}
            hitSlop={8}
            style={[
              bottomStyles.dockIconBtn,
              bottomStyles.dockSaveBtn,
              saving && bottomStyles.dockSaveBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? "Save meal changes" : "Create meal"}
            accessibilityState={{ disabled: saving }}
          >
            <Feather name="check" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
      </ModalContainer>
    </View>
  )
}

const createBottomStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    bottomCluster: {
      position: "absolute",
      left: spacing.md,
      right: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      zIndex: 10,
      elevation: 5,
    },
    searchFab: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    searchFabText: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: fonts.mono,
      letterSpacing: 0.4,
      color: colors.textMuted,
    },
    searchExpanded: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      minHeight: 56,
      backgroundColor: colors.surface,
      borderRadius: radii.none,
      borderWidth: borders.width,
      paddingLeft: 2,
      paddingRight: 2,
      gap: 2,
    },
    searchCollapse: {
      width: 44,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      backgroundColor: "transparent",
      borderWidth: 0,
      paddingVertical: 12,
      fontSize: 15,
      fontWeight: "700",
      fontFamily: fonts.mono,
      letterSpacing: 0.4,
      color: colors.text,
    },
    searchClear: {
      width: 44,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    dockIconBtn: {
      width: 56,
      height: 56,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    dockScanBtn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dockSaveBtn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dockSaveBtnDisabled: {
      opacity: 0.5,
    },
  })
