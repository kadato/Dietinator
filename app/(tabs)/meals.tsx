import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useToast } from "@/context/ToastContext"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useLayout } from "@/hooks/useLayout"
import { deleteMeal, listMeals, logMealToDiary, mealTotals } from "@/services/meals"
import { toDateKey } from "@/utils/date"
import { confirmAction } from "@/utils/confirm"
import { MEAL_LABELS } from "@/utils/meals"
import type { Meal, MealType } from "@/types"
import { PageContainer } from "@/components/PageContainer"
import { spacing, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

export default function MealsScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const { showError, showSuccess, showWarning } = useToast()
  const [meals, setMeals] = useState<Meal[]>([])
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
    async (meal: Meal, mealType: MealType) => {
      setPendingLog(null)
      if (loggingId) return
      setLoggingId(meal.id)
      try {
        const { logged, skipped } = await logMealToDiary({
          date: toDateKey(),
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
            showSuccess("Meal deleted.", "Done")
          } catch (error) {
            showError(error, "Could not delete meal.")
          }
        },
      })
    },
    [load, showError, showSuccess],
  )

  const renderMeal = useCallback(
    ({ item }: { item: Meal }) => {
      const totals = totalsById.get(item.id)
      const kcal = Math.round(totals?.kcal ?? 0)
      return (
        <Box className="mb-2 flex-row items-center gap-3 rounded-2xl border border-outline-200 bg-background-50 px-4 py-3.5">
          <Pressable
            className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-90"
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
            className="p-1"
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
    <Box className="items-center px-6 pb-10 pt-14">
      <Box className="h-20 w-20 items-center justify-center rounded-2xl bg-background-50 shadow-soft-1">
        <Ionicons name="restaurant-outline" size={36} color={colors.primary} />
      </Box>
      <Text size="lg" bold className="mt-5 text-center text-typography-900">
        No meals yet
      </Text>
      <Text
        size="sm"
        className="mt-2 text-center leading-5 text-typography-500"
        style={{ maxWidth: 420 }}
      >
        Combine foods you often eat together into a meal, then log it all in one tap. Use the
        {" “New meal” "}
        button above to create your first one.
      </Text>
    </Box>
  )

  return (
    <Box className="flex-1 bg-background-0">
      <PageContainer variant={isWide ? "wide" : "default"} className="flex-1">
        <Box className={`${isWide ? "px-8" : "px-4"} pb-3 pt-2`}>
          <Box className="mb-3 flex-row items-center justify-between">
            <Text size={isWide ? "3xl" : "2xl"} bold className="text-typography-900">
              Meals
            </Text>
            <Pressable
              className="h-11 flex-row items-center gap-1.5 rounded-full bg-primary-500 px-4 active:opacity-85"
              onPress={() => openBuilder()}
              accessibilityRole="button"
              accessibilityLabel="Create a new meal"
            >
              <Ionicons name="add" size={20} color={colors.onPrimary} />
              <Text size="sm" bold style={{ color: colors.onPrimary }}>
                New meal
              </Text>
            </Pressable>
          </Box>
          <Text size="sm" className="mb-3 text-typography-500">
            Saved combos — log them into any meal slot in one tap.
          </Text>
        </Box>

        {loading ? (
          <ActivityIndicator className="mt-6" color={colors.primary} />
        ) : (
          <FlatList
            className="flex-1"
            data={meals}
            keyExtractor={(item) => item.id}
            contentContainerClassName={
              meals.length === 0 ? "grow justify-center pb-8" : "pt-1 pb-32"
            }
            renderItem={renderMeal}
            ListEmptyComponent={emptyState}
          />
        )}
      </PageContainer>

      <MealSlotModal
        meal={pendingLog}
        onSelect={(slot) => {
          if (pendingLog) void handleLog(pendingLog, slot)
        }}
        onClose={() => setPendingLog(null)}
      />
    </Box>
  )
}

/** Asks which diary slot a meal should land in when logging from the Meals tab. */
function MealSlotModal({
  meal,
  onSelect,
  onClose,
}: {
  meal: Meal | null
  onSelect: (slot: MealType) => void
  onClose: () => void
}) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const slots: MealType[] = ["breakfast", "lunch", "dinner", "snack"]
  return (
    <Modal visible={meal !== null} transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Log {meal?.name ? `"${meal.name}"` : "meal"} into…</Text>
          <View style={styles.slotList}>
            {slots.map((slot) => (
              <Pressable
                key={slot}
                style={styles.slotRow}
                onPress={() => onSelect(slot)}
                accessibilityRole="button"
                accessibilityLabel={`Log into ${MEAL_LABELS[slot]}`}
              >
                <View style={[styles.slotIcon, { backgroundColor: `${colors[slot]}22` }]}>
                  <Ionicons name="restaurant-outline" size={18} color={colors[slot]} />
                </View>
                <Text style={styles.slotLabel}>{MEAL_LABELS[slot]}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
          <Pressable
            style={styles.cancelBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel logging meal"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      padding: spacing.lg,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: spacing.md,
      width: "100%",
      maxWidth: 380,
      alignSelf: "center",
      boxShadow: "0px 6px 12px rgba(0, 0, 0, 0.25)",
      elevation: 8,
    },
    sheetTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    slotList: { gap: spacing.sm },
    slotRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.xs,
      borderRadius: 14,
    },
    slotIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    slotLabel: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "600" },
    cancelBtn: {
      alignSelf: "center",
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    cancelText: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  })
