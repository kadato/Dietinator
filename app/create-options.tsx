import { Pressable, ScrollView, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ModalContainer } from "@/components/ModalContainer"
import { Fab } from "@/components/Fab"
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
  iconColor: string
}

const OPTIONS: CreateOption[] = [
  {
    id: "quick-add",
    title: "Quick Add",
    description: "Track calories and nutrients without creating a new item",
    icon: "flash",
    iconColor: "#eab308",
  },
  {
    id: "manual-food",
    title: "New food without barcode",
    description: "Individual item (e.g. Bread roll)",
    icon: "nutrition",
    iconColor: "#f97316",
  },
  {
    id: "meal",
    title: "New meal",
    description: "Foods you often eat together (e.g. Cornflakes with milk)",
    icon: "restaurant",
    iconColor: "#14b8a6",
  },
]

export default function CreateOptionsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ meal?: string; date?: string }>()
  const mealType = (routeParam(params.meal) ?? "lunch") as MealType
  const date = routeParam(params.date) ?? toDateKey()
  const insets = useSafeAreaInsets()
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
          What would you like to create?
        </Text>

        <ScrollView className="flex-1" contentContainerClassName="px-4 pb-24 gap-2">
          {OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option)}
              accessibilityRole="button"
              accessibilityLabel={option.title}
            >
              <Card variant="outline" className="flex-row items-start gap-4 rounded-2xl p-4">
                <Box
                  className="h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${option.iconColor}22` }}
                >
                  <Ionicons name={option.icon} size={24} color={option.iconColor} />
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
          ))}
        </ScrollView>
      </ModalContainer>

      <View
        style={{
          position: "absolute",
          left: 20,
          bottom: insets.bottom + 16,
          pointerEvents: "box-none",
        }}
      >
        <Fab
          tone="surface"
          icon="close"
          onPress={() => router.back()}
          accessibilityLabel="Cancel"
        />
      </View>
    </View>
  )
}
