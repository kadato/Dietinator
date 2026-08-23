import { useCallback, useEffect, useRef, useState } from "react"
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { spacing, fonts, type ColorPalette } from "@/theme"

type NumberStepperProps = {
  value: string
  onChangeText: (text: string) => void
  step?: number
  decimals?: number
  min?: number
  size?: "md" | "sm"
  inputWidth?: number
  accessibilityLabel: string
  placeholder?: string
  onSubmit?: () => void
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
  accessibilityLabel,
  placeholder,
  onSubmit,
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

  const [ghost, setGhost] = useState("")

  const handleFocus = useCallback(() => {
    setGhost(value)
  }, [value])

  const handleBlur = useCallback(() => {
    if (value === "" && ghost !== "") {
      onChangeText(ghost)
    }
  }, [ghost, onChangeText, value])

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

  return (
    <View style={[styles.row, sm && styles.rowSm, style]}>
      <Pressable
        onPress={() => stepBy(-1)}
        onLongPress={() => startRepeat(-1)}
        onPressOut={stopRepeat}
        disabled={minusDisabled}
        hitSlop={sm ? 8 : 4}
        style={({ pressed }) => [
          styles.btn,
          sm && styles.btnSm,
          minusDisabled && styles.btnDisabled,
          pressed && !minusDisabled && styles.btnPressed,
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
      <TextInput
        style={[
          styles.input,
          sm && styles.inputSm,
          inputWidth != null ? { width: inputWidth } : null,
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
        maxFontSizeMultiplier={2}
      />
      <Pressable
        onPress={() => stepBy(1)}
        onLongPress={() => startRepeat(1)}
        onPressOut={stopRepeat}
        hitSlop={sm ? 8 : 4}
        style={({ pressed }) => [styles.btn, sm && styles.btnSm, pressed && styles.btnPressed]}
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
      justifyContent: "center",
    },
    rowSm: { gap: 6 },
    btn: {
      width: 44,
      height: 44,
      borderRadius: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: colors.border,
      boxShadow: "none",
      elevation: 0,
    },
    btnSm: { width: 36, height: 36, borderRadius: 0 },
    btnDisabled: { opacity: 0.4 },
    btnPressed: { opacity: 0.7 },
    input: {
      flexGrow: 0,
      flexShrink: 0,
      width: 120,
      minWidth: 0,
      height: 44,
      backgroundColor: colors.surface,
      borderRadius: 0,
      borderWidth: 1.5,
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
      height: 36,
      paddingVertical: 0,
      paddingHorizontal: spacing.xs,
      fontSize: 14,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
  })
