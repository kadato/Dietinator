import { useState } from "react"
import { Pressable, StyleSheet } from "react-native"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useReduceMotion } from "@/hooks/useReduceMotion"
import { useTheme } from "@/hooks/useTheme"
import { Text } from "@ui/text"

type IconComponent = typeof MaterialCommunityIcons | typeof Feather
type IconName = string

type Props = {
  icon: IconName
  /** Icon family to render `icon` from. Defaults to Ionicons. */
  IconComponent?: IconComponent
  onPress: () => void
  accessibilityLabel: string
  /** Extended FAB shows a label next to the icon, primary Add style. */
  label?: string
  /**
   * Visual emphasis. Primary is default, surface is neutral for cancel or dismiss actions, or danger.
   */
  tone?: "primary" | "surface" | "danger"
  /** Disables presses and dims the button, for example while saving. */
  disabled?: boolean
  /** Md is default at 56px, or sm at 44px for secondary buttons in FAB clusters. */
  size?: "md" | "sm"
}

function FabGlyph({
  IconComponent,
  icon,
  size,
  color,
}: {
  IconComponent: IconComponent
  icon: IconName
  size: number
  color: string
}) {
  // Two families, explicitly declared. Feather for UI chrome, MCI only
  // where no Feather glyph exists, such as barcode or food identity. No auto-detect.
  // Silent family switching was how three icon sets leaked in.
  if (IconComponent === MaterialCommunityIcons) {
    return (
      <MaterialCommunityIcons
        name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={size}
        color={color}
      />
    )
  }
  return <Feather name={icon as keyof typeof Feather.glyphMap} size={size} color={color} />
}

/**
 * Floating action button. Square sheet with a 1.5px ink rule, field-terminal
 * key. Pass `label` for the extended variant. No shadow. Emphasis comes
 * from fill and rule weight. Screens position it with absolute and safe area.
 */
export function Fab({
  icon,
  IconComponent = Feather,
  onPress,
  accessibilityLabel,
  label,
  tone = "primary",
  disabled = false,
  size = "md",
}: Props) {
  const { colors } = useTheme()
  // Press feedback must live in a state-driven static style, not a
  // Pressable style function. RN 0.85 Fabric drops function styles on
  // Android, collapsing the button to its icon size.
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const reduceMotion = useReduceMotion()
  const bg =
    tone === "surface" ? colors.surfaceAlt : tone === "danger" ? colors.danger : colors.primary
  // No `onDanger` token exists; white reads on both themes' danger shades.
  const fg = tone === "surface" ? colors.text : colors.onPrimary

  // Reduce Motion: keep the opacity cue, drop the transform. Hover gets the
  // same calm opacity shift on desktop.
  const pressedStyle = disabled
    ? styles.disabled
    : pressed
      ? reduceMotion
        ? styles.pressedStill
        : styles.pressed
      : hovered
        ? styles.pressedStill
        : styles.idle
  const shape =
    size === "sm"
      ? label
        ? styles.extendedSm
        : styles.roundSm
      : label
        ? styles.extended
        : styles.round
  const iconSize = size === "sm" ? (label ? 18 : 22) : label ? 22 : 26

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className="cursor-pointer"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[
        shape,
        {
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: tone === "surface" ? colors.border : bg,
        },
        pressed ? pressedStyle : styles.idle,
      ]}
    >
      <FabGlyph IconComponent={IconComponent} icon={icon} size={iconSize} color={fg} />
      {label ? (
        <Text size={size === "sm" ? "sm" : "md"} bold style={{ color: fg, letterSpacing: 0.2 }}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  round: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  roundSm: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  extended: {
    minHeight: 56,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  extendedSm: {
    minHeight: 44,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.92,
  },
  pressedStill: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.5,
  },
  idle: {},
})
