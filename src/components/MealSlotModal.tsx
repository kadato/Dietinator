import { useState } from "react"
import { Modal, Pressable, View } from "react-native"
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
  /** Title line, for example `Log "Spaghetti" into…`. */
  title: string
  initialDateKey?: string
  onSelect: (slot: MealType, dateKey: string) => void
  onClose: () => void
}

/** Asks which diary slot a meal should land in when logging. */
export function MealSlotModal({ visible, title, initialDateKey, onSelect, onClose }: Props) {
  const { colors } = useTheme()
  const [dateKey, setDateKey] = useState(initialDateKey ?? toDateKey())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lastVisible, setLastVisible] = useState(false)

  // Every open resets the target day. "Log into today" is the default,
  // handled as a render-adjustment pattern so the reset happens in one commit.
  if (visible !== lastVisible) {
    setLastVisible(visible)
    if (visible) setDateKey(initialDateKey ?? toDateKey())
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}>
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss meal slot picker"
        />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            pointerEvents: "box-none",
          }}
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
        </View>
      </View>
      <DatePickerModal
        visible={pickerOpen}
        dateKey={dateKey}
        onSelect={setDateKey}
        onClose={() => setPickerOpen(false)}
      />
    </Modal>
  )
}
