import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, Pressable } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useToast } from "@/context/ToastContext"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { deleteMeal, listMeals, logMealToDiary, mealTotals, saveMeal } from "@/services/meals"
import { confirmAction } from "@/utils/confirm"
import type { Meal, MealType } from "@/types"
import { PageContainer } from "@/components/PageContainer"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { EmptyState } from "@/components/EmptyState"
import { MealSlotModal } from "@/components/MealSlotModal"
import { layout, spacing } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Input, InputField, InputIcon } from "@ui/input"

export default function MealsScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const { isWide, isMedium } = useLayout()
  const insets = useSafeAreaInsets()
  const { showError, showSuccess, showWarning, showUndo } = useToast()
  const [meals, setMeals] = useState<Meal[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [pendingLog, setPendingLog] = useState<Meal | null>(null)

  const load = useCallback(async () => {
    try {
      setMeals(await listMeals())
    } catch (error) {
      showError(error, "Could not load meals.")
    } finally {
      setLoading(false)
    }
  }, [showError])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  // Meals are stored locally — the query filters by name so the list stays
  // searchable without a network round trip.
  const filteredMeals = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return meals
    return meals.filter((meal) => meal.name.toLowerCase().includes(q))
  }, [meals, query])

  const totalsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof mealTotals>>()
    for (const meal of meals) map.set(meal.id, mealTotals(meal))
    return map
  }, [meals])

  const openBuilder = useCallback(
    (mealId?: string) => {
      router.push({
        pathname: "/meal-builder",
        params: mealId ? { mealId } : {},
      })
    },
    [router],
  )

  const handleLog = useCallback(
    async (meal: Meal, mealType: MealType, dateKey: string) => {
      setPendingLog(null)
      if (loggingId) return
      setLoggingId(meal.id)
      try {
        const { logged, skipped } = await logMealToDiary({
          date: dateKey,
          mealType,
          meal,
        })
        if (logged === 0) {
          showWarning("No items in this meal could be logged.", "Nothing logged")
        } else {
          showSuccess(
            logged === 1
              ? `Logged 1 item from "${meal.name}".`
              : `Logged ${logged} items from "${meal.name}".`,
            "Meal logged",
          )
        }
        if (skipped.length > 0) {
          showWarning(
            `Could not log: ${skipped.join(", ")}. Check your connection and try again.`,
            "Some items skipped",
          )
        }
      } catch (error) {
        showError(error, "Could not log this meal.")
      } finally {
        setLoggingId(null)
      }
    },
    [loggingId, showError, showSuccess, showWarning],
  )

  const handleDelete = useCallback(
    (meal: Meal) => {
      confirmAction({
        title: "Delete meal?",
        message: `Remove "${meal.name}" from your meals?`,
        confirmLabel: "Delete",
        onConfirm: async () => {
          try {
            await deleteMeal(meal.id)
            await load()
            showUndo(`"${meal.name}" removed.`, () => {
              saveMeal({ id: meal.id, name: meal.name, items: meal.items })
                .then(() => load())
                .catch(() => undefined)
            })
          } catch (error) {
            showError(error, "Could not delete meal.")
          }
        },
      })
    },
    [load, showError, showUndo],
  )

  const renderMeal = useCallback(
    ({ item }: { item: Meal }) => {
      const totals = totalsById.get(item.id)
      const kcal = Math.round(totals?.kcal ?? 0)
      return (
        <Box className="mb-2 flex-row items-center gap-3 rounded-2xl border border-outline-200 bg-background-50 px-4 py-3.5">
          <Pressable
            className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
            onPress={() => openBuilder(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
          >
            <Box className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/15">
              <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
            </Box>
            <Box className="min-w-0 flex-1">
              <Text size="md" bold className="text-typography-900" numberOfLines={1}>
                {item.name}
              </Text>
              <Text size="xs" className="mt-0.5 text-typography-500" numberOfLines={1}>
                {item.items.length === 1
                  ? `1 food · ${kcal} Cal`
                  : `${item.items.length} foods · ${kcal} Cal`}
              </Text>
            </Box>
          </Pressable>
          <Pressable
            onPress={() => setPendingLog(item)}
            disabled={loggingId === item.id}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary }}
            accessibilityRole="button"
            accessibilityLabel={`Log ${item.name}`}
          >
            {loggingId === item.id ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons name="add" size={20} color={colors.onPrimary} />
            )}
          </Pressable>
          <Pressable
            onPress={() => handleDelete(item)}
            hitSlop={8}
            className="p-2"
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
          >
            <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
          </Pressable>
        </Box>
      )
    },
    [colors, handleDelete, loggingId, openBuilder, totalsById],
  )

  const emptyState = (
    <EmptyState
      icon="restaurant-outline"
      iconColor={colors.primary}
      title="No meals yet"
      message="Save combos and log them in one tap."
      className="pt-14"
    />
  )

  return (
    <Box className="flex-1 bg-background-0">
      <PageContainer variant={isWide ? "wide" : "default"} className="flex-1">
        <Box className="px-6 pb-3" style={{ paddingTop: insets.top + spacing.md }}>
          <Text size="2xl" bold style={{ color: colors.textOnBackground }}>
            Meals
          </Text>
          <Text size="xs" className="mt-1 text-typography-500">
            Reusable combinations, logged in one tap
          </Text>
          <Input size="md" variant="rounded" className="mt-3 bg-background-50">
            <InputIcon>
              <Ionicons name="search" size={18} color={colors.textMuted} />
            </InputIcon>
            <InputField
              placeholder="Search meals…"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              accessibilityLabel="Search meals"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery("")}
                className="pr-3"
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear meal search"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </Input>
        </Box>
        {loading ? (
          <Box className="items-center py-6">
            <ActivityIndicator color={colors.primary} />
          </Box>
        ) : (
          <FlatList
            className="flex-1"
            data={filteredMeals}
            contentContainerClassName={
              filteredMeals.length === 0 ? "grow justify-center pb-8" : "pt-1 pb-36"
            }
            keyExtractor={(item) => item.id}
            renderItem={renderMeal}
            ListEmptyComponent={
              query.trim() ? (
                <EmptyState
                  icon="search-outline"
                  iconColor={colors.primary}
                  title="No meals found"
                  message={`Nothing matches "${query.trim()}".`}
                  className="pt-14"
                />
              ) : (
                emptyState
              )
            }
          />
        )}
      </PageContainer>

      <FabCluster
        right={
          <Fab
            icon="add"
            label={isMedium ? "New meal" : undefined}
            onPress={() => openBuilder()}
            accessibilityLabel="Create a new meal"
          />
        }
        bottomOffset={layout.tabBarHeight + insets.bottom + 24}
      />

      <MealSlotModal
        visible={pendingLog !== null}
        title={pendingLog ? `Log "${pendingLog.name}" into…` : "Log meal into…"}
        onSelect={(slot, dateKey) => {
          if (pendingLog) void handleLog(pendingLog, slot, dateKey)
        }}
        onClose={() => setPendingLog(null)}
      />
    </Box>
  )
}
