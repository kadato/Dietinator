import { useMemo, useState } from "react"
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { FOOD_DATABASE_COUNTRY_CODES } from "@/constants/food-database-countries"
import {
  getFoodDatabaseCountryLabel,
  normalizeFoodDatabaseCountry,
} from "@/utils/food-database-country"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { spacing, fonts, type ColorPalette } from "@/theme"

type CountryOption = { code: string; label: string }

type Props = {
  visible: boolean
  selectedCode: string
  onSelect: (code: string) => void
  onClose: () => void
}

export function FoodDatabaseCountryPicker({ visible, selectedCode, onSelect, onClose }: Props) {
  const styles = useThemedStyles(createStyles)
  const [filter, setFilter] = useState("")

  const options = useMemo((): CountryOption[] => {
    return FOOD_DATABASE_COUNTRY_CODES.map((code) => ({
      code,
      label: getFoodDatabaseCountryLabel(code),
    })).sort((a, b) => a.label.localeCompare(b.label, "en"))
  }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (item) => item.code.toLowerCase().includes(q) || item.label.toLowerCase().includes(q),
    )
  }, [filter, options])

  const normalizedSelected = normalizeFoodDatabaseCountry(selectedCode)

  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === "web" ? undefined : "slide"}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Food database country</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={[styles.closeBtn]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Feather name="x" size={22} color={styles.closeIcon.color} />
          </Pressable>
        </View>
        <Text style={styles.hint}>Search uses this country&apos;s YAZIO catalog.</Text>
        <TextInput
          style={styles.search}
          placeholder="Search country…"
          placeholderTextColor={styles.searchPlaceholder.color}
          value={filter}
          onChangeText={setFilter}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          enterKeyHint="search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const selected = item.code === normalizedSelected
            return (
              <Pressable
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => {
                  onSelect(item.code)
                  setFilter("")
                  onClose()
                }}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                  {item.label}
                </Text>
                {selected ? (
                  <Feather name="check" size={18} color={styles.checkmark.color} />
                ) : null}
              </Pressable>
            )
          }}
          ListEmptyComponent={<Text style={styles.empty}>No countries match your search.</Text>}
        />
      </View>
    </Modal>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
      borderRadius: 0,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    closeBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 0,
      backgroundColor: colors.surfaceAlt,
      boxShadow: "none",
      elevation: 0,
    },
    pressed: {
      opacity: 0.7,
    },
    closeIcon: { color: colors.text },
    hint: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: spacing.md,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    search: {
      backgroundColor: colors.surface,
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: spacing.sm,
      marginBottom: spacing.md,
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      boxShadow: "none",
      elevation: 0,
    },
    searchPlaceholder: { color: colors.textMuted },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: "transparent",
      marginBottom: 2,
      boxShadow: "none",
      elevation: 0,
    },
    rowSelected: {
      backgroundColor: `${colors.primary}10`,
      borderColor: colors.border,
    },
    rowLabel: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      letterSpacing: 0.2,
    },
    rowLabelSelected: {
      fontWeight: "700",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    checkmark: { color: colors.primary },
    empty: {
      textAlign: "center",
      color: colors.textMuted,
      marginTop: spacing.xl,
      fontSize: 14,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
  })
