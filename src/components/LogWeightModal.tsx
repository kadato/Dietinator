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
import { Ionicons } from "@expo/vector-icons"
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
import { spacing, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Button, ButtonText } from "@ui/button"

type Props = {
  visible: boolean
  /** Date to log/edit when the modal opens (defaults to today). */
  initialDateKey?: string
  /** Closing without saving — also called after a successful save. */
  onClose: () => void
  /** Called after a successful save so the caller can reload its data. */
  onSaved?: () => void
}

function weightToDisplay(kg: number, units: string): string {
  if (isImperial(units)) {
    return String(Math.round(kg * 2.2046226 * 10) / 10)
  }
  return String(kg)
}

/**
 * True overlay modal (React Native `Modal`, not a route — route modals render
 * as plain pages on web). Centered dialog on wide screens, full-bleed sheet
 * on phones; the action FABs float on the backdrop, outside the dialog.
 */
export function LogWeightModal({ visible, initialDateKey, onClose, onSaved }: Props) {
  const { settings } = useApp()
  const { showError, showWarning } = useToast()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const shell = createModalShellStyles(colors)
  const { isWide } = useLayout()
  const insets = useSafeAreaInsets()
  const datePress = usePressedState()
  const [dateKey, setDateKey] = useState(initialDateKey ?? toDateKey())
  const [weightText, setWeightText] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // An edit request (initialDateKey) retargets the dialog when it opens —
  // render-adjustment pattern so no effect round-trip is needed.
  const [openSync, setOpenSync] = useState({ visible: false, key: initialDateKey ?? toDateKey() })
  if (visible !== openSync.visible) {
    setOpenSync({ visible, key: initialDateKey ?? toDateKey() })
    setDateKey(initialDateKey ?? toDateKey())
    setWeightText("")
  }

  // Prefill the existing entry when one is already logged for this date.
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
        style={[shell.dialogBox, { width: "100%", maxWidth: 420, maxHeight: "90%" }]}
      >
        <Box className="items-center pt-2">
          <Box className="h-1 w-9 rounded-full bg-outline-200" />
        </Box>
        {isWide ? (
          <Text
            size="2xl"
            bold
            className="px-6 text-center text-typography-900"
            style={{ paddingTop: insets.top + spacing.sm }}
          >
            Log weight
          </Text>
        ) : (
          <Box className="flex-row items-center gap-3 px-5 pb-1" style={{ paddingTop: spacing.sm }}>
            <Box className="h-10 w-10 items-center justify-center rounded-full bg-primary-500/15">
              <Ionicons name="scale-outline" size={20} color={colors.primary} />
            </Box>
            <Text size="xl" bold className="flex-1 text-typography-900">
              Log weight
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-background-100"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </Box>
        )}
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-4"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Date</Text>
          <Pressable
            style={[styles.dateRow, ...(datePress.pressed ? [{ opacity: 0.8 }] : [])]}
            onPress={() => setPickerOpen(true)}
            onPressIn={datePress.onPressIn}
            onPressOut={datePress.onPressOut}
            accessibilityRole="button"
            accessibilityLabel="Choose date"
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text size="md" bold className="ml-2 flex-1 text-typography-900">
              {formatDisplayDate(dateKey)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
              placeholder={isImperial(settings.units) ? "e.g. 165.4" : "e.g. 75.2"}
              style={{ flex: 1 }}
            />
            <Text size="sm" bold className="text-typography-500">
              {isImperial(settings.units) ? "lb" : "kg"}
            </Text>
          </Box>

          {bmi !== null ? (
            <Box className="mt-3 flex-row items-center justify-between rounded-2xl bg-primary-500/10 px-4 py-3">
              <Box>
                <Text size="xs" bold className="text-typography-900">
                  BMI {bmi}
                </Text>
                <Text size="2xs" className="text-typography-500">
                  Height: {settings.height_cm} cm
                </Text>
              </Box>
              <Text size="xs" bold style={{ color: colors.primary }}>
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

          <Text size="xs" className="mt-1 leading-4 text-typography-500">
            Stored in kg — switching units later keeps your history intact.
          </Text>
        </ScrollView>
        {isWide ? null : (
          <Box className="flex-row items-center gap-3 border-t border-outline-100 px-5 py-4">
            <Button
              size="lg"
              variant="outline"
              action="secondary"
              className="flex-1"
              onPress={onClose}
            >
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button size="lg" className="flex-1" onPress={handleSave} isDisabled={saving}>
              <ButtonText>{saving ? "Saving…" : "Save weight"}</ButtonText>
            </Button>
          </Box>
        )}
      </View>

      {isWide ? (
        <FabCluster
          bottomOffset={insets.bottom + 20}
          left={<Fab tone="surface" icon="close" onPress={onClose} accessibilityLabel="Cancel" />}
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
    // Web has no native sheet animation — slide would leave the dialog
    // mid-transition when tests measure it, so native gets the slide and
    // web renders instantly.
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
        {isWide ? (
          <View style={shell.dialogWrap}>{form}</View>
        ) : (
          <KeyboardAvoidingView
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
      fontSize: 13,
      fontWeight: "600",
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
  })
