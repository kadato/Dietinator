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
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { formatDisplayDate, toDateKey } from "@/utils/date"
import { getWeightEntryForDate, saveWeightEntry } from "@/db/weight"
import { isImperial, parseWeightInput } from "@/utils/units"
import { spacing, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  visible: boolean
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
export function LogWeightModal({ visible, onClose, onSaved }: Props) {
  const { settings } = useApp()
  const { showError, showWarning, showSuccess } = useToast()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const insets = useSafeAreaInsets()
  const [dateKey, setDateKey] = useState(toDateKey())
  const [weightText, setWeightText] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

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
      showSuccess(`Logged ${formatDisplayDate(dateKey)}.`, "Weight saved")
      onClose()
      onSaved?.()
    } catch (error) {
      showError(error, "Could not save weight.")
    } finally {
      setSaving(false)
    }
  }

  const form = (
    <>
      <ModalContainerBox maxWidth={420}>
        <Text size="2xl" bold className="px-6 pt-2 text-center text-typography-900">
          Log weight
        </Text>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-4"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Date</Text>
          <Pressable
            style={({ pressed }) => [styles.dateRow, pressed && { opacity: 0.8 }]}
            onPress={() => setPickerOpen(true)}
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
          <Box className="flex-row items-center gap-2">
            <NumberStepper
              value={weightText}
              onChangeText={setWeightText}
              step={0.1}
              decimals={1}
              accessibilityLabel="Weight"
              placeholder={isImperial(settings.units) ? "e.g. 165.4" : "e.g. 75.2"}
              style={{ flex: 1 }}
            />
            <Text size="sm" bold className="text-typography-500">
              {isImperial(settings.units) ? "lb" : "kg"}
            </Text>
          </Box>
          <Text size="xs" className="mt-1 leading-4 text-typography-500">
            Stored in kg — switching units later keeps your history intact.
          </Text>
        </ScrollView>
      </ModalContainerBox>

      <View style={styles.fabLayer}>
        <View style={[styles.fabLeft, { bottom: insets.bottom + 20 }]}>
          <Fab tone="surface" icon="close" onPress={onClose} accessibilityLabel="Cancel" />
        </View>
        <View style={[styles.fabRight, { bottom: insets.bottom + 20 }]}>
          <Fab
            icon="checkmark"
            onPress={handleSave}
            disabled={saving}
            accessibilityLabel="Save weight"
          />
        </View>
      </View>

      <DatePickerModal
        visible={pickerOpen}
        dateKey={dateKey}
        onSelect={setDateKey}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss weight dialog"
        />
        {isWide ? (
          // box-none: taps on the dimmed area around the dialog fall through
          // to the dismiss Pressable; taps on the dialog itself stay in it.
          <View style={styles.dialogWrap} pointerEvents="box-none">
            {form}
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.sheet}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {form}
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  )
}

/** Centered column with the same look as ModalContainer on wide screens. */
function ModalContainerBox({
  maxWidth,
  children,
}: {
  maxWidth: number
  children: React.ReactNode
}) {
  const { colors } = useTheme()
  const { isWide } = useLayout()
  if (!isWide) return <View style={{ flex: 1 }}>{children}</View>
  return (
    <View
      testID="log-weight-dialog"
      style={{
        width: "100%",
        maxWidth,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        boxShadow: "0px 8px 40px rgba(0, 0, 0, 0.35)",
        elevation: 12,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
    },
    sheet: {
      flex: 1,
      backgroundColor: colors.background,
    },
    dialogWrap: {
      flex: 1,
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
      paddingHorizontal: 24,
    },
    fabLayer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: "box-none",
    },
    fabLeft: {
      position: "absolute",
      left: 20,
      alignItems: "flex-start",
      pointerEvents: "box-none",
    },
    fabRight: {
      position: "absolute",
      right: 20,
      alignItems: "flex-end",
      pointerEvents: "box-none",
    },
    label: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.md,
      color: colors.text,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
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
