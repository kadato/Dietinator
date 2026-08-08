import { Pressable, View } from "react-native"
import { useTheme } from "@/hooks/useTheme"
import { Text } from "@ui/text"

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  /** Active pill color; defaults to the theme primary. */
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
    <View className="flex-row rounded-full border border-outline-200 bg-background-50 p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            className="flex-1 items-center rounded-full px-3 py-2"
            style={active ? { backgroundColor: accent } : undefined}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
          >
            <Text
              size="sm"
              bold
              style={active ? { color: colors.onPrimary } : { color: colors.textMuted }}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
