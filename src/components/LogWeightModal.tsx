import { useEffect, useState } from "react"
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DatePickerModal } from "@/components/DatePickerModal"
import { NumberStepper } from "@/components/NumberStepper"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { createModalShellStyles } from "@/components/modal-shell"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { usePressedState } from "@/hooks/usePressedState"
import { formatDisplayDate, toDateKey } from "@/utils/date"
import { getWeightEntryForDate, saveWeightEntry } from "@/db/weight"
import { isImperial, parseWeightInput } from "@/utils/units"
import { spacing, fonts, type ColorPalette } from "@/theme"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Button, ButtonText } from "@ui/button"

type Props = {
  visible: boolean
  initialDateKey?: string
  onClose: () => void
  onSaved?: () => void
}

function weightToDisplay(kg: number, units: string): string {
  if (isImperial(units)) {
    return String(Math.round(kg * 2.2046226 * 10) / 10)
  }
  return String(kg)
}

export function LogWeightModal({ visible, initialDateKey, onClose, onSaved }: Props) {
  useEscapeToClose(visible, onClose)
  const { settings } = useApp()
  const { showError, showWarning } = useToast()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const shell = createModalShellStyles(colors)
  const { isMedium } = useLayout()
  const insets = useSafeAreaInsets()
  const datePress = usePressedState()
  const [dateKey, setDateKey] = useState(initialDateKey ?? toDateKey())
  const [weightText, setWeightText] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [openSync, setOpenSync] = useState({ visible: false, key: initialDateKey ?? toDateKey() })
  if (visible !== openSync.visible) {
    setOpenSync({ visible, key: initialDateKey ?? toDateKey() })
    setDateKey(initialDateKey ?? toDateKey())
    setWeightText("")
  }

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void (async () => {
      try {
        const existing = await getWeightEntryForDate(dateKey)
        if (!cancelled && existing) {
          setWeightText(weightToDisplay(existing.weight_kg, settings.units))
        } else if (!cancelled) {
          setWeightText("")
        }
      } catch {
        if (!cancelled) setWeightText("")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dateKey, settings.units, visible])

  const handleSave = async () => {
    if (saving) return
    const weightKg = parseWeightInput(weightText, settings.units)
    if (weightKg === null) {
      showWarning(
        `Enter a valid weight in ${isImperial(settings.units) ? "pounds" : "kilograms"}.`,
        "Missing weight",
      )
      return
    }
    setSaving(true)
    try {
      await saveWeightEntry({ date: dateKey, weightKg })
      onClose()
      onSaved?.()
    } catch (error) {
      showError(error, "Could not save weight.")
    } finally {
      setSaving(false)
    }
  }

  const currentWeightKg = parseWeightInput(weightText, settings.units)
  const bmi =
    currentWeightKg && settings.height_cm > 0
      ? Math.round(
          (currentWeightKg / ((settings.height_cm / 100) * (settings.height_cm / 100))) * 10,
        ) / 10
      : null

  const form = (
    <>
      <View
        testID="log-weight-dialog"
        style={[
          shell.dialogBox,
          {
            width: "100%",
            maxWidth: 420,
            maxHeight: "90%",
            borderRadius: 0,
            borderWidth: 1.5,
            borderColor: colors.border,
            boxShadow: "none",
            elevation: 0,
          },
        ]}
      >
        <Box className="items-center pt-2">
          <Box
            className="h-1 w-9 rounded-none border bg-outline-200"
            style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
          />
        </Box>
        {isMedium ? (
          <Text
            size="2xl"
            bold
            className="px-6 text-center text-typography-900"
            style={{
              paddingTop: insets.top + spacing.sm,
              fontFamily: fonts.mono,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Log weight
          </Text>
        ) : (
          <Box className="flex-row items-center gap-3 px-5 pb-1" style={{ paddingTop: spacing.sm }}>
            <Box
              className="h-10 w-10 items-center justify-center rounded-none border bg-primary-500/15"
              style={{
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 0,
                backgroundColor: `${colors.primary}14`,
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <Feather name="activity" size={18} color={colors.primary} />
            </Box>
            <Text
              size="xl"
              bold
              className="flex-1 text-typography-900"
              style={{ fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 }}
            >
              Log weight
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-none border active:opacity-70"
              style={{
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 0,
                backgroundColor: colors.surfaceAlt,
                boxShadow: "none",
                elevation: 0,
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </Box>
        )}
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-4"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Date</Text>
          <Pressable
            style={({ pressed }) => [styles.dateRow, pressed && styles.pressed]}
            onPress={() => setPickerOpen(true)}
            onPressIn={datePress.onPressIn}
            onPressOut={datePress.onPressOut}
            accessibilityRole="button"
            accessibilityLabel="Choose date"
          >
            <Feather name="calendar" size={16} color={colors.primary} />
            <Text
              size="md"
              bold
              className="ml-2 flex-1 text-typography-900"
              style={{ fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 }}
            >
              {formatDisplayDate(dateKey)}
            </Text>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>

          <Text style={styles.label}>Weight ({isImperial(settings.units) ? "lb" : "kg"})</Text>
          <Box className="flex-row items-center justify-center gap-2">
            <NumberStepper
              value={weightText}
              onChangeText={setWeightText}
              onSubmit={() => void handleSave()}
              step={isImperial(settings.units) ? 0.5 : 0.1}
              decimals={1}
              accessibilityLabel="Weight"
              placeholder={isImperial(settings.units) ? "165.4" : "75.2"}
              style={{ flex: 1 }}
            />
            <Text
              size="sm"
              bold
              className="text-typography-500"
              style={{
                fontFamily: fonts.mono,
                fontVariant: ["tabular-nums"],
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {isImperial(settings.units) ? "lb" : "kg"}
            </Text>
          </Box>

          {bmi !== null ? (
            <Box
              className="mt-3 flex-row items-center justify-between rounded-none border bg-primary-500/10 px-4 py-3"
              style={{
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 0,
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <Box>
                <Text
                  size="xs"
                  bold
                  className="font-tabular text-typography-900"
                  style={{ fontFamily: fonts.mono, fontVariant: ["tabular-nums"] }}
                >
                  BMI {bmi}
                </Text>
                <Text
                  size="2xs"
                  className="font-tabular text-typography-500"
                  style={{
                    fontFamily: fonts.mono,
                    fontVariant: ["tabular-nums"],
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  Height: {settings.height_cm} cm
                </Text>
              </Box>
              <Text
                size="xs"
                bold
                style={{
                  color: colors.primary,
                  fontFamily: fonts.mono,
                  fontVariant: ["tabular-nums"],
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                {bmi < 18.5
                  ? "Underweight"
                  : bmi < 25
                    ? "Normal weight"
                    : bmi < 30
                      ? "Overweight"
                      : "Obese"}
              </Text>
            </Box>
          ) : null}
        </ScrollView>
        {isMedium ? null : (
          <Box
            className="flex-row items-center gap-3 border-t px-5 py-4"
            style={{ borderTopWidth: 1.5, borderTopColor: colors.border }}
          >
            <Button
              size="md"
              variant="outline"
              action="secondary"
              className="flex-1"
              onPress={onClose}
              style={
                {
                  borderRadius: 0,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  boxShadow: "none",
                  elevation: 0,
                } as any
              }
            >
              <ButtonText
                style={
                  { fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 } as any
                }
              >
                Cancel
              </ButtonText>
            </Button>
            <Button
              size="md"
              className="flex-1"
              onPress={handleSave}
              isDisabled={saving}
              // Specific action name on mobile, matching the wide-layout
              // FAB: generic "Save" says nothing about what gets saved.
              accessibilityLabel="Save weight"
              style={
                {
                  borderRadius: 0,
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  boxShadow: "none",
                  elevation: 0,
                } as any
              }
            >
              <ButtonText
                style={
                  { fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 } as any
                }
              >
                {saving ? "Saving…" : "Save"}
              </ButtonText>
            </Button>
          </Box>
        )}
      </View>

      {isMedium ? (
        <FabCluster
          bottomOffset={insets.bottom + 20}
          left={<Fab tone="surface" icon="x" onPress={onClose} accessibilityLabel="Cancel" />}
          right={
            <Fab
              icon="checkmark"
              onPress={handleSave}
              disabled={saving}
              accessibilityLabel="Save weight"
            />
          }
        />
      ) : null}

      <DatePickerModal
        visible={pickerOpen}
        dateKey={dateKey}
        onSelect={setDateKey}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === "web" ? "none" : "slide"}
      onRequestClose={onClose}
      {...(Platform.OS === "android"
        ? { statusBarTranslucent: true, hardwareAccelerated: true }
        : {})}
    >
      <View style={shell.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss weight dialog"
        />
        {isMedium ? (
          // Prop form, not style. react-native-web drops `pointerEvents`
          // from both inline styles and css-interop-processed StyleSheet
          // output (computed stays `auto`), so the full-screen wrapper
          // swallowed backdrop taps and desktop could not dismiss the
          // dialog. RN 0.85 deprecation-warns on the prop; that noise is
          // accepted because the style form is functionally broken here.
          <View accessibilityViewIsModal={true} pointerEvents="box-none" style={shell.dialogWrap}>
            {form}
          </View>
        ) : (
          <KeyboardAvoidingView
            accessibilityViewIsModal={true}
            style={shell.dialogWrap}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {form}
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 0,
      padding: spacing.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      boxShadow: "none",
      elevation: 0,
    },
    pressed: {
      opacity: 0.7,
    },
  })
