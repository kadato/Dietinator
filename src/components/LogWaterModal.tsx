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
import { addWaterEntry, deleteWaterEntry, getWaterEntriesForDate } from "@/db/water"
import type { WaterEntry } from "@/types"
import { formatDisplayDate, toDateKey } from "@/utils/date"
import { formatWaterAmount } from "@/utils/units"
import { spacing, fonts, type ColorPalette, borders, radii } from "@/theme"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  visible: boolean
  initialDateKey?: string
  onClose: () => void
  onSaved?: () => void
}

const QUICK_AMOUNTS = [250, 330, 500, 1000]

export function LogWaterModal({ visible, initialDateKey, onClose, onSaved }: Props) {
  useEscapeToClose(visible, onClose)
  const { settings } = useApp()
  const { showError, showUndo } = useToast()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const shell = createModalShellStyles(colors)
  // Dialog presentation starts at the medium breakpoint: 600-899px windows
  // (portrait tablets, Split View) get a centered dialog instead of a
  // stretched full-height phone sheet.
  const { isMedium } = useLayout()
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
          {
            width: "100%",
            maxWidth: 420,
            maxHeight: "75%",
            borderRadius: radii.none,
            borderWidth: borders.width,
            borderColor: colors.border,
            elevation: 0,
            flexShrink: 1,
          },
          isMedium ? styles.dialogBodyWide : undefined,
        ]}
      >
        <Box className="flex-row items-center gap-3 px-5 pb-2 pt-4">
          <Box
            className="h-10 w-10 items-center justify-center rounded-none border bg-primary-500/15"
            style={{
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
              elevation: 0,
            }}
          >
            <Feather name="droplet" size={18} color={colors.primary} />
          </Box>
          <Text
            size="xl"
            bold
            className="text-typography-900"
            style={{ fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 }}
          >
            Water
          </Text>
        </Box>
        <ScrollView
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={[styles.dateRow, datePress.pressed && styles.pressed]}
            onPress={() => setPickerOpen(true)}
            onPressIn={datePress.onPressIn}
            onPressOut={datePress.onPressOut}
            accessibilityRole="button"
            accessibilityLabel="Choose water date"
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

          <Box
            className="my-3 items-center rounded-none border bg-primary-500/10 px-4 py-3"
            style={{
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
              elevation: 0,
            }}
          >
            <Text
              size="2xl"
              bold
              className="font-tabular text-typography-900"
              style={{ fontFamily: fonts.mono, fontVariant: ["tabular-nums"] }}
            >
              {formatWaterAmount(totalMl, settings.units)}
            </Text>
            <Text
              size="xs"
              className="font-tabular mt-0.5 text-typography-500"
              style={{
                fontFamily: fonts.mono,
                fontVariant: ["tabular-nums"],
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
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

          <Text style={styles.label}>
            Quick add ({settings.units === "imperial" ? "fl oz" : "ml"})
          </Text>
          <Box className="mb-3 flex-row flex-wrap gap-2">
            {QUICK_AMOUNTS.map((amount) => {
              const isImperial = settings.units === "imperial"
              const label = isImperial
                ? `+${formatWaterAmount(amount, settings.units)}`
                : `+${amount}`
              const a11y = isImperial ? formatWaterAmount(amount, settings.units) : `${amount} ml`
              return (
                <Pressable
                  key={amount}
                  onPress={() => handleAdd(amount)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${a11y} of water`}
                  className="min-w-[76px] flex-1 items-center rounded-none border bg-primary-500 px-3 py-2.5 active:opacity-80"
                  style={{
                    borderWidth: borders.width,
                    borderColor: colors.primary,
                    borderRadius: radii.none,
                    backgroundColor: colors.primary,
                    elevation: 0,
                  }}
                >
                  <Text
                    size="sm"
                    bold
                    className="font-tabular"
                    style={{
                      color: colors.onPrimary,
                      fontFamily: fonts.mono,
                      fontVariant: ["tabular-nums"],
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </Box>

          <Text style={styles.label}>Custom amount</Text>
          <Box className="flex-row items-center justify-center gap-2">
            <NumberStepper
              value={customMl}
              onChangeText={setCustomMl}
              onSubmit={() => void handleAdd(Number(customMl) || 0)}
              step={50}
              accessibilityLabel="Water amount in ml"
              placeholder="200"
              style={{ flexGrow: 0 }}
            />
            <Pressable
              onPress={() => handleAdd(Number(customMl) || 0)}
              disabled={saving || !(Number(customMl) > 0)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Log custom water amount"
              className="h-10 items-center justify-center rounded-none border px-4"
              style={{
                backgroundColor: colors.primary,
                borderWidth: borders.width,
                borderColor: colors.primary,
                borderRadius: radii.none,
                opacity: saving || !(Number(customMl) > 0) ? 0.5 : 1,
                elevation: 0,
              }}
            >
              <Feather name="plus" size={18} color={colors.onPrimary} />
            </Pressable>
          </Box>

          {entries.length === 0 ? (
            <Box className="flex-1 items-center justify-center gap-2 py-10">
              <Box
                className="h-10 w-10 items-center justify-center rounded-none border"
                style={{
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderRadius: radii.none,
                  backgroundColor: colors.surfaceAlt,
                  elevation: 0,
                }}
              >
                <Feather name="droplet" size={20} color={colors.textMuted} />
              </Box>
              <Text
                size="xs"
                className="text-center text-typography-500"
                style={{
                  fontFamily: fonts.mono,
                  fontVariant: ["tabular-nums"],
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                Nothing logged for this day yet.
              </Text>
            </Box>
          ) : (
            <Box className="mt-4">
              <Text style={styles.label}>Logged pours</Text>
              {entries.map((entry) => (
                <Box
                  key={entry.id}
                  className="mb-1.5 flex-row items-center rounded-none border bg-background-50 px-3 py-2.5"
                  style={{
                    borderWidth: borders.width,
                    borderColor: colors.border,
                    borderRadius: radii.none,
                    backgroundColor: colors.surface,
                    elevation: 0,
                  }}
                >
                  <Feather name="droplet" size={14} color={colors.primary} />
                  <Text
                    size="sm"
                    bold
                    className="font-tabular ml-2 flex-1 text-typography-900"
                    style={{ fontFamily: fonts.mono, fontVariant: ["tabular-nums"] }}
                  >
                    {formatWaterAmount(entry.amount_ml, settings.units)}
                  </Text>
                  <Pressable
                    onPress={() => handleDelete(entry)}
                    hitSlop={8}
                    className="h-8 w-8 items-center justify-center rounded-none border"
                    style={{
                      backgroundColor: `${colors.danger}14`,
                      borderWidth: borders.width,
                      borderColor: colors.border,
                      borderRadius: radii.none,
                      elevation: 0,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${formatWaterAmount(entry.amount_ml, settings.units)} pour`}
                  >
                    <Feather name="trash-2" size={14} color={colors.danger} />
                  </Pressable>
                </Box>
              ))}
            </Box>
          )}
        </ScrollView>
      </View>

      <DatePickerModal
        visible={pickerOpen}
        dateKey={dateKey}
        onSelect={setDateKey}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )

  const rawBottom = insets.bottom
  const safeBottom = rawBottom

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === "web" ? "none" : "fade"}
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
        {isMedium ? (
          <View accessibilityViewIsModal={true} pointerEvents="box-none" style={shell.dialogWrap}>
            {form}
          </View>
        ) : (
          <KeyboardAvoidingView
            accessibilityViewIsModal={true}
            style={[
              shell.dialogWrap,
              {
                justifyContent: "flex-end",
                paddingBottom: safeBottom + 84,
              },
            ]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? safeBottom : 0}
          >
            {form}
          </KeyboardAvoidingView>
        )}

        <FabCluster
          bottomOffset={safeBottom + 16}
          left={
            <Fab icon="x" tone="surface" onPress={onClose} accessibilityLabel="Close water modal" />
          }
        />
      </View>
    </Modal>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    dialogBodyWide: {
      flexGrow: 0,
      flexBasis: "auto",
      maxHeight: "100%",
    },
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radii.none,
      padding: spacing.md,
      borderWidth: borders.width,
      borderColor: colors.border,
      elevation: 0,
    },
    pressed: {
      opacity: 0.7,
    },
    progressBg: {
      marginTop: spacing.sm,
      height: 6,
      width: "80%",
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      overflow: "hidden",
      elevation: 0,
    },
    progressFill: {
      height: "100%",
      borderRadius: radii.none,
    },
  })
