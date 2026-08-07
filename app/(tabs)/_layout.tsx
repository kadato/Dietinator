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
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textOnBackground,
        headerShown: !isWide,
        tabBarPosition: isWide ? 'left' : 'bottom',
        tabBarVariant: isWide ? 'material' : 'uikit',
        tabBarLabelPosition: isWide ? 'below-icon' : 'beside-icon',
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
              height: 64,
              paddingTop: 6,
              paddingBottom: 8,
              elevation: 12,
              boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.08)',
            },
        tabBarItemStyle: isWide
          ? { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, alignItems: 'center' }
          : undefined,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
