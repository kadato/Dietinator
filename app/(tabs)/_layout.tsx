import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useLayout } from '@/hooks/useLayout';
import { layout, spacing } from '@/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  const { isWide } = useLayout();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarPosition: isWide ? 'left' : 'bottom',
        tabBarVariant: isWide ? 'material' : 'uikit',
        tabBarLabelPosition: isWide ? 'below-icon' : 'beside-icon',
        tabBarStyle: isWide
          ? {
              width: layout.sideTabWidth,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
              backgroundColor: colors.surface,
              borderTopWidth: 0,
              borderRightWidth: 1,
              borderRightColor: colors.border,
            }
          : {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
        tabBarItemStyle: isWide ? { paddingVertical: spacing.sm } : undefined,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
