import { useCallback, useEffect, useRef } from "react"
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { spacing, type ColorPalette } from "@/theme"

type NumberStepperProps = {
  value: string
  onChangeText: (text: string) => void
  /** Amount added or subtracted per tap. Defaults to 1. */
  step?: number
  /** Decimal places for rounding stepped values. Defaults to 0. */
  decimals?: number
  /** Floor for the value; the minus button disables at it. Defaults to 0. */
  min?: number
  /** `sm` is the compact inline variant for rows and goal fields. */
  size?: "md" | "sm"
  accessibilityLabel: string
  placeholder?: string
  style?: StyleProp<ViewStyle>
}

/** Round, drop float noise, and strip trailing zeros ("75.0" → "75"). */
function formatStepValue(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return ""
  return String(Number(value.toFixed(decimals)))
}

/**
 * Numeric input with − / + buttons for quick value changes. Tap steps once;
 * press and hold to repeat (every 90ms). The value stays fully editable.
 */
export function NumberStepper({
  value,
  onChangeText,
  step = 1,
  decimals = 0,
  min = 0,
  size = "md",
  accessibilityLabel,
  placeholder,
  style,
}: NumberStepperProps) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const sm = size === "sm"

  const parsed = Number(value)
  const current = Number.isFinite(parsed) ? parsed : 0
  const minusDisabled = current <= min

  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  const stepBy = useCallback(
    (direction: 1 | -1) => {
      const parsedCurrent = Number(valueRef.current)
      const base = Number.isFinite(parsedCurrent) ? parsedCurrent : 0
      const next = Math.max(min, base + direction * step)
      onChangeText(formatStepValue(next, decimals))
    },
    [decimals, min, onChangeText, step],
  )

  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopRepeat = useCallback(() => {
    if (repeatTimer.current) {
      clearInterval(repeatTimer.current)
      repeatTimer.current = null
    }
  }, [])
  const startRepeat = useCallback(
    (direction: 1 | -1) => {
      stopRepeat()
      repeatTimer.current = setInterval(() => stepBy(direction), 90)
    },
    [stepBy, stopRepeat],
  )
  useEffect(() => stopRepeat, [stopRepeat])

  return (
    <View style={[styles.row, sm && styles.rowSm, style]}>
      <Pressable
        onPress={() => stepBy(-1)}
        onLongPress={() => startRepeat(-1)}
        onPressOut={stopRepeat}
        disabled={minusDisabled}
        style={[styles.btn, sm && styles.btnSm, minusDisabled && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Decrease value"
        accessibilityHint={`Decrease ${accessibilityLabel}`}
      >
        <Ionicons
          name="remove"
          size={sm ? 16 : 20}
          color={minusDisabled ? colors.textMuted : colors.text}
        />
      </Pressable>
      <TextInput
        style={[styles.input, sm && styles.inputSm]}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel}
        maxFontSizeMultiplier={1.4}
      />
      <Pressable
        onPress={() => stepBy(1)}
        onLongPress={() => startRepeat(1)}
        onPressOut={stopRepeat}
        style={[styles.btn, sm && styles.btnSm]}
        accessibilityRole="button"
        accessibilityLabel="Increase value"
        accessibilityHint={`Increase ${accessibilityLabel}`}
      >
        <Ionicons name="add" size={sm ? 16 : 20} color={colors.text} />
      </Pressable>
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    rowSm: { gap: 4 },
    btn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnSm: { width: 28, height: 28, borderRadius: 14 },
    btnDisabled: { opacity: 0.4 },
    input: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: 18,
      textAlign: "center",
    },
    inputSm: {
      flex: 0,
      width: 44,
      minWidth: 0,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      fontSize: 15,
    },
  })
