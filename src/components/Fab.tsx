import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import type { ComponentProps } from "react"
import { Pressable, StyleSheet } from "react-native"
import { useTheme } from "@/hooks/useTheme"
import { Text } from "@ui/text"

type IconComponent = typeof Ionicons | typeof MaterialCommunityIcons
type IconName =
  ComponentProps<typeof Ionicons>["name"] | ComponentProps<typeof MaterialCommunityIcons>["name"]

type Props = {
  icon: IconName
  /** Icon family to render `icon` from; defaults to Ionicons. */
  IconComponent?: IconComponent
  onPress: () => void
  accessibilityLabel: string
  /** Extended FAB shows a label next to the icon (primary "Add" style). */
  label?: string
  /**
   * Visual emphasis: `primary` (default), `surface` (neutral, for cancel /
   * dismiss actions) or `danger`.
   */
  tone?: "primary" | "surface" | "danger"
  /** Disables presses and dims the button (e.g. while saving). */
  disabled?: boolean
  /** `md` (default, 56px) or `sm` (44px — secondary buttons in FAB clusters). */
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
  if (IconComponent === MaterialCommunityIcons) {
    return (
      <MaterialCommunityIcons
        name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={size}
        color={color}
      />
    )
  }
  return <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={size} color={color} />
}

/**
 * Floating action button. Rounded square by default (Material 3 container
 * shape); pass `label` for the extended variant. Elevation and press
 * feedback match Material FABs while staying theme-aware. Screens position
 * it (absolute + safe area).
 */
export function Fab({
  icon,
  IconComponent = Ionicons,
  onPress,
  accessibilityLabel,
  label,
  tone = "primary",
  disabled = false,
  size = "md",
}: Props) {
  const { colors } = useTheme()
  const bg =
    tone === "surface" ? colors.surfaceAlt : tone === "danger" ? colors.danger : colors.primary
  // No `onDanger` token exists; white reads on both themes' danger shades.
  const fg = tone === "surface" ? colors.text : colors.onPrimary

  const pressedStyle = disabled ? styles.disabled : styles.pressed
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
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        shape,
        styles.shadow,
        { backgroundColor: bg },
        tone === "surface" && { borderWidth: 1, borderColor: colors.border },
        pressed && pressedStyle,
        pressed && styles.shadowFlat,
      ]}
    >
      <FabGlyph IconComponent={IconComponent} icon={icon} size={iconSize} color={fg} />
      {label ? (
        <Text size={size === "sm" ? "sm" : "md"} bold style={{ color: fg }}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  round: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  roundSm: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  extended: {
    minHeight: 56,
    paddingHorizontal: 22,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  extendedSm: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shadow: {
    elevation: 6,
    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.32)",
  },
  shadowFlat: {
    elevation: 2,
    boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.22)",
  },
  pressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.94,
  },
  disabled: {
    opacity: 0.55,
  },
})
