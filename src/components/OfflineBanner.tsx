import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useNetwork } from "@/context/NetworkContext"
import { useTheme } from "@/hooks/useTheme"
import { fonts, radii } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  visible: boolean
  message?: string
}

export function OfflineBanner({
  visible,
  message = "YAZIO unavailable, using cached foods",
}: Props) {
  const { isOnline } = useNetwork()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  if (!visible && isOnline) return null

  const text = isOnline ? message : "Offline, diary works, sync resumes later"

  return (
    <Box
      className="flex-row items-center justify-center gap-2 border-b bg-background-warning px-4 py-2.5"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        borderWidth: 0,
        borderBottomWidth: 1.5,
        borderColor: colors.border,
        borderRadius: radii.none,
        boxShadow: "none",
        elevation: 0,
        // On headerless screens the banner is the topmost element, so it
        // clears the status bar and camera cutout itself.
        paddingTop: insets.top > 0 ? insets.top + 10 : undefined,
        paddingLeft: insets.left + 16,
        paddingRight: insets.right + 16,
      }}
    >
      <Feather name="wifi-off" size={16} color={colors.warning} />
      <Text
        size="sm"
        className="flex-shrink text-typography-800"
        style={{
          fontFamily: fonts.mono,
          fontVariant: ["tabular-nums"],
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {text}
      </Text>
    </Box>
  )
}
