import { useMemo, useState } from "react"
import {
  Modal,
  Platform,
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  TextInput,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { FOOD_DATABASE_COUNTRY_CODES } from "@/constants/food-database-countries"
import {
  getFoodDatabaseCountryLabel,
  normalizeFoodDatabaseCountry,
} from "@/utils/food-database-country"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { spacing, type ColorPalette } from "@/theme"

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
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={28} color={styles.closeIcon.color} />
          </Pressable>
        </View>
        <Text style={styles.hint}>Product search uses this country&apos;s YAZIO food catalog.</Text>
        <TextInput
          style={styles.search}
          placeholder="Search country…"
          placeholderTextColor={styles.searchPlaceholder.color}
          value={filter}
          onChangeText={setFilter}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
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
              >
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                  {item.label}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark" size={22} color={styles.checkmark.color} />
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
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    closeIcon: { color: colors.text },
    hint: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: spacing.md,
    },
    search: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.sm,
      marginBottom: spacing.md,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchPlaceholder: { color: colors.textMuted },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: 8,
    },
    rowSelected: {
      backgroundColor: colors.surface,
    },
    rowLabel: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    rowLabelSelected: {
      fontWeight: "600",
      color: colors.primary,
    },
    checkmark: { color: colors.primary },
    empty: {
      textAlign: "center",
      color: colors.textMuted,
      marginTop: spacing.xl,
      fontSize: 15,
    },
  })
