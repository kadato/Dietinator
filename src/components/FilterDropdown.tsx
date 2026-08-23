import { useEffect, useRef, useState } from "react"
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { fonts } from "@/theme"

export type DropdownOption<T extends string> = {
  value: T
  label: string
  icon?: keyof typeof Feather.glyphMap
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

  // A popover measured against one window geometry goes stale on rotation
  // or Split View resize; closing beats anchoring into space.
  useEffect(() => {
    if (!open) return
    const sub = Dimensions.addEventListener("change", () => setOpen(false))
    return () => sub.remove()
  }, [open])

  const handleOpen = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width
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
          style={({ pressed }) => [
            styles.trigger,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            pressed && styles.triggerPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `${title ?? "Filter"}: ${current?.label}`}
        >
          {current?.icon ? <Feather name={current.icon} size={12} color={accent} /> : null}
          <Text style={[styles.triggerText, { color: colors.text }]}>{current?.label}</Text>
          <Feather name="chevron-down" size={12} color={colors.textMuted} />
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
                  style={({ pressed }) => [
                    styles.optionRow,
                    isSelected && { backgroundColor: `${accent}14`, borderColor: accent },
                    pressed && styles.optionPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.optionLeft}>
                    {opt.icon ? (
                      <Feather
                        name={opt.icon}
                        size={14}
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
                  {isSelected ? <Feather name="check" size={14} color={accent} /> : null}
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
    borderRadius: 0,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    boxShadow: "none",
    elevation: 0,
  },
  triggerPressed: {
    opacity: 0.7,
  },
  triggerText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  popover: {
    position: "absolute",
    minWidth: 140,
    borderRadius: 0,
    borderWidth: 1.5,
    padding: 4,
    boxShadow: "none",
    elevation: 0,
    zIndex: 9999,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: 8,
    boxShadow: "none",
    elevation: 0,
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
})
