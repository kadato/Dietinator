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
 * Floating action button. Round by default; pass `label` for the extended
 * pill variant. Elevation and press feedback match Material FABs while
 * staying theme-aware. Screens position it (absolute + safe area).
 */
export function Fab({
  icon,
  IconComponent = Ionicons,
  onPress,
  accessibilityLabel,
  label,
  tone = "primary",
  disabled = false,
}: Props) {
  const { colors } = useTheme()
  const bg =
    tone === "surface" ? colors.surfaceAlt : tone === "danger" ? colors.danger : colors.primary
  const fg = tone === "surface" ? colors.text : tone === "danger" ? "#ffffff" : colors.onPrimary

  const pressedStyle = disabled ? styles.disabled : styles.pressed

  if (label) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.extended,
          { backgroundColor: bg },
          tone === "surface" && { borderWidth: 1, borderColor: colors.border },
          pressed && pressedStyle,
        ]}
      >
        <FabGlyph IconComponent={IconComponent} icon={icon} size={22} color={fg} />
        <Text size="md" bold style={{ color: fg }}>
          {label}
        </Text>
      </Pressable>
    )
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: bg },
        tone === "surface" && { borderWidth: 1, borderColor: colors.border },
        pressed && pressedStyle,
      ]}
    >
      <FabGlyph IconComponent={IconComponent} icon={icon} size={26} color={fg} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.28)",
  },
  extended: {
    minHeight: 56,
    paddingHorizontal: 22,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    elevation: 8,
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.28)",
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.55,
  },
})
