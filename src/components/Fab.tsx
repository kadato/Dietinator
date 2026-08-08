import { Ionicons } from "@expo/vector-icons"
import { Pressable, StyleSheet } from "react-native"
import { useTheme } from "@/hooks/useTheme"
import { Text } from "@ui/text"

type Props = {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  accessibilityLabel: string
  /** Extended FAB shows a label next to the icon (primary "Add" style). */
  label?: string
  /** Danger styling for destructive actions. */
  danger?: boolean
}

/**
 * Floating action button. Round by default; pass `label` for the extended
 * pill variant. Elevation and press feedback match Material FABs while
 * staying theme-aware. Screens position it (absolute + safe area).
 */
export function Fab({ icon, onPress, accessibilityLabel, label, danger = false }: Props) {
  const { colors } = useTheme()
  const bg = danger ? colors.danger : colors.primary
  const fg = danger ? "#ffffff" : colors.onPrimary

  if (label) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.extended,
          { backgroundColor: bg, shadowColor: "#000" },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name={icon} size={22} color={fg} />
        <Text size="md" bold style={{ color: fg }}>
          {label}
        </Text>
      </Pressable>
    )
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: bg, shadowColor: "#000" },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={26} color={fg} />
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
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  extended: {
    minHeight: 56,
    paddingHorizontal: 22,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    elevation: 8,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.92,
  },
})
