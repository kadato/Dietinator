import { memo, useCallback, useState } from "react"
import { Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { DiaryEntry, MealType } from "@/types"
import { DiaryEntryRow } from "@/components/DiaryEntryRow"
import { MacroPills } from "@/components/MacroPills"
import { MEAL_LABELS, MEAL_ICONS } from "@/utils/meals"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Card } from "@ui/card"
import { useTheme } from "@/hooks/useTheme"

type Props = {
  mealType: MealType
  entries: DiaryEntry[]
  mealGoal?: number
  /** Changes with the selected date so expanded state resets between days. */
  dateKey: string
  onAdd: (mealType: MealType) => void
  onEdit: (entryId: string) => void
  onDelete: (id: string) => void
  onShowNutrition?: (entry: DiaryEntry) => void
}

export const MealSection = memo(function MealSection({
  mealType,
  entries,
  mealGoal,
  dateKey,
  onAdd,
  onEdit,
  onDelete,
  onShowNutrition,
}: Props) {
  const { colors } = useTheme()
  // Default to collapsed for a clean, compact diary overview
  const [expanded, setExpanded] = useState(false)
  const [prevDateKey, setPrevDateKey] = useState(dateKey)
  if (dateKey !== prevDateKey) {
    setPrevDateKey(dateKey)
    setExpanded(false)
  }
  const handleEdit = useCallback((entryId: string) => onEdit(entryId), [onEdit])
  const handleDelete = useCallback((entryId: string) => onDelete(entryId), [onDelete])
  const accent = colors[mealType]
  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0)
  const goal = mealGoal && mealGoal > 0 ? mealGoal : undefined
  const remainingKcal = goal ? Math.max(goal - totalKcal, 0) : null
  const overKcal = goal && totalKcal > goal ? totalKcal - goal : null

  const totalProtein = entries.reduce((s, e) => s + (e.protein || 0), 0)
  const totalCarbs = entries.reduce((s, e) => s + (e.carbs || 0), 0)
  const totalFat = entries.reduce((s, e) => s + (e.fat || 0), 0)

  return (
    <Card variant="elevated" className="mb-3 overflow-hidden rounded-3xl p-4">
      <Box className="flex-row items-center gap-3">
        <Pressable
          onPress={() => {
            if (entries.length === 0) onAdd(mealType)
            else setExpanded((v) => !v)
          }}
          className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={`${MEAL_LABELS[mealType]}, ${Math.round(totalKcal)} calories`}
        >
          <Box
            className="h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${accent}1f` }}
          >
            <Ionicons name={MEAL_ICONS[mealType]} size={22} color={accent} />
          </Box>

          <Box className="min-w-0 flex-1">
            <Box className="flex-row items-center justify-between gap-2">
              <Box className="flex-row items-center gap-1.5">
                <Text size="md" bold className="text-[16px] text-typography-900">
                  {MEAL_LABELS[mealType]}
                </Text>
                {entries.length > 0 ? (
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={colors.textMuted}
                  />
                ) : null}
              </Box>
              <Text size="md" bold className="font-tabular text-[15px] text-typography-900">
                {Math.round(totalKcal)}{" "}
                <Text size="xs" className="font-normal text-typography-500">
                  kcal
                </Text>
              </Text>
            </Box>

            {goal ? (
              <Box className="mt-0.5 flex-row items-center gap-1">
                <Text size="xs" className="font-tabular text-[12px] text-typography-500">
                  of {Math.round(goal)} kcal goal
                </Text>
                <Text size="xs" className="text-typography-400">
                  ·
                </Text>
                <Text
                  size="xs"
                  bold
                  style={{ color: overKcal ? colors.danger : colors.primary }}
                  className="font-tabular text-[12px]"
                >
                  {overKcal
                    ? `+${Math.round(overKcal)} over`
                    : `${Math.round(remainingKcal ?? 0)} left`}
                </Text>
              </Box>
            ) : null}

            {entries.length > 0 ? (
              <Box className="mt-1.5 min-w-0 flex-row flex-wrap">
                <MacroPills protein={totalProtein} carbs={totalCarbs} fat={totalFat} size="xs" />
              </Box>
            ) : (
              <Text size="xs" className="mt-0.5 text-typography-400">
                Nothing logged yet
              </Text>
            )}
          </Box>
        </Pressable>

        <Pressable
          className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-500 active:opacity-80"
          onPress={() => onAdd(mealType)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Add food to ${MEAL_LABELS[mealType]}`}
        >
          <Ionicons name="add" size={24} color={colors.onPrimary} />
        </Pressable>
      </Box>

      {expanded && entries.length > 0 ? (
        <Box className="mt-3 gap-1 border-t border-outline-100 pt-2.5">
          {entries.map((entry) => (
            <DiaryEntryRow
              key={`${dateKey}-${entry.id}`}
              entry={entry}
              accentColor={accent}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onShowNutrition={onShowNutrition}
            />
          ))}
        </Box>
      ) : null}
    </Card>
  )
})
