import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useReduceMotion } from "@/hooks/useReduceMotion"
import { useTheme } from "@/hooks/useTheme"
import { layout, borders, radii } from "@/theme"
import { Text } from "@ui/text"

type DockSlot = {
  meal: "breakfast" | "lunch" | "dinner" | "snack"
  label: string
  icon: keyof typeof MaterialCommunityIcons.glyphMap
}

const SLOTS: DockSlot[] = [
  { meal: "breakfast", label: "BRKF", icon: "coffee" },
  { meal: "lunch", label: "LUNCH", icon: "silverware-fork-knife" },
  { meal: "dinner", label: "DINR", icon: "weather-night" },
  { meal: "snack", label: "SNCK", icon: "cookie" },
]

type Props = {
  /** Called with the tapped meal slot. */
  onSelectMeal: (meal: DockSlot["meal"]) => void
  /** Instant water quick-add (+250ml) fired by the trailing ink square. */
  onQuickWater: () => void
}

/**
 * Bottom one-hand dock (DESIGN.md): four square meal keys plus a primary
 * water key, sitting above the tab bar in the thumb arc. Square sheets,
 * 1.5px rules, mono uppercase labels; selection feedback is a press scale,
 * never a lift. `pointerEvents` stays a PROP (see FabCluster note):
 * react-native-web drops it from styles.
 */
export function MealDock({ onSelectMeal, onQuickWater }: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  // Per-key pressed state mirrors Fab: state-driven static styles survive
  // Fabric where Pressable style functions do not.
  const [pressedKey, setPressedKey] = useState<string | null>(null)

  const bottom = insets.bottom + layout.tabBarHeight + 10

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dock, { bottom }]}
      accessibilityRole="toolbar"
      accessibilityLabel="Quick log dock"
    >
      <View style={styles.row} pointerEvents="box-none">
        {SLOTS.map((slot) => {
          const pressed = pressedKey === slot.meal
          return (
            <Pressable
              key={slot.meal}
              onPress={() => onSelectMeal(slot.meal)}
              onPressIn={() => setPressedKey(slot.meal)}
              onPressOut={() => setPressedKey(null)}
              className="cursor-pointer"
              style={[
                styles.key,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.92 : 1,
                  transform: pressed && !reduceMotion ? [{ scale: 0.98 }] : undefined,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Log ${slot.meal}`}
            >
              <MaterialCommunityIcons name={slot.icon} size={18} color={colors.primary} />
              <Text
                bold
                className="font-mono uppercase"
                // No numeric lineHeight here: it reaches CSS unitless and
                // multiplies (12 x 10px = 120px box, verified live).
                style={{ fontSize: 11, letterSpacing: 0.6, color: colors.text }}
              >
                {slot.label}
              </Text>
            </Pressable>
          )
        })}
        <Pressable
          onPress={onQuickWater}
          onPressIn={() => setPressedKey("water")}
          onPressOut={() => setPressedKey(null)}
          className="cursor-pointer"
          accessibilityRole="button"
          accessibilityLabel="Quick add 250 milliliters of water"
          style={[
            styles.key,
            styles.waterKey,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              opacity: pressedKey === "water" ? 0.92 : 1,
              transform: pressedKey === "water" && !reduceMotion ? [{ scale: 0.98 }] : undefined,
            },
          ]}
        >
          <MaterialCommunityIcons name="cup-water" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 12,
    right: 12,
    pointerEvents: "box-none",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    pointerEvents: "box-none",
  },
  // Longhand flex properties on purpose: RN's `flex: 1` shorthand maps to
  // flex-basis 0%, and `flex: 0` on the water key collapsed its width to
  // nothing (verified live: computed flex "0 1 0%", box 2px wide).
  key: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "0%",
    minWidth: 0,
    minHeight: 56,
    borderRadius: radii.none,
    borderWidth: borders.width,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  waterKey: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 56,
  },
})
