import { useRef, useState } from "react"
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"

export type DropdownOption<T extends string> = {
  value: T
  label: string
  icon?: keyof typeof Ionicons.glyphMap
}

type Props<T extends string> = {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  title?: string
  accentColor?: string
  accessibilityLabel?: string
}

export function FilterDropdown<T extends string>({
  value,
  options,
  onChange,
  title,
  accentColor,
  accessibilityLabel,
}: Props<T>) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number }>({ top: 0 })
  const triggerRef = useRef<View>(null)
  const accent = accentColor ?? colors.primary

  const current = options.find((o) => o.value === value) ?? options[0]

  const handleOpen = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width
      // If trigger is on right half of screen, anchor right; else anchor left
      if (x + width / 2 > screenWidth / 2) {
        setCoords({
          top: y + height + 6,
          right: Math.max(screenWidth - (x + width), 16),
        })
      } else {
        setCoords({
          top: y + height + 6,
          left: Math.max(x, 16),
        })
      }
      setOpen(true)
    })
  }

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={handleOpen}
          hitSlop={6}
          style={[
            styles.trigger,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `${title ?? "Filter"}: ${current?.label}`}
        >
          {current?.icon ? <Ionicons name={current.icon} size={14} color={accent} /> : null}
          <Text style={[styles.triggerText, { color: colors.text }]}>{current?.label}</Text>
          <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.popover,
              {
                top: coords.top,
                ...(coords.left !== undefined ? { left: coords.left } : {}),
                ...(coords.right !== undefined ? { right: coords.right } : {}),
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  style={[styles.optionRow, isSelected && { backgroundColor: `${accent}18` }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.optionLeft}>
                    {opt.icon ? (
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={isSelected ? accent : colors.textMuted}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: isSelected ? accent : colors.text },
                        isSelected && { fontWeight: "700" },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  {isSelected ? <Ionicons name="checkmark" size={16} color={accent} /> : null}
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: "600",
  },
  popover: {
    position: "absolute",
    minWidth: 140,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    boxShadow: "0px 6px 20px rgba(0, 0, 0, 0.2)",
    elevation: 8,
    zIndex: 9999,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
})
