import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { TextStyle } from "react-native"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { layout, spacing } from "@/theme"

export default function TabLayout() {
  const { colors } = useTheme()
  const { isWide, width } = useLayout()
  const insets = useSafeAreaInsets()
  // Bottom tab bars never show titles — labels squeeze the icons and clip
  // out of the fixed-height bar. Only the wide sidebar rail keeps labels,
  // where there is room. Titles stay available to screen readers via
  // tabBarAccessibilityLabel.
  const showTabLabels = isWide

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textOnBackground,
        headerShown: !isWide,
        tabBarPosition: isWide ? "left" : "bottom",
        tabBarVariant: isWide ? "material" : "uikit",
        // Icons only on the bottom bar; the wide rail keeps labels.
        tabBarShowLabel: showTabLabels,
        tabBarLabelPosition: isWide ? "below-icon" : "below-icon",
        tabBarStyle: isWide
          ? {
              width: layout.sideTabWidth,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
              backgroundColor: colors.background,
              borderTopWidth: 0,
              borderRightWidth: 1,
              borderRightColor: colors.border,
            }
          : {
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              // Fixed height would drop react-navigation's automatic bottom
              // inset — add the home-indicator inset explicitly so icons never
              // sit under it on large-inset devices.
              height: layout.tabBarHeight + insets.bottom,
              paddingTop: 6,
              paddingBottom: insets.bottom + 8,
            },
        tabBarItemStyle: isWide
          ? { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, alignItems: "center" }
          : { paddingHorizontal: width < 360 ? 4 : 8 },
        tabBarActiveTintColor: isWide ? colors.primaryStrong : colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: [
          { fontSize: 10, fontWeight: "600", marginTop: 2 },
          // Cap system font scaling so a tall label never clips out of the
          // fixed-height bar on Android (runtime prop, not in the TextStyle type).
          { maxFontSizeMultiplier: 1.25 } as TextStyle,
        ],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          headerShown: false,
          tabBarAccessibilityLabel: "Today",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "today" : "today-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          headerShown: false,
          tabBarAccessibilityLabel: "Search",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "search" : "search-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: "Meals",
          headerShown: false,
          tabBarAccessibilityLabel: "Meals",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "restaurant" : "restaurant-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          headerShown: false,
          tabBarAccessibilityLabel: "Stats",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "stats-chart" : "stats-chart-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
          tabBarAccessibilityLabel: "Settings",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "settings" : "settings-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
