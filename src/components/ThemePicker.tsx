import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { borders, fonts, radii, spacing } from "@/theme"
import { listThemes } from "@/theme/themes"
import type { ColorPalette } from "@/theme"

type Props = {
  visible: boolean
  selected: string
  onClose: () => void
  onSelect: (value: string) => void
}

function Swatch({ colors }: { colors: ColorPalette }) {
  return (
    <View style={swatchStyles.row}>
      <View
        style={[
          swatchStyles.dot,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      />
      <View
        style={[swatchStyles.dot, { backgroundColor: colors.surface, borderColor: colors.border }]}
      />
      <View
        style={[swatchStyles.dot, { backgroundColor: colors.primary, borderColor: colors.primary }]}
      />
      <View
        style={[swatchStyles.dot, { backgroundColor: colors.text, borderColor: colors.border }]}
      />
    </View>
  )
}

const swatchStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 3, alignItems: "center" },
  dot: {
    width: 14,
    height: 14,
    borderWidth: borders.widthThin,
    borderRadius: radii.none,
  },
})

export function ThemePicker({ visible, selected, onClose, onSelect }: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()

  // Group themes for the picker: System first, then Dietinator, then VSCode, etc.
  const all = [
    { name: "system", label: "System", group: "System", isDark: false, colors: colors } as any,
    ...listThemes(),
  ]
  // Build groups
  const grouped: Record<string, typeof all> = {}
  for (const t of all) {
    const g = (t as any).group ?? "Other"
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(t as any)
  }
  // Keep System at top
  const orderedGroups = Object.entries(grouped).sort(([a], [b]) => {
    if (a === "System") return -1
    if (b === "System") return 1
    if (a === "Dietinator") return -1
    if (b === "Dietinator") return 1
    return a.localeCompare(b)
  })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Choose theme</Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close theme picker"
              >
                <Feather name="x" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              VSCode-popular themes are preseeded. Tap to apply instantly.
            </Text>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {orderedGroups.map(([group, items]) => (
                <View key={group} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.toUpperCase()}</Text>
                  {items.map((t: any) => {
                    const isSelected = selected === t.name
                    const palette: ColorPalette | undefined = t.colors
                    return (
                      <Pressable
                        key={t.name}
                        onPress={() => {
                          onSelect(t.name)
                          onClose()
                        }}
                        style={[
                          styles.option,
                          isSelected && {
                            backgroundColor: colors.surfaceAlt,
                            borderColor: colors.primary,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`Select ${t.label} theme`}
                      >
                        <View style={styles.optionLeft}>
                          {palette ? <Swatch colors={palette} /> : null}
                          <View style={styles.optionTextWrap}>
                            <Text
                              style={[
                                styles.optionLabel,
                                { color: isSelected ? colors.primary : colors.text },
                                isSelected && { fontWeight: "700" },
                              ]}
                            >
                              {t.label}
                            </Text>
                            <Text style={styles.optionId}>{t.name}</Text>
                          </View>
                        </View>
                        {isSelected ? (
                          <Feather name="check" size={14} color={colors.primary} />
                        ) : null}
                      </Pressable>
                    )
                  })}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      maxHeight: "85%",
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: borders.width,
      borderColor: colors.border,
      borderRadius: radii.none,
      overflow: "hidden",
      maxHeight: "100%",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: borders.widthThin,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.06,
    },
    closeBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    subtitle: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      letterSpacing: 0.03,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    list: {
      maxHeight: 420,
    },
    listContent: {
      padding: spacing.sm,
      gap: spacing.sm,
      paddingBottom: spacing.lg,
    },
    group: {
      gap: 4,
    },
    groupLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      letterSpacing: 0.08,
      textTransform: "uppercase",
      marginTop: spacing.sm,
      marginBottom: 2,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderWidth: borders.width,
      borderColor: colors.border,
      borderRadius: radii.none,
      backgroundColor: colors.surface,
      gap: 8,
    },
    optionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    optionTextWrap: {
      flex: 1,
      gap: 2,
    },
    optionLabel: {
      fontSize: 12,
      fontWeight: "600",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
    },
    optionId: {
      fontSize: 10,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      letterSpacing: 0.03,
    },
  })
