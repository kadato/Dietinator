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
import { addWaterEntry, deleteWaterEntry, getWaterEntriesForDate } from "@/db/water"
import type { WaterEntry } from "@/types"
import { formatDisplayDate, toDateKey } from "@/utils/date"
import { formatWaterAmount } from "@/utils/units"
import { spacing, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  visible: boolean
  /** The date whose water is being logged (usually the dashboard's date). */
  initialDateKey?: string
  onClose: () => void
  onSaved?: () => void
}

const QUICK_AMOUNTS = [250, 330, 500, 1000]

/**
 * Water logging: pick a date, tap a quick amount (or use the stepper), and the
 * pour lands instantly. Today's pours are listed with per-pour delete.
 */
export function LogWaterModal({ visible, initialDateKey, onClose, onSaved }: Props) {
  const { settings } = useApp()
  const { showError, showUndo } = useToast()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const insets = useSafeAreaInsets()
  const [dateKey, setDateKey] = useState(initialDateKey ?? toDateKey())
  const [customMl, setCustomMl] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [entries, setEntries] = useState<WaterEntry[]>([])
  const [saving, setSaving] = useState(false)

  const totalMl = entries.reduce((sum, entry) => sum + entry.amount_ml, 0)
  const goalMl = settings.water_goal_ml > 0 ? settings.water_goal_ml : 0
  const progress = goalMl > 0 ? Math.min(totalMl / goalMl, 1) : 0

  // Retarget to the requested day each time the dialog opens — render-
  // adjustment pattern (same as LogWeightModal) instead of an effect.
  const [openSync, setOpenSync] = useState({ visible: false, key: initialDateKey ?? toDateKey() })
  if (visible !== openSync.visible) {
    setOpenSync({ visible, key: initialDateKey ?? toDateKey() })
    setDateKey(initialDateKey ?? toDateKey())
    setCustomMl("")
  }

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    getWaterEntriesForDate(dateKey)
      .then((items) => {
        if (!cancelled) setEntries(items)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [dateKey, visible])

  const handleAdd = async (amountMl: number) => {
    if (!amountMl || amountMl <= 0) return
    setSaving(true)
    try {
      await addWaterEntry({ date: dateKey, amountMl })
      const items = await getWaterEntriesForDate(dateKey)
      setEntries(items)
      setCustomMl("")
      onSaved?.()
    } catch (error) {
      showError(error, "Could not log water.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (entry: WaterEntry) => {
    try {
      await deleteWaterEntry(entry.id)
      setEntries((prev) => prev.filter((item) => item.id !== entry.id))
      onSaved?.()
      showUndo("Pour removed.", () => {
        addWaterEntry({ date: entry.date, amountMl: entry.amount_ml })
          .then(() => getWaterEntriesForDate(entry.date))
          .then(setEntries)
          .catch(() => undefined)
        onSaved?.()
      })
    } catch (error) {
      showError(error, "Could not remove water.")
    }
  }

  const form = (
    <>
      <View style={styles.dialogBody}>
        <Text size="2xl" bold className="px-6 pt-2 text-center text-typography-900">
          Water
        </Text>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-4"
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={({ pressed }) => [styles.dateRow, pressed && { opacity: 0.8 }]}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Choose water date"
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text size="md" bold className="ml-2 flex-1 text-typography-900">
              {formatDisplayDate(dateKey)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Box className="my-3 items-center rounded-2xl bg-primary-500/10 px-4 py-3">
            <Text size="2xl" bold className="text-typography-900">
              {formatWaterAmount(totalMl, settings.units)}
            </Text>
            <Text size="xs" className="mt-0.5 text-typography-500">
              {goalMl > 0
                ? `of ${formatWaterAmount(goalMl, settings.units)} goal`
                : "logged this day"}
            </Text>
            {goalMl > 0 ? (
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress * 100}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
            ) : null}
          </Box>

          <Text style={styles.label}>Quick add (ml)</Text>
          <Box className="mb-3 flex-row flex-wrap gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <Pressable
                key={amount}
                onPress={() => handleAdd(amount)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={`Add ${amount} ml of water`}
                className="min-w-[76px] flex-1 items-center rounded-full bg-primary-500 px-3 py-2.5 active:opacity-85"
              >
                <Text size="sm" bold style={{ color: colors.onPrimary }}>
                  +{amount}
                </Text>
              </Pressable>
            ))}
          </Box>

          <Text style={styles.label}>Custom amount</Text>
          <Box className="flex-row items-center gap-2">
            <NumberStepper
              value={customMl}
              onChangeText={setCustomMl}
              step={50}
              accessibilityLabel="Water amount in ml"
              placeholder="e.g. 200"
              style={{ flex: 1 }}
            />
            <Pressable
              onPress={() => handleAdd(Number(customMl) || 0)}
              disabled={saving || !(Number(customMl) > 0)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Log custom water amount"
              className="h-10 items-center justify-center rounded-full px-4"
              style={{
                backgroundColor: colors.primary,
                opacity: saving || !(Number(customMl) > 0) ? 0.5 : 1,
              }}
            >
              <Ionicons name="add" size={20} color={colors.onPrimary} />
            </Pressable>
          </Box>

          {entries.length > 0 ? (
            <Box className="mt-4">
              <Text style={styles.label}>Logged pours</Text>
              {entries.map((entry) => (
                <Box
                  key={entry.id}
                  className="mb-1.5 flex-row items-center rounded-xl border border-outline-100 bg-background-50 px-3 py-2.5"
                >
                  <Ionicons name="water-outline" size={16} color={colors.primary} />
                  <Text size="sm" bold className="ml-2 flex-1 text-typography-900">
                    {formatWaterAmount(entry.amount_ml, settings.units)}
                  </Text>
                  <Pressable
                    onPress={() => handleDelete(entry)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${formatWaterAmount(entry.amount_ml, settings.units)} pour`}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </Pressable>
                </Box>
              ))}
            </Box>
          ) : null}
        </ScrollView>
      </View>

      <View style={styles.fabLayer}>
        <View style={[styles.fabLeft, { bottom: insets.bottom + 20 }]}>
          <Fab tone="surface" icon="close" onPress={onClose} accessibilityLabel="Cancel" />
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
          accessibilityLabel="Dismiss water dialog"
        />
        {isWide ? (
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
    dialogBody: {
      width: "100%",
      maxWidth: 420,
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0px 8px 40px rgba(0, 0, 0, 0.35)",
      elevation: 12,
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
    label: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
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
    progressBg: {
      marginTop: spacing.sm,
      height: 6,
      width: "80%",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
    },
  })
