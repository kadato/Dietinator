import { Pressable, View } from "react-native"
import { useTheme } from "@/hooks/useTheme"
import { fonts } from "@/theme"
import { Text } from "@ui/text"

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  accentColor?: string
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  accentColor,
}: Props<T>) {
  const { colors } = useTheme()
  const accent = accentColor ?? colors.primary

  return (
    <View
      className="flex-row gap-1 border bg-background-100 p-1"
      style={{
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 0,
        backgroundColor: colors.surfaceAlt,
        boxShadow: "none",
        elevation: 0,
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            className="flex-1 items-center px-3 py-2"
            style={{
              backgroundColor: active ? accent : "transparent",
              borderWidth: 1.5,
              borderColor: active ? accent : "transparent",
              borderRadius: 0,
              opacity: active ? 1 : 0.85,
              boxShadow: "none",
              elevation: 0,
            }}
            onPress={() => onChange(option.value)}
            hitSlop={2}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
          >
            <Text
              size="sm"
              bold
              style={{
                color: active ? colors.onPrimary : colors.textMuted,
                fontFamily: fonts.mono,
                fontVariant: ["tabular-nums"],
                textTransform: "uppercase",
                letterSpacing: 0.4,
                fontSize: 12,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
