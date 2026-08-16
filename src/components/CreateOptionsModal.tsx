import { Modal, Pressable, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useTheme } from "@/hooks/useTheme"
import { withAlpha } from "@/utils/color"
import type { ColorPalette } from "@/theme"
import type { MealType } from "@/types"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Card } from "@ui/card"

type CreateOption = {
  id: string
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
}

const OPTIONS: CreateOption[] = [
  {
    id: "quick-add",
    title: "Quick Add",
    description: "Log calories, no item saved",
    icon: "flash",
  },
  {
    id: "manual-food",
    title: "New food",
    description: "Single item without barcode",
    icon: "nutrition",
  },
  {
    id: "meal",
    title: "New meal",
    description: "Foods you eat together",
    icon: "restaurant",
  },
]

function optionColor(id: CreateOption["id"], colors: ColorPalette): string {
  switch (id) {
    case "quick-add":
      return colors.warning
    case "manual-food":
      return colors.lunch
    case "meal":
      return colors.primary
  }
  return colors.primary
}

type Props = {
  visible: boolean
  mealType: MealType
  date: string
  onClose: () => void
}

export function CreateOptionsModal({ visible, mealType, date, onClose }: Props) {
  const router = useRouter()
  const { colors } = useTheme()

  const onSelect = (option: CreateOption) => {
    onClose()
    setTimeout(() => {
      switch (option.id) {
        case "meal":
          router.push({ pathname: "/meal-builder" })
          break
        case "manual-food":
        case "quick-add":
          router.push({
            pathname: "/manual-entry",
            params: { meal: mealType, date, quickAdd: option.id === "quick-add" ? "1" : "0" },
          })
          break
      }
    }, 60)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss options"
        />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
            pointerEvents: "box-none",
          }}
        >
          <Box className="w-full max-w-[420px] self-center rounded-3xl bg-background-50 p-5 shadow-soft-2">
            <Box className="flex-row items-center justify-between pb-3">
              <Box>
                <Text size="xl" bold className="text-typography-900">
                  Create
                </Text>
                <Text size="xs" className="mt-0.5 text-typography-500">
                  What would you like to log or create?
                </Text>
              </Box>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-full bg-background-100 active:bg-background-200"
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </Box>

            <Box className="gap-2.5 pt-1">
              {OPTIONS.map((option) => {
                const tint = optionColor(option.id, colors)
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => onSelect(option)}
                    accessibilityRole="button"
                    accessibilityLabel={option.title}
                  >
                    <Card
                      variant="outline"
                      className="flex-row items-center gap-3.5 rounded-2xl p-3.5 active:opacity-80"
                    >
                      <Box
                        className="h-11 w-11 items-center justify-center rounded-xl"
                        style={{ backgroundColor: withAlpha(tint, 0.14) }}
                      >
                        <Ionicons name={option.icon} size={22} color={tint} />
                      </Box>
                      <Box className="flex-1">
                        <Text size="md" bold className="text-typography-900">
                          {option.title}
                        </Text>
                        <Text size="xs" className="mt-0.5 leading-4 text-typography-500">
                          {option.description}
                        </Text>
                      </Box>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Card>
                  </Pressable>
                )
              })}
            </Box>
          </Box>
        </View>
      </View>
    </Modal>
  )
}
