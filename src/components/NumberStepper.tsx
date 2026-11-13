import { useCallback, useEffect, useRef, useState } from "react"
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { usePressedState } from "@/hooks/usePressedState"
import { spacing, fonts, type ColorPalette, borders, radii } from "@/theme"

type NumberStepperProps = {
  value: string
  onChangeText: (text: string) => void
  step?: number
  decimals?: number
  min?: number
  size?: "md" | "sm"
  inputWidth?: number
  /** Unit shown inside the input box (for example "g" or "kcal"), so the
      plus and minus keys stay at the container edges. */
  unit?: string
  accessibilityLabel: string
  placeholder?: string
  onSubmit?: () => void
  onFocus?: () => void
  onBlur?: () => void
  style?: StyleProp<ViewStyle>
}

function formatStepValue(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return ""
  return String(Number(value.toFixed(decimals)))
}

export function NumberStepper({
  value,
  onChangeText,
  step = 1,
  decimals = 0,
  min = 0,
  size = "md",
  inputWidth,
  unit,
  accessibilityLabel,
  placeholder,
  onSubmit,
  onFocus,
  onBlur,
  style,
}: NumberStepperProps) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const sm = size === "sm"
  const minusPress = usePressedState()
  const plusPress = usePressedState()

  const parsed = Number(value)
  const current = Number.isFinite(parsed) ? parsed : 0
  const minusDisabled = current <= min

  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  const [ghost, setGhost] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    setGhost(value)
    onFocus?.()
  }, [onFocus, value])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    if (value === "" && ghost !== "") {
      onChangeText(ghost)
    }
    onBlur?.()
  }, [ghost, onBlur, onChangeText, value])

  const stepBy = useCallback(
    (direction: 1 | -1) => {
      const parsedCurrent = Number(valueRef.current !== "" ? valueRef.current : ghost)
      const base = Number.isFinite(parsedCurrent) ? parsedCurrent : 0
      const next = Math.max(min, base + direction * step)
      onChangeText(formatStepValue(next, decimals))
    },
    [decimals, ghost, min, onChangeText, step],
  )

  const handleTextChange = useCallback(
    (text: string) => {
      const normalized = text.replace(",", ".")
      const sanitized = normalized.replace(/[^\d.]/g, "")
      if (sanitized === "" || sanitized === ".") {
        onChangeText("")
        return
      }
      const parsed = Number(sanitized)
      if (!Number.isFinite(parsed)) {
        onChangeText("")
        return
      }
      onChangeText(parsed < min ? String(min) : sanitized)
    },
    [min, onChangeText],
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

  const textField = (
    <TextInput
      style={[
        unit ? styles.inputInner : styles.input,
        sm && (unit ? styles.inputInnerSm : styles.inputSm),
        unit ? { width: inputWidth ?? 64 } : inputWidth != null ? { width: inputWidth } : null,
        !unit && isFocused ? styles.inputFocused : null,
      ]}
      keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "decimal-pad"}
      enterKeyHint="done"
      value={value}
      onChangeText={handleTextChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      selectTextOnFocus
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      returnKeyType="done"
      blurOnSubmit={true}
      onSubmitEditing={onSubmit}
      accessibilityLabel={accessibilityLabel}
    />
  )

  return (
    <View style={[styles.row, sm && styles.rowSm, style]}>
      <Pressable
        testID="stepper-minus"
        onPress={() => stepBy(-1)}
        onLongPress={() => startRepeat(-1)}
        onPressIn={minusPress.onPressIn}
        onPressOut={() => {
          minusPress.onPressOut()
          stopRepeat()
        }}
        disabled={minusDisabled}
        hitSlop={sm ? 8 : 4}
        style={[
          styles.btn,
          sm && styles.btnSm,
          minusDisabled && styles.btnDisabled,
          minusPress.pressed && !minusDisabled && styles.btnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Decrease value"
        accessibilityHint={`Decrease ${accessibilityLabel}`}
      >
        <Feather
          name="minus"
          size={sm ? 16 : 18}
          color={minusDisabled ? colors.textMuted : colors.text}
        />
      </Pressable>
      {unit ? (
        <View
          style={[
            styles.inputWrap,
            sm && styles.inputWrapSm,
            inputWidth != null ? { width: inputWidth } : styles.inputWrapFlex,
            isFocused && styles.inputWrapFocused,
          ]}
        >
          {textField}
          <Text style={styles.unitSuffix}>{unit}</Text>
        </View>
      ) : (
        textField
      )}
      <Pressable
        testID="stepper-plus"
        onPress={() => stepBy(1)}
        onLongPress={() => startRepeat(1)}
        onPressIn={plusPress.onPressIn}
        onPressOut={() => {
          plusPress.onPressOut()
          stopRepeat()
        }}
        hitSlop={sm ? 8 : 4}
        style={[styles.btn, sm && styles.btnSm, plusPress.pressed && styles.btnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Increase value"
        accessibilityHint={`Increase ${accessibilityLabel}`}
      >
        <Feather name="plus" size={sm ? 16 : 18} color={colors.text} />
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
      justifyContent: "space-between",
      width: "100%",
    },
    rowSm: { gap: 6, justifyContent: "flex-end", width: "auto", flexShrink: 0 },
    btn: {
      width: 44,
      height: 44,
      flexShrink: 0,
      borderRadius: radii.none,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      borderWidth: borders.width,
      borderColor: colors.border,
      boxShadow: "none",
      elevation: 0,
    },
    btnSm: { width: 44, height: 44, borderRadius: radii.none },
    btnDisabled: { opacity: 0.4 },
    btnPressed: { opacity: 0.7 },
    input: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      height: 44,
      backgroundColor: colors.surface,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      paddingVertical: 0,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      textAlign: "center",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
      boxShadow: "none",
      elevation: 0,
    },
    inputSm: {
      flexGrow: 0,
      flexShrink: 0,
      width: 68,
      minWidth: 56,
      height: 44,
      paddingVertical: 0,
      paddingHorizontal: spacing.xs,
      fontSize: 14,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    inputFocused: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}0D`,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 44,
      minWidth: 0,
      backgroundColor: colors.surface,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      boxShadow: "none",
      elevation: 0,
    },
    inputWrapSm: {
      height: 44,
    },
    inputWrapFlex: {
      flexGrow: 1,
      flexShrink: 1,
    },
    inputWrapFocused: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}0D`,
    },
    inputInner: {
      flexShrink: 0,
      minWidth: 0,
      height: "100%",
      backgroundColor: "transparent",
      paddingVertical: 0,
      paddingHorizontal: 0,
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      textAlign: "right",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      letterSpacing: 0.4,
      boxShadow: "none",
      elevation: 0,
    },
    inputInnerSm: {
      paddingHorizontal: 0,
      fontSize: 14,
    },
    unitSuffix: {
      flexShrink: 0,
      paddingLeft: 6,
      paddingRight: spacing.sm,
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
  })
