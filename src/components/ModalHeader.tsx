import { View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { fonts, borders } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  icon: keyof typeof Feather.glyphMap
  /** Domain color: water cyan, weight violet, meal colors, primary. */
  accent: string
  title: string
  subtitle?: string
}

/**
 * Shared dialog header. A 5px accent bar owns the top edge, then a tinted
 * band carries a solid accent icon well, an ink title, and muted subtitle.
 * Every modal takes it so dialogs read as one family.
 */
export function ModalHeader({ icon, accent, title, subtitle }: Props) {
  const { colors } = useTheme()
  return (
    <View>
      <View style={{ height: 5, backgroundColor: accent }} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 12,
          backgroundColor: `${accent}1A`,
          borderBottomWidth: borders.width,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accent,
            borderWidth: borders.width,
            borderColor: colors.border,
          }}
        >
          <Feather name={icon} size={18} color={colors.onPrimary} />
        </View>
        <Box className="min-w-0 flex-1">
          <Text
            bold
            numberOfLines={1}
            style={{
              fontFamily: fonts.mono,
              textTransform: "uppercase",
              letterSpacing: 0.04,
              fontSize: 15,
              color: accent,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                letterSpacing: 0.04,
                color: colors.textMuted,
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </Box>
      </View>
    </View>
  )
}
