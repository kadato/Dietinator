import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from '@/context/AppContext';
import { ToastProvider } from '@/context/ToastContext';
import { useTheme } from '@/hooks/useTheme';
import type { ColorPalette } from '@/theme';
import { GluestackUIProvider } from '@ui/gluestack-ui-provider';
import '../global.css';

function RootNavigator() {
  const { ready, authenticated } = useApp();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === 'login';

    if (!authenticated && !inAuth) {
      router.replace('/login');
    } else if (authenticated && inAuth) {
      router.replace('/(tabs)');
    }
  }, [ready, authenticated, segments, router]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="log-meal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="create-options" options={{ presentation: 'modal' }} />
        <Stack.Screen name="manual-entry" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-food" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const gluestackMode = colorScheme === 'light' ? 'light' : 'dark';

  return (
    <GluestackUIProvider mode={gluestackMode}>
      <AppProvider>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </AppProvider>
    </GluestackUIProvider>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
