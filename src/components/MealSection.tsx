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
import { fonts } from "@/theme"

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
    <Box
      className="mb-3 overflow-hidden rounded-none border bg-background-50 p-0"
      style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
    >
      <View style={{ height: 3, backgroundColor: accent, width: "100%" }} />
      {/* Header: icon + title on one line, kcal + add on the right. The icon
          is top-aligned to the title baseline, not centered to the whole card,
          so a tall goal bar below does not pull the icon down. */}
      <Box className="flex-row items-start justify-between gap-3 px-3 py-3">
        <Pressable
          onPress={() => {
            if (entries.length === 0) onAdd(mealType)
            else setExpanded((v) => !v)
          }}
          className="min-w-0 flex-1 cursor-pointer flex-row items-start gap-3"
          accessibilityRole="button"
          // Explicit label mirrors the visible header text ("Breakfast 441 kcal
          // 22.5g 33.9g 22.8g", single-spaced) so it satisfies 2.5.3
          // label-in-name while staying stable for assistive tech; the raw
          // content name carries icon glyphs and doubled spaces.
          accessibilityLabel={`${MEAL_LABELS[mealType]} ${Math.round(totalKcal)} kcal${
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
              borderWidth: 1.5,
              borderRadius: 0,
            }}
          >
            <Feather name={MEAL_ICONS[mealType]} size={18} color={accent} />
          </Box>

          <Box className="min-w-0 flex-1 gap-1">
            <Box className="flex-row items-baseline justify-between gap-2">
              <Box className="flex-row items-center gap-1.5">
                <Text
                  size="2xs"
                  bold
                  aria-hidden={true}
                  style={{
                    color: accent,
                    fontFamily: fonts.mono,
                    letterSpacing: 0.8,
                  }}
                >
                  {mealType === "breakfast"
                    ? "/01"
                    : mealType === "lunch"
                      ? "/02"
                      : mealType === "dinner"
                        ? "/03"
                        : "/04"}
                </Text>
                <Text
                  size="md"
                  bold
                  className="text-[12px] uppercase tracking-widest text-typography-900"
                  style={{ letterSpacing: 0.08, fontFamily: fonts.mono }}
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
              <Text size="sm" bold className="font-tabular text-[14px] text-typography-900">
                {Math.round(totalKcal)}{" "}
                <Text size="2xs" className="font-normal tracking-widest text-typography-500">
                  kcal
                </Text>
              </Text>
            </Box>

            {entries.length > 0 ? (
              <View style={{ marginTop: 3 }}>
                <MacroPills protein={totalProtein} carbs={totalCarbs} fat={totalFat} size="xs" />
              </View>
            ) : null}
          </Box>
        </Pressable>

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

      {/* Goal track spans the full card width below the header, not the
          middle column, so it reads as the card's budget. */}
      {goal ? (
        <Box className="mt-2 gap-1.5 px-3 pb-3">
          <View
            className="w-full overflow-hidden rounded-none border bg-background-100"
            style={{
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
              height: 8,
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
              size="xs"
              className="font-mono uppercase tracking-widest text-typography-500"
              style={{ fontSize: 11, letterSpacing: 0.06 }}
            >
              Goal {Math.round(goal)} kcal
            </Text>
            <View
              className="rounded-none border px-2 py-0.5"
              style={{
                borderWidth: 1.5,
                borderColor: overKcal ? colors.danger : accent,
                backgroundColor: overKcal ? `${colors.danger}14` : `${accent}14`,
                borderRadius: 0,
              }}
            >
              <Text
                size="xs"
                bold
                className="font-mono uppercase tracking-widest"
                style={{
                  fontSize: 11,
                  letterSpacing: 0.06,
                  color: overKcal ? colors.danger : accent,
                }}
              >
                {overKcal
                  ? `+${Math.round(overKcal)} over`
                  : `${Math.round(remainingKcal ?? 0)} left`}
              </Text>
            </View>
          </Box>
        </Box>
      ) : null}

      {entries.length === 0 ? (
        <Box className="px-3 pb-3 pt-1">
          <Text size="xs" className="font-mono uppercase tracking-widest text-typography-400">
            Nothing logged yet
          </Text>
        </Box>
      ) : !expanded && entries.length > 0 && !goal ? (
        <Box className="px-3 pb-3" />
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
