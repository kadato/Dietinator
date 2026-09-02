import { memo, useCallback, useState } from "react"
import { Pressable, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import type { DiaryEntry, MealType } from "@/types"
import { DiaryEntryRow } from "@/components/DiaryEntryRow"
import { MacroPills } from "@/components/MacroPills"
import { MEAL_LABELS, MEAL_ICONS } from "@/utils/meals"
import { formatMacro } from "@/utils/format"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { useTheme } from "@/hooks/useTheme"
import { fonts, borders, radii } from "@/theme"

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
  // Collapsed by default on all devices so the diary is scannable.
  // The user expands the meal they touched. Last expansion is per mount;
  // date change resets to collapsed so every day starts at summary height.
  const [expanded, setExpanded] = useState(() => false)
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
    <Box
      className="meal-card mb-2.5 overflow-hidden rounded-none border bg-background-50 p-0"
      style={{ borderWidth: borders.width, borderColor: colors.border, borderRadius: radii.none }}
    >
      <View style={{ height: 3, backgroundColor: accent, width: "100%" }} />
      {/* Header: icon + title on one line, kcal + add on the right. */}
      <Box className="flex-row items-center justify-between gap-2.5 px-3 py-2.5">
        <Pressable
          onPress={() => {
            if (entries.length === 0) onAdd(mealType)
            else setExpanded((v) => !v)
          }}
          className="min-w-0 flex-1 cursor-pointer flex-row items-center gap-2.5"
          accessibilityRole="button"
          accessibilityLabel={`${MEAL_LABELS[mealType].toUpperCase()} ${Math.round(totalKcal)} kcal${
            entries.length > 0
              ? ` ${formatMacro(totalProtein)}g ${formatMacro(totalCarbs)}g ${formatMacro(totalFat)}g`
              : ""
          }`}
        >
          <Box
            className="h-10 w-10 shrink-0 items-center justify-center rounded-none border"
            style={{
              backgroundColor: `${accent}14`,
              borderColor: colors.border,
              borderWidth: borders.width,
              borderRadius: radii.none,
            }}
          >
            <Feather name={MEAL_ICONS[mealType]} size={18} color={accent} />
          </Box>

          <Box className="min-w-0 flex-1 gap-1">
            <Box className="flex-row items-baseline justify-between gap-2">
              <Box className="flex-row items-center gap-1">
                <Text
                  size="sm"
                  bold
                  className="text-[13px] uppercase tracking-wider text-typography-900"
                  style={{ letterSpacing: 0.06, fontFamily: fonts.mono }}
                >
                  {MEAL_LABELS[mealType]}
                </Text>
                {entries.length > 0 ? (
                  <Feather
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={12}
                    color={colors.textMuted}
                  />
                ) : null}
              </Box>
              <Text size="sm" bold className="font-tabular text-[15px] text-typography-900">
                {Math.round(totalKcal)}{" "}
                <Text size="2xs" className="font-normal tracking-wider text-typography-500">
                  kcal
                </Text>
              </Text>
            </Box>

            {entries.length > 0 ? (
              <View style={{ marginTop: 2 }}>
                <MacroPills protein={totalProtein} carbs={totalCarbs} fat={totalFat} size="xs" />
              </View>
            ) : null}
          </Box>
        </Pressable>

        <View
          style={{ width: 1.5, backgroundColor: colors.border, alignSelf: "stretch", opacity: 0.6 }}
        />

        <Pressable
          className="h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-none bg-primary-500 hover:bg-primary-600 active:opacity-80"
          onPress={() => onAdd(mealType)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Add food to ${MEAL_LABELS[mealType]}`}
        >
          <Feather name="plus" size={18} color={colors.onPrimary} />
        </Pressable>
      </Box>

      {/* Goal track spans the full card width below the header */}
      {goal ? (
        <Box className="mt-0.5 gap-1.5 px-3 pb-2.5">
          <View
            className="w-full overflow-hidden rounded-none border bg-background-100"
            style={{
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
              height: 6,
            }}
          >
            <View
              style={{
                width: `${Math.min((totalKcal / goal) * 100, 100)}%`,
                height: "100%",
                backgroundColor: overKcal ? colors.danger : accent,
                borderTopWidth: 1.5,
                borderTopColor: "rgba(255,255,255,0.22)",
              }}
            />
          </View>
          <Box className="flex-row items-center justify-between">
            <Text
              size="2xs"
              className="font-mono uppercase tracking-wider text-typography-500"
              style={{ fontSize: 11, letterSpacing: 0.04, fontFamily: fonts.mono }}
            >
              Goal {Math.round(goal)} kcal
            </Text>
            <View
              className="rounded-none border px-2 py-0.5"
              style={{
                borderWidth: borders.width,
                borderColor: overKcal ? colors.danger : accent,
                backgroundColor: overKcal ? `${colors.danger}14` : `${accent}14`,
                borderRadius: radii.none,
              }}
            >
              <Text
                size="2xs"
                bold
                className="font-mono uppercase tracking-wider"
                style={{
                  fontSize: 11,
                  letterSpacing: 0.04,
                  color: overKcal ? colors.danger : accent,
                  fontFamily: fonts.mono,
                }}
              >
                {overKcal
                  ? `+${Math.round(overKcal)} over`
                  : `${Math.round(remainingKcal ?? 0)} left`}
              </Text>
            </View>
          </Box>
          {overKcal ? (
            <Text
              size="2xs"
              className="font-mono tracking-wider text-typography-500"
              style={{ fontSize: 10, letterSpacing: 0.02, fontFamily: fonts.mono }}
            >
              Adjust tomorrow
            </Text>
          ) : null}
        </Box>
      ) : null}

      {entries.length === 0 ? (
        <Box className="flex-row items-center gap-1 px-3 pb-2.5 pt-0">
          <Feather name="plus" size={11} color={colors.textMuted} />
          <Text
            size="2xs"
            className="font-mono uppercase tracking-wider text-typography-400"
            style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.04 }}
          >
            Tap + to log
          </Text>
        </Box>
      ) : !expanded && entries.length > 0 ? (
        <Box className="gap-1 px-3 pb-2.5 pt-0">
          {entries.slice(0, 2).map((entry) => (
            <Box key={entry.id} className="flex-row items-center justify-between">
              <Text
                size="xs"
                numberOfLines={1}
                className="flex-1 font-mono text-typography-700"
                style={{ fontFamily: fonts.mono, fontSize: 12 }}
              >
                {entry.food_name}
              </Text>
              <Text
                size="xs"
                className="ml-2 shrink-0 font-mono tabular-nums text-typography-500"
                style={{
                  fontFamily: fonts.mono,
                  fontVariant: ["tabular-nums"] as never,
                  fontSize: 12,
                }}
              >
                {Math.round(entry.kcal)} kcal
              </Text>
            </Box>
          ))}
          {entries.length > 2 ? (
            <Text
              size="2xs"
              className="font-mono uppercase tracking-wider text-typography-400"
              style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.04 }}
            >
              +{entries.length - 2} more · tap to expand
            </Text>
          ) : (
            <Text
              size="2xs"
              className="font-mono uppercase tracking-wider text-typography-400"
              style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.04 }}
            >
              Tap to expand
            </Text>
          )}
        </Box>
      ) : null}

      {expanded && entries.length > 0 ? (
        <Box className="mt-0 border-t border-outline-100 px-1.5 pb-2 pt-1.5">
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
    </Box>
  )
})
