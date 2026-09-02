import { Pressable, View } from "react-native"
import { useTheme } from "@/hooks/useTheme"
import { fonts, borders, radii } from "@/theme"
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
        borderWidth: borders.width,
        borderColor: colors.border,
        borderRadius: radii.none,
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
              borderWidth: borders.width,
              borderColor: active ? accent : "transparent",
              borderRadius: radii.none,
              // No opacity dimming on inactive segments: it dragged the
              // textMuted label under 4.5:1 on surfaceAlt. The accent fill
              // and border already mark the active segment.
              // Fixed 44 height, not minHeight: stacked SettingsRows stretch
              // children vertically, which inflated segments to row height.
              // Deterministic height keeps labels dead-center everywhere.
              height: 44,
              justifyContent: "center",
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
                // No explicit lineHeight: numeric values serialize as CSS
                // multipliers on web (12 => 144px box). Normal metrics
                // center cleanly inside the fixed 44 segment.
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
