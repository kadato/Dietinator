import { Pressable, ScrollView, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ModalContainer } from "@/components/ModalContainer"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { useTheme } from "@/hooks/useTheme"
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
  const params = useLocalSearchParams<{ meal?: string; date?: string }>()
  const mealType = (routeParam(params.meal) ?? "lunch") as MealType
  const date = routeParam(params.date) ?? toDateKey()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  // A deep link straight to this modal has no screen to go back to.
  const safeBack = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/(tabs)")
    }
  }

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
    <View style={{ flex: 1 }}>
      <ModalContainer hug maxWidth={560} outerClassName="bg-background-50">
        <Text size="xl" bold className="mb-5 mt-5 px-6 text-typography-900">
          Create
        </Text>
        <Text size="sm" className="-mt-3 mb-4 px-6 text-typography-500">
          What would you like to create?
        </Text>

        <ScrollView className="flex-1" contentContainerClassName="px-4 pb-24 gap-2">
          {OPTIONS.map((option) => {
            const tint = optionColor(option.id, colors)
            return (
              <Pressable
                key={option.id}
                onPress={() => onSelect(option)}
                accessibilityRole="button"
                accessibilityLabel={option.title}
              >
                <Card variant="outline" className="flex-row items-start gap-4 rounded-2xl p-4">
                  <Box
                    className="h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: withAlpha(tint, 0.13) }}
                  >
                    <Ionicons name={option.icon} size={24} color={tint} />
                  </Box>
                  <Box className="flex-1">
                    <Text size="lg" bold className="mb-1 text-typography-900">
                      {option.title}
                    </Text>
                    <Text size="sm" className="leading-5 text-typography-500">
                      {option.description}
                    </Text>
                  </Box>
                </Card>
              </Pressable>
            )
          })}
        </ScrollView>
      </ModalContainer>

      <FabCluster
        bottomOffset={insets.bottom + 20}
        left={<Fab tone="surface" icon="close" onPress={safeBack} accessibilityLabel="Cancel" />}
      />
    </View>
  )
}
