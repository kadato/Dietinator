import { Modal, Pressable, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { withAlpha } from "@/utils/color"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import type { ColorPalette } from "@/theme"
import type { MealType } from "@/types"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { fonts } from "@/theme"

type CreateOption = {
  id: string
  title: string
  description: string
  icon: keyof typeof Feather.glyphMap
}

const OPTIONS: CreateOption[] = [
  {
    id: "quick-add",
    title: "Quick Add",
    description: "Log calories, no item saved",
    icon: "zap",
  },
  {
    id: "manual-food",
    title: "New food",
    description: "Single item without barcode",
    icon: "package",
  },
  {
    id: "meal",
    title: "New meal",
    description: "Foods you eat together",
    icon: "shopping-bag",
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
  useEscapeToClose(visible, onClose)
  const router = useRouter()
  const { colors } = useTheme()
  const { isMedium } = useLayout()
  const insets = useSafeAreaInsets()

  const onSelect = (option: CreateOption) => {
    onClose()
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
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: isMedium ? "center" : "flex-end",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingBottom: isMedium ? 20 : insets.bottom + 84,
        }}
      >
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss options"
        />
        <Box
          accessibilityViewIsModal={true}
          className="w-full max-w-[420px] self-center rounded-none border bg-background-50 p-5"
          style={{
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 0,
            backgroundColor: colors.surface,
            boxShadow: "none",
            elevation: 0,
          }}
        >
          <Box className="pb-3">
            <Text
              size="xl"
              bold
              className="text-typography-900"
              style={{
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              Create
            </Text>
            <Text
              size="xs"
              className="mt-0.5 text-typography-500"
              style={{
                fontFamily: fonts.mono,
                fontVariant: ["tabular-nums"],
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              What would you like to log or create?
            </Text>
          </Box>

          <Box className="gap-2.5 pt-1">
            {OPTIONS.map((option) => {
              const tint = optionColor(option.id, colors)
              return (
                <Pressable
                  key={option.id}
                  onPress={() => onSelect(option)}
                  accessibilityRole="button"
                  // No aria-label: the visible title + description is the
                  // accessible name, which satisfies 2.5.3 label-in-name.
                  style={[{ opacity: 1 }]}
                >
                  <Box
                    className="flex-row items-center gap-3.5 rounded-none border p-3.5"
                    style={{
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      borderRadius: 0,
                      backgroundColor: colors.surface,
                      boxShadow: "none",
                      elevation: 0,
                    }}
                  >
                    <Box
                      className="h-11 w-11 items-center justify-center rounded-none border"
                      style={{
                        backgroundColor: withAlpha(tint, 0.14),
                        borderWidth: 1.5,
                        borderColor: colors.border,
                        borderRadius: 0,
                        boxShadow: "none",
                        elevation: 0,
                      }}
                    >
                      <Feather name={option.icon} size={20} color={tint} />
                    </Box>
                    <Box className="flex-1">
                      <Text
                        size="md"
                        bold
                        className="text-typography-900"
                        style={{
                          fontFamily: fonts.mono,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                        }}
                      >
                        {option.title}
                      </Text>
                      <Text
                        size="xs"
                        className="mt-0.5 leading-4 text-typography-500"
                        style={{
                          fontFamily: fonts.mono,
                          fontVariant: ["tabular-nums"],
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                        }}
                      >
                        {option.description}
                      </Text>
                    </Box>
                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                  </Box>
                </Pressable>
              )
            })}
          </Box>
        </Box>

        <FabCluster
          bottomOffset={insets.bottom + 16}
          left={
            <Fab
              icon="x"
              tone="surface"
              onPress={onClose}
              accessibilityLabel="Close create options"
            />
          }
        />
      </View>
    </Modal>
  )
}
