import { Ionicons } from "@expo/vector-icons"
import { useNetwork } from "@/context/NetworkContext"
import { useTheme } from "@/hooks/useTheme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  visible: boolean
  message?: string
}

export function OfflineBanner({
  visible,
  message = "YAZIO unavailable — using cached foods",
}: Props) {
  const { isOnline } = useNetwork()
  const { colors } = useTheme()

  // A real connectivity loss overrides the YAZIO-specific flag so the user
  // always knows why live features are degraded.
  if (!visible && isOnline) return null

  const text = isOnline
    ? message
    : "You're offline — diary works from this device, syncing will resume later"

  return (
    <Box className="flex-row items-center justify-center gap-2 border-b border-outline-200 bg-background-warning px-4 py-2.5">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <Text size="sm" className="flex-shrink text-typography-800">
        {text}
      </Text>
    </Box>
  )
}
