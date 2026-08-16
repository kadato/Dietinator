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
import { addWaterEntry, deleteWaterEntry, getWaterEntriesForDate } from "@/db/water"
import type { WaterEntry } from "@/types"
import { formatDisplayDate, toDateKey } from "@/utils/date"
import { formatWaterAmount } from "@/utils/units"
import { spacing, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Button, ButtonText } from "@ui/button"

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
  const shell = createModalShellStyles(colors)
  const { isWide } = useLayout()
  const insets = useSafeAreaInsets()
  const datePress = usePressedState()
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
    if (saving) return
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
      <View
        style={[
          shell.dialogBox,
          { width: "100%", maxWidth: 420 },
          isWide ? styles.dialogBodyWide : { maxHeight: "90%" },
        ]}
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
            Water
          </Text>
        ) : (
          <Box className="flex-row items-center gap-3 px-5 pb-1" style={{ paddingTop: spacing.sm }}>
            <Box className="h-10 w-10 items-center justify-center rounded-full bg-primary-500/15">
              <Ionicons name="water-outline" size={20} color={colors.primary} />
            </Box>
            <Text size="xl" bold className="flex-1 text-typography-900">
              Water
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
          contentContainerClassName={`${isWide ? "" : "grow"} px-4 pb-4`}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={[styles.dateRow, ...(datePress.pressed ? [{ opacity: 0.8 }] : [])]}
            onPress={() => setPickerOpen(true)}
            onPressIn={datePress.onPressIn}
            onPressOut={datePress.onPressOut}
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
            <Text size="2xl" bold className="font-tabular text-typography-900">
              {formatWaterAmount(totalMl, settings.units)}
            </Text>
            <Text size="xs" className="font-tabular mt-0.5 text-typography-500">
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
                className="min-w-[76px] flex-1 items-center rounded-full bg-primary-500 px-3 py-2.5 active:opacity-80"
              >
                <Text size="sm" bold className="font-tabular" style={{ color: colors.onPrimary }}>
                  +{amount}
                </Text>
              </Pressable>
            ))}
          </Box>

          <Text style={styles.label}>Custom amount</Text>
          <Box className="flex-row items-center justify-center gap-2">
            <NumberStepper
              value={customMl}
              onChangeText={setCustomMl}
              onSubmit={() => void handleAdd(Number(customMl) || 0)}
              step={50}
              accessibilityLabel="Water amount in ml"
              placeholder="e.g. 200"
              style={{ flexGrow: 0 }}
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

          {entries.length === 0 ? (
            <Box className="flex-1 items-center justify-center gap-2 py-10">
              <Ionicons name="water-outline" size={30} color={colors.textMuted} />
              <Text size="xs" className="text-center text-typography-500">
                Nothing logged for this day yet.
              </Text>
            </Box>
          ) : (
            <Box className="mt-4">
              <Text style={styles.label}>Logged pours</Text>
              {entries.map((entry) => (
                <Box
                  key={entry.id}
                  className="mb-1.5 flex-row items-center rounded-xl border border-outline-100 bg-background-50 px-3 py-2.5"
                >
                  <Ionicons name="water-outline" size={16} color={colors.primary} />
                  <Text size="sm" bold className="font-tabular ml-2 flex-1 text-typography-900">
                    {formatWaterAmount(entry.amount_ml, settings.units)}
                  </Text>
                  <Pressable
                    onPress={() => handleDelete(entry)}
                    hitSlop={8}
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${colors.danger}14` }}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${formatWaterAmount(entry.amount_ml, settings.units)} pour`}
                  >
                    <Ionicons name="trash" size={16} color={colors.danger} />
                  </Pressable>
                </Box>
              ))}
            </Box>
          )}
        </ScrollView>
        {isWide ? null : (
          <Box className="border-t border-outline-100 px-5 py-4">
            <Button size="lg" onPress={onClose}>
              <ButtonText>Done</ButtonText>
            </Button>
          </Box>
        )}
      </View>

      {isWide ? (
        <FabCluster
          bottomOffset={insets.bottom + 20}
          left={<Fab tone="surface" icon="close" onPress={onClose} accessibilityLabel="Cancel" />}
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
          accessibilityLabel="Dismiss water dialog"
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
    // On wide screens the dialog hugs its content instead of filling the
    // viewport (the phone sheet keeps flex: 1 to fill the screen). flexBasis
    // must return to "auto" — flex: 1 sets 0%, which would collapse the
    // height once flexGrow is disabled.
    dialogBodyWide: {
      flexGrow: 0,
      flexBasis: "auto",
      maxHeight: "100%",
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
