import type React from "react"
import { Tabs } from "expo-router"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Pressable, View } from "react-native"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { useApp } from "@/context/AppContext"
import { withAlpha } from "@/utils/color"
import { layout } from "@/theme"
import { Text } from "@ui/text"

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0]

function AppTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const insets = useSafeAreaInsets()

  const visibleRoutes = state.routes.filter((route: (typeof state.routes)[number]) => {
    const descriptor = descriptors[route.key]
    const href = (descriptor?.options as { href?: string | null } | undefined)?.href
    return href !== null
  })

  if (isWide) {
    return (
      <View
        style={{
          width: 104,
          backgroundColor: colors.surface,
          borderRightWidth: 1,
          borderRightColor: colors.border,
          paddingTop: insets.top > 0 ? insets.top + 16 : 24,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24,
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 10,
        }}
      >
        {/* Brand Icon */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: withAlpha(colors.primary, 0.12),
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Ionicons name="nutrition" size={24} color={colors.primary} />
        </View>

        {/* Tab Items */}
        {visibleRoutes.map((route: (typeof state.routes)[number]) => {
          const { options } = descriptors[route.key]
          const isFocused = state.routes[state.index]?.key === route.key
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            })

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params)
            }
          }

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            })
          }

          const activeColor = colors.primary
          const inactiveColor = colors.textMuted

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={
                options.tabBarAccessibilityLabel ?? (typeof label === "string" ? label : route.name)
              }
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                {
                  width: 80,
                  paddingVertical: 10,
                  paddingHorizontal: 4,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isFocused
                    ? withAlpha(colors.primary, 0.14)
                    : pressed
                      ? withAlpha(colors.text, 0.05)
                      : "transparent",
                  cursor: "pointer",
                },
              ]}
            >
              {options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? activeColor : inactiveColor,
                size: 24,
              })}
              <Text
                size="xs"
                bold={isFocused}
                style={{
                  color: isFocused ? activeColor : inactiveColor,
                  marginTop: 4,
                  fontSize: 11,
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {typeof label === "string" ? label : route.name}
              </Text>
            </Pressable>
          )
        })}
      </View>
    )
  }

  // Mobile Bottom Tab Bar
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        height: layout.tabBarHeight + insets.bottom,
        paddingTop: 6,
        paddingBottom: insets.bottom + 8,
        alignItems: "center",
        justifyContent: "space-around",
      }}
    >
      {visibleRoutes.map((route: (typeof state.routes)[number]) => {
        const { options } = descriptors[route.key]
        const isFocused = state.routes[state.index]?.key === route.key
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          })

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params)
          }
        }

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          })
        }

        const activeColor = colors.primary
        const inactiveColor = colors.textMuted

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={
              options.tabBarAccessibilityLabel ?? (typeof label === "string" ? label : route.name)
            }
            onPress={onPress}
            onLongPress={onLongPress}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 8,
            }}
          >
            {options.tabBarIcon?.({
              focused: isFocused,
              color: isFocused ? activeColor : inactiveColor,
              size: 24,
            })}
          </Pressable>
        )
      })}
    </View>
  )
}

export default function TabLayout() {
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const { settings } = useApp()

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textOnBackground,
        headerShown: !isWide,
        tabBarPosition: isWide ? "left" : "bottom",
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
        name="ai"
        options={{
          title: "AI",
          href: settings.ai_enabled === 1 ? "/(tabs)/ai" : null,
          headerShown: false,
          tabBarAccessibilityLabel: "AI Assistant",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "robot" : "robot-outline"}
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
