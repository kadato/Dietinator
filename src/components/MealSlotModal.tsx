import { useState } from "react"
import { Modal, Pressable, View } from "react-native"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { DatePickerModal } from "@/components/DatePickerModal"
import { useTheme } from "@/hooks/useTheme"
import { formatDisplayDate, shiftDateKey, toDateKey } from "@/utils/date"
import { MEAL_LABELS, MEAL_TYPES } from "@/utils/meals"
import type { MealType } from "@/types"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"
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
  useEscapeToClose(visible, onClose)
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
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss meal slot picker"
        />
        <Box
          accessibilityViewIsModal={true}
          className="w-full max-w-[380px] self-center rounded-none bg-background-50 p-4"
          style={{ borderWidth: 1.5, borderColor: colors.border }}
        >
          <Text size="md" bold className="mb-4 px-1 text-typography-900">
            {title}
          </Text>

          <Box className="mb-2 flex-row items-center justify-between gap-2 px-1">
            <Pressable
              onPress={() => setDateKey((current) => shiftDateKey(current, -1))}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-none border border-outline-200 active:bg-background-100"
              accessibilityRole="button"
              accessibilityLabel="Previous day"
            >
              <Feather name="chevron-left" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setPickerOpen(true)}
              className="flex-row items-center gap-1.5 rounded-none border border-outline-200 bg-background-100 px-4 py-2 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Choose date"
            >
              <Feather name="calendar" size={16} color={colors.primary} />
              <Text size="sm" bold className="text-typography-900">
                {formatDisplayDate(dateKey)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDateKey((current) => shiftDateKey(current, 1))}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-none border border-outline-200 active:bg-background-100"
              accessibilityRole="button"
              accessibilityLabel="Next day"
            >
              <Feather name="chevron-right" size={20} color={colors.text} />
            </Pressable>
          </Box>

          <Box className="gap-2">
            {MEAL_TYPES.map((slot) => (
              <Pressable
                key={slot}
                onPress={() => onSelect(slot, dateKey)}
                className="flex-row items-center gap-4 rounded-none border-b border-outline-200 px-1 py-2 last:border-b-0 active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel={`Log into ${MEAL_LABELS[slot]}`}
              >
                <Box
                  className="h-9 w-9 items-center justify-center rounded-none border"
                  style={{
                    backgroundColor: `${colors[slot]}22`,
                    borderColor: `${colors[slot]}55`,
                  }}
                >
                  {/* Same glyph family as the phone dock keys (MCI): food
                        identity icons stay one family across surfaces. */}
                  <MaterialCommunityIcons
                    name={
                      slot === "breakfast"
                        ? "coffee"
                        : slot === "lunch"
                          ? "silverware-fork-knife"
                          : slot === "dinner"
                            ? "weather-night"
                            : "cookie"
                    }
                    size={18}
                    color={colors[slot]}
                  />
                </Box>
                <Text size="md" bold className="flex-1 text-typography-900">
                  {MEAL_LABELS[slot]}
                </Text>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </Box>

          <Pressable
            onPress={onClose}
            className="mt-2 items-center justify-center self-center rounded-none border px-6 py-2.5 active:opacity-80"
            style={{
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: colors.surfaceAlt,
            }}
            accessibilityRole="button"
            accessibilityLabel="Cancel logging meal"
          >
            <Text
              size="sm"
              bold
              className="font-mono uppercase tracking-widest text-typography-700"
            >
              Cancel
            </Text>
          </Pressable>
        </Box>
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
