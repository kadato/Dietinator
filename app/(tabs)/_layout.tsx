import type React from "react"
import { useState } from "react"
import { Tabs } from "expo-router"
import { Feather } from "@expo/vector-icons"
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
  const { isWide, width } = useLayout()
  const insets = useSafeAreaInsets()
  // Desktop affordance: the rail item's rule tints toward ink on hover.
  // Pressable's style callback has no hovered flag in core RN types, so the
  // rail tracks it via hover events (web-only, no-op on touch).
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null)

  const visibleRoutes = state.routes.filter((route: (typeof state.routes)[number]) => {
    const descriptor = descriptors[route.key]
    const options = descriptor?.options as
      { href?: string | null; tabBarItemStyle?: { display?: string } } | undefined
    // expo-router strips `href` from the options it passes to a custom tab bar
    // and marks hidden tabs via `tabBarItemStyle: { display: "none" }` instead
    // (TabsClient replaces href with a tabBarButton that renders null).
    const hiddenByHref = options?.href === null
    const hiddenByStyle = options?.tabBarItemStyle?.display === "none"
    return !hiddenByHref && !hiddenByStyle
  })

  if (isWide) {
    return (
      <View
        accessibilityRole="tablist"
        style={{
          width: 104,
          backgroundColor: colors.surface,
          borderRightWidth: 1,
          borderRightColor: colors.border,
          paddingTop: insets.top > 0 ? insets.top + 16 : 24,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24,
          paddingLeft: insets.left,
          paddingRight: insets.right > 0 ? 4 : 0,
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 10,
        }}
      >
        {/* Brand Icon, square terminal */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 0,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: withAlpha(colors.primary, 0.12),
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Feather name="package" size={24} color={colors.primary} />
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
              onHoverIn={() => setHoveredRoute(route.key)}
              onHoverOut={() => setHoveredRoute(null)}
              style={({ pressed }) => [
                {
                  width: 88,
                  paddingVertical: 10,
                  paddingHorizontal: 6,
                  borderRadius: 0,
                  borderWidth: isFocused || hoveredRoute === route.key ? 1.5 : 1,
                  borderColor:
                    isFocused || hoveredRoute === route.key ? colors.primary : colors.border,
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  backgroundColor: isFocused
                    ? colors.primary
                    : pressed
                      ? colors.surfaceAlt
                      : colors.surface,
                  cursor: "pointer",
                },
              ]}
            >
              {options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? colors.onPrimary : inactiveColor,
                size: 22,
              })}
              <Text
                size="xs"
                bold={isFocused}
                style={{
                  color: isFocused ? colors.onPrimary : inactiveColor,
                  marginTop: 2,
                  fontSize: 11,
                  letterSpacing: 0.04,
                  textAlign: "center",
                  textTransform: "uppercase",
                  alignSelf: "center",
                  width: "100%",
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

  // Mobile Bottom Tab Bar, a tight terminal dock. Below 640 the labels drop
  // entirely: icons carry the destinations, no loose text at small sizes.
  // Keep the bar short so it never covers content on 320-390px phones.
  const showLabels = width >= 640
  const compactBar = width < 380
  // Single source: theme.layout.tabBarHeight, so the constant cannot drift
  // from the real bar again. Compact phones get a shorter bar.
  const tabBarHeight = compactBar ? 48 : layout.tabBarHeight
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderTopWidth: 1.5,
        borderTopColor: colors.border,
        minHeight: tabBarHeight + insets.bottom,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        alignItems: "stretch",
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
            style={({ pressed }) => ({
              flex: 1,
              minHeight: tabBarHeight,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              paddingVertical: 3,
              backgroundColor: isFocused
                ? colors.primary
                : pressed
                  ? colors.surfaceAlt
                  : "transparent",
              borderWidth: 0,
              borderRadius: 0,
            })}
          >
            <View
              style={{
                width: 24,
                height: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? colors.onPrimary : inactiveColor,
                size: 18,
              })}
            </View>
            {showLabels ? (
              <Text
                size="2xs"
                bold={isFocused}
                style={{
                  color: isFocused ? colors.onPrimary : inactiveColor,
                  fontSize: 11,
                  lineHeight: 12,
                  letterSpacing: 0.08,
                  textTransform: "uppercase",
                  textAlign: "center",
                  width: "100%",
                }}
                numberOfLines={1}
              >
                {typeof label === "string" ? label : route.name}
              </Text>
            ) : null}
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
          tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
          href: settings.ai_enabled === 1 ? "/(tabs)/ai" : null,
          headerShown: false,
          tabBarAccessibilityLabel: "AI Assistant",
          tabBarIcon: ({ color, size }) => <Feather name="cpu" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          headerShown: false,
          tabBarAccessibilityLabel: "Stats",
          tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
          tabBarAccessibilityLabel: "Settings",
          tabBarIcon: ({ color, size }) => <Feather name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
