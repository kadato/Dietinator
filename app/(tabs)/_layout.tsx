import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { layout, spacing } from "@/theme"

export default function TabLayout() {
  const { colors } = useTheme()
  const { isWide, isMedium, width } = useLayout()
  const insets = useSafeAreaInsets()
  // Below 360px a "beside-icon" label row truncates even short labels.
  const narrowPhone = width < 360

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textOnBackground,
        headerShown: !isWide,
        tabBarPosition: isWide ? "left" : "bottom",
        tabBarVariant: isWide ? "material" : "uikit",
        tabBarLabelPosition: isWide || narrowPhone ? "below-icon" : "beside-icon",
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
              borderTopWidth: 0,
              // Fixed height would drop react-navigation's automatic bottom
              // inset — add the home-indicator inset explicitly so icons never
              // sit under it on large-inset devices.
              height: layout.tabBarHeight + insets.bottom,
              paddingTop: 6,
              paddingBottom: insets.bottom + 8,
              elevation: 12,
              boxShadow: "0px -2px 8px rgba(0, 0, 0, 0.08)",
            },
        tabBarItemStyle: isWide
          ? { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, alignItems: "center" }
          : { paddingHorizontal: narrowPhone ? 4 : 8 },
        tabBarActiveTintColor: isWide ? colors.primaryStrong : colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // At phone widths an 11px "Settings" label truncates inside its tab.
        tabBarLabelStyle: { fontSize: isMedium ? 11 : 10, fontWeight: "600", marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: "Meals",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          headerShown: false,
          tabBarAccessibilityLabel: "Stats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
