import { memo, useCallback, useState } from "react"
import { Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { DiaryEntry, MealType } from "@/types"
import { DiaryEntryRow } from "@/components/DiaryEntryRow"
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
}

function formatFoodPreview(entries: DiaryEntry[]): string {
  if (entries.length === 0) return "Nothing logged yet"
  const names = entries.map((e) => e.food_name)
  const joined = names.join(", ")
  return joined.length > 72 ? `${joined.slice(0, 69)}…` : joined
}

export const MealSection = memo(function MealSection({
  mealType,
  entries,
  mealGoal,
  dateKey,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const { colors } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const handleEdit = useCallback((entryId: string) => onEdit(entryId), [onEdit])
  const handleDelete = useCallback((entryId: string) => onDelete(entryId), [onDelete])
  const accent = colors[mealType]
  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0)
  const goal = mealGoal && mealGoal > 0 ? mealGoal : undefined
  const calorieLabel = goal
    ? `${Math.round(totalKcal)} / ${Math.round(goal)} Cal`
    : `${Math.round(totalKcal)} Cal`

  return (
    <Card variant="elevated" className="mb-3 overflow-hidden p-4">
      <Box className="flex-row items-center gap-3">
        <Pressable
          onPress={() => {
            if (entries.length === 0) onAdd(mealType)
            else setExpanded((v) => !v)
          }}
          className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={`${MEAL_LABELS[mealType]}, ${calorieLabel}`}
        >
          <Box
            className="h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${accent}1f` }}
          >
            <Ionicons name={MEAL_ICONS[mealType]} size={21} color={accent} />
          </Box>

          <Box className="min-w-0 flex-1">
            <Text size="md" bold className="text-typography-900">
              {MEAL_LABELS[mealType]}
            </Text>
            <Text size="xs" bold style={{ color: accent }}>
              {calorieLabel}
            </Text>
            <Text
              size="xs"
              className="mt-0.5 leading-[16px] text-typography-500"
              numberOfLines={expanded ? undefined : 1}
            >
              {formatFoodPreview(entries)}
            </Text>
          </Box>
        </Pressable>

        <Pressable
          className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-500 active:opacity-80"
          onPress={() => onAdd(mealType)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`Add food to ${MEAL_LABELS[mealType]}`}
        >
          <Ionicons name="add" size={24} color={colors.onPrimary} />
        </Pressable>
      </Box>

      {expanded && entries.length > 0 ? (
        <Box className="mt-3 gap-0.5 border-t border-outline-100 pt-3">
          {entries.map((entry) => (
            <DiaryEntryRow
              key={`${dateKey}-${entry.id}`}
              entry={entry}
              accentColor={accent}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </Box>
      ) : null}
    </Card>
  )
})
