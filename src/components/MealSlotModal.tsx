import { useState } from "react"
import { Modal, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { DatePickerModal } from "@/components/DatePickerModal"
import { useTheme } from "@/hooks/useTheme"
import { formatDisplayDate, shiftDateKey, toDateKey } from "@/utils/date"
import { MEAL_LABELS, MEAL_TYPES } from "@/utils/meals"
import type { MealType } from "@/types"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  visible: boolean
  /** Title line, e.g. `Log "Spaghetti" into…`. */
  title: string
  onSelect: (slot: MealType, dateKey: string) => void
  onClose: () => void
}

/** Asks which diary slot a meal should land in when logging. */
export function MealSlotModal({ visible, title, onSelect, onClose }: Props) {
  const { colors } = useTheme()
  const [dateKey, setDateKey] = useState(toDateKey())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lastVisible, setLastVisible] = useState(false)

  // Every open resets the target day — "log into today" is the default
  // (render-adjustment pattern so the reset happens in the same commit).
  if (visible !== lastVisible) {
    setLastVisible(visible)
    if (visible) setDateKey(toDateKey())
  }

  return (
    <Modal visible={visible} transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        <Box className="w-full max-w-[380px] self-center rounded-3xl bg-background-50 p-4 shadow-soft-1">
          <Text size="md" bold className="mb-4 px-1 text-typography-900">
            {title}
          </Text>

          <Box className="mb-2 flex-row items-center justify-between gap-2 px-1">
            <Pressable
              onPress={() => setDateKey((current) => shiftDateKey(current, -1))}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-background-100"
              accessibilityRole="button"
              accessibilityLabel="Previous day"
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setPickerOpen(true)}
              className="flex-row items-center gap-1.5 rounded-full bg-background-100 px-4 py-2 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Choose date"
            >
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text size="sm" bold className="text-typography-900">
                {formatDisplayDate(dateKey)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDateKey((current) => shiftDateKey(current, 1))}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-background-100"
              accessibilityRole="button"
              accessibilityLabel="Next day"
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </Box>

          <Box className="gap-2">
            {MEAL_TYPES.map((slot) => (
              <Pressable
                key={slot}
                onPress={() => onSelect(slot, dateKey)}
                className="flex-row items-center gap-4 rounded-xl px-1 py-2 active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel={`Log into ${MEAL_LABELS[slot]}`}
              >
                <Box
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${colors[slot]}22` }}
                >
                  <Ionicons name="restaurant-outline" size={18} color={colors[slot]} />
                </Box>
                <Text size="md" bold className="flex-1 text-typography-900">
                  {MEAL_LABELS[slot]}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </Box>

          <Pressable
            onPress={onClose}
            className="self-center px-6 py-2"
            accessibilityRole="button"
            accessibilityLabel="Cancel logging meal"
          >
            <Text size="md" bold className="text-typography-500">
              Cancel
            </Text>
          </Pressable>
        </Box>
      </Pressable>
      <DatePickerModal
        visible={pickerOpen}
        dateKey={dateKey}
        onSelect={setDateKey}
        onClose={() => setPickerOpen(false)}
      />
    </Modal>
  )
}
