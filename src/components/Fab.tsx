import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import type { ComponentProps } from "react"
import { useState } from "react"
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
  // Press feedback must live in a state-driven static style, not a
  // Pressable style function: RN 0.85 Fabric drops function styles on
  // Android, collapsing the button to its icon size.
  const [pressed, setPressed] = useState(false)
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
  const border =
    tone === "primary"
      ? `${colors.primaryStrong}4d`
      : tone === "danger"
        ? `${colors.danger}66`
        : colors.border

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[
        shape,
        styles.shadow,
        {
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
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
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  roundSm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  extended: {
    minHeight: 56,
    paddingHorizontal: 24,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  extendedSm: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shadow: {
    elevation: 8,
    boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.22)",
  },
  pressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.5,
  },
  idle: {},
})
