import { Ionicons } from "@expo/vector-icons"
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
  const { colors } = useTheme()
  if (!visible) return null
  return (
    <Box className="flex-row items-center justify-center gap-2 border-b border-outline-200 bg-background-warning px-4 py-2.5">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <Text size="sm" className="flex-shrink text-typography-800">
        {message}
      </Text>
    </Box>
  )
}
