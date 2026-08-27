import { useEffect, useState } from "react"
import { Modal, Pressable, View } from "react-native"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DatePickerModal } from "@/components/DatePickerModal"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { formatDisplayDate, shiftDateKey, toDateKey } from "@/utils/date"
import { MEAL_LABELS, MEAL_TYPES } from "@/utils/meals"
import type { MealType } from "@/types"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"
import { usePressedState } from "@/hooks/usePressedState"
import { fonts } from "@/theme"
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
  const { isMedium } = useLayout()
  const insets = useSafeAreaInsets()
  const safeBottom = insets.bottom
  const [dateKey, setDateKey] = useState(initialDateKey ?? toDateKey())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lastVisible, setLastVisible] = useState(false)
  const prevPress = usePressedState()
  const calPress = usePressedState()
  const nextPress = usePressedState()
  // Per-slot press tracking so the pressed tint never sticks if a gesture
  // cancels without sending onPressOut (seen on Android Fabric).
  const pressedSlots: Record<MealType, ReturnType<typeof usePressedState>> = {
    breakfast: usePressedState(),
    lunch: usePressedState(),
    dinner: usePressedState(),
    snack: usePressedState(),
  }

  // Every open resets the target day. Pressed tints are cleared on close
  // via effect so a sheet that closed before onPressOut does not stay highlighted.
  if (visible !== lastVisible) {
    setLastVisible(visible)
    if (visible) setDateKey(initialDateKey ?? toDateKey())
  }

  useEffect(() => {
    if (!visible) {
      pressedSlots.breakfast.onPressOut()
      pressedSlots.lunch.onPressOut()
      pressedSlots.dinner.onPressOut()
      pressedSlots.snack.onPressOut()
    }
  }, [visible, pressedSlots.breakfast, pressedSlots.dinner, pressedSlots.lunch, pressedSlots.snack])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: isMedium ? "center" : "flex-end",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingBottom: isMedium ? 24 : safeBottom + 84,
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
          className="w-full max-w-[420px] self-center rounded-none bg-background-50 p-4"
          style={{
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 0,
            backgroundColor: colors.surface,
          }}
        >
          <Text
            size="lg"
            bold
            className="mb-3 px-1 uppercase tracking-widest text-typography-900"
            style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
          >
            {title}
          </Text>

          <Box className="mb-3 flex-row items-center justify-between gap-2 px-1">
            <Pressable
              onPress={() => setDateKey((current) => shiftDateKey(current, -1))}
              onPressIn={prevPress.onPressIn}
              onPressOut={prevPress.onPressOut}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Previous day"
            >
              <Box
                className="items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: 0,
                  backgroundColor: prevPress.pressed ? `${colors.primary}20` : colors.surfaceAlt,
                }}
              >
                <Feather name="chevron-left" size={20} color={colors.text} />
              </Box>
            </Pressable>

            <Pressable
              onPress={() => setPickerOpen(true)}
              onPressIn={calPress.onPressIn}
              onPressOut={calPress.onPressOut}
              className="min-w-0 flex-1"
              accessibilityRole="button"
              accessibilityLabel="Choose date"
            >
              <Box
                className="w-full flex-row items-center justify-center"
                style={{
                  height: 40,
                  paddingHorizontal: 12,
                  gap: 6,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: 0,
                  backgroundColor: calPress.pressed ? `${colors.primary}20` : colors.surfaceAlt,
                }}
              >
                <Feather name="calendar" size={15} color={colors.primary} />
                <Text
                  size="sm"
                  bold
                  numberOfLines={1}
                  className="text-typography-900"
                  style={{
                    fontFamily: fonts.mono,
                    textTransform: "uppercase",
                    letterSpacing: 0.04,
                  }}
                >
                  {formatDisplayDate(dateKey)}
                </Text>
              </Box>
            </Pressable>

            <Pressable
              onPress={() => setDateKey((current) => shiftDateKey(current, 1))}
              onPressIn={nextPress.onPressIn}
              onPressOut={nextPress.onPressOut}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Next day"
            >
              <Box
                className="items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: 0,
                  backgroundColor: nextPress.pressed ? `${colors.primary}20` : colors.surfaceAlt,
                }}
              >
                <Feather name="chevron-right" size={20} color={colors.text} />
              </Box>
            </Pressable>
          </Box>

          <Box className="gap-2">
            {MEAL_TYPES.map((slot) => {
              const press = pressedSlots[slot]
              return (
                <Pressable
                  key={slot}
                  onPress={() => onSelect(slot, dateKey)}
                  onPressIn={press.onPressIn}
                  onPressOut={press.onPressOut}
                  className="flex-row items-center gap-3.5 rounded-none border px-3 py-3"
                  style={{
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    borderRadius: 0,
                    backgroundColor: press.pressed ? colors.surfaceAlt : colors.surface,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Log into ${MEAL_LABELS[slot]}`}
                >
                  <Box
                    className="h-10 w-10 items-center justify-center rounded-none border"
                    style={{
                      backgroundColor: `${colors[slot]}22`,
                      borderColor: `${colors[slot]}55`,
                      borderWidth: 1.5,
                      borderRadius: 0,
                    }}
                  >
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
                      size={20}
                      color={colors[slot]}
                    />
                  </Box>
                  <Text
                    size="md"
                    bold
                    className="flex-1 uppercase tracking-widest text-typography-900"
                    style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
                  >
                    {MEAL_LABELS[slot]}
                  </Text>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>
              )
            })}
          </Box>
        </Box>

        <FabCluster
          bottomOffset={safeBottom + 16}
          left={
            <Fab
              icon="x"
              tone="surface"
              onPress={onClose}
              accessibilityLabel="Close meal slot picker"
            />
          }
        />
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
