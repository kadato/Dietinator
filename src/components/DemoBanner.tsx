import { Feather } from "@expo/vector-icons"
import { Pressable } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/hooks/useTheme"
import { fonts, radii } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  visible: boolean
  resetting?: boolean
  onReset: () => void
  onExit: () => void
}

export function DemoBanner({ visible, resetting = false, onReset, onExit }: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  if (!visible) return null

  return (
    <Box
      className="flex-row items-center justify-center gap-2 border-b bg-background-info px-4 py-2.5"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel="Demo mode. Sample data resets daily."
      style={{
        borderWidth: 0,
        borderBottomWidth: 1.5,
        borderColor: colors.border,
        borderRadius: radii.none,
        boxShadow: "none",
        elevation: 0,
        paddingTop: 10,
        paddingLeft: insets.left + 16,
        paddingRight: insets.right + 16,
      }}
    >
      <Feather
        name="play-circle"
        size={16}
        color={colors.primary}
        style={{ flexShrink: 0, marginTop: 1 }}
      />
      <Text
        size="sm"
        className="flex-shrink"
        style={{
          color: colors.text,
          fontFamily: fonts.mono,
          fontVariant: ["tabular-nums"],
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontSize: 12,
          lineHeight: 18,
          fontWeight: "700",
        }}
      >
        Demo. Sample data resets daily
      </Text>
      <Pressable
        onPress={onReset}
        disabled={resetting}
        accessibilityRole="button"
        accessibilityLabel="Reset demo data"
        accessibilityHint="Reseeds the sample meals, weight, and water"
        hitSlop={8}
        style={{
          borderWidth: 1.5,
          borderColor: colors.primary,
          backgroundColor: resetting ? "transparent" : colors.primary,
          paddingHorizontal: 10,
          paddingVertical: 4,
          opacity: resetting ? 0.6 : 1,
          marginLeft: 8,
          flexShrink: 0,
        }}
      >
        <Text
          size="xs"
          bold
          style={{
            color: resetting ? colors.primary : colors.onPrimary,
            fontFamily: fonts.mono,
            textTransform: "uppercase",
            letterSpacing: 0.06,
          }}
        >
          {resetting ? "Working" : "Reset"}
        </Text>
      </Pressable>
      <Pressable
        onPress={onExit}
        disabled={resetting}
        accessibilityRole="button"
        accessibilityLabel="Exit demo"
        accessibilityHint="Signs out of the demo and returns to the login screen"
        hitSlop={8}
        style={{
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: "transparent",
          paddingHorizontal: 10,
          paddingVertical: 4,
          opacity: resetting ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        <Text
          size="xs"
          bold
          style={{
            color: colors.textMuted,
            fontFamily: fonts.mono,
            textTransform: "uppercase",
            letterSpacing: 0.06,
          }}
        >
          Exit
        </Text>
      </Pressable>
    </Box>
  )
}
