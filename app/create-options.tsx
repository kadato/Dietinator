import { Pressable, ScrollView, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ModalContainer } from "@/components/ModalContainer"
import { useTheme } from "@/hooks/useTheme"
import { useSafeBack } from "@/hooks/useSafeBack"
import { withAlpha } from "@/utils/color"
import type { ColorPalette } from "@/theme"
import type { MealType } from "@/types"
import { toDateKey } from "@/utils/date"
import { routeParam } from "@/utils/route"
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

/** Each create option carries its own accent color from the app's palette. */
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

export default function CreateOptionsScreen() {
  const router = useRouter()
  const safeBack = useSafeBack()
  const params = useLocalSearchParams<{ meal?: string; date?: string }>()
  const mealType = (routeParam(params.meal) ?? "lunch") as MealType
  const date = routeParam(params.date) ?? toDateKey()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const onSelect = (option: CreateOption) => {
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
      default:
        break
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ModalContainer hug maxWidth={560} outerClassName="bg-background-50">
        <Box
          className="flex-row items-center justify-between px-6 pb-2"
          style={{ paddingTop: insets.top > 0 ? insets.top + 8 : 20 }}
        >
          <Box>
            <Text size="2xl" bold className="text-typography-900">
              Create
            </Text>
            <Text size="sm" className="mt-0.5 text-typography-500">
              What would you like to log or create?
            </Text>
          </Box>
          <Pressable
            onPress={safeBack}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-background-100 active:bg-background-200"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </Box>

        <ScrollView className="flex-1" contentContainerClassName="px-4 py-3 gap-3 pb-16">
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
                  className="flex-row items-center gap-4 rounded-2xl p-4 active:opacity-80"
                >
                  <Box
                    className="h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: withAlpha(tint, 0.13) }}
                  >
                    <Ionicons name={option.icon} size={24} color={tint} />
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
        </ScrollView>
      </ModalContainer>
    </View>
  )
}
