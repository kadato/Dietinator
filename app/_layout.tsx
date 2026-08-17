import {
  Stack,
  ThemeProvider as NavigationThemeProvider,
  useRouter,
  useSegments,
} from "expo-router"
import Head from "expo-router/head"
import { useEffect, useMemo } from "react"
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { AppErrorBoundary } from "@/components/AppErrorBoundary"
import { AiChatModal } from "@/components/AiChatModal"
import { AppProvider, useApp } from "@/context/AppContext"
import { AiChatModalProvider } from "@/context/AiChatContext"
import { NetworkProvider } from "@/context/NetworkContext"
import { ToastProvider } from "@/context/ToastContext"
import { UpdateProvider } from "@/context/UpdateContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { useTheme } from "@/hooks/useTheme"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { hideWebShell, registerWebServiceWorker } from "@/utils/web-shell"
import type { ColorPalette } from "@/theme"
import { GluestackUIProvider } from "@ui/gluestack-ui-provider"
import "../global.css"

function RootNavigator() {
  const { ready, authenticated } = useApp()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const segments = useSegments()
  const router = useRouter()

  // React Navigation paints the screen container with its own theme. Without
  // this, the light DefaultTheme (background #f2f2f2) flashes behind the app
  // in dark mode during transitions/overscroll. Match it to the app palette.
  const navTheme = useMemo(
    () => ({
      dark: isDark,
      colors: {
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
      fonts: {
        regular: { fontFamily: "sans-serif", fontWeight: "400" as const },
        medium: { fontFamily: "sans-serif", fontWeight: "500" as const },
        bold: { fontFamily: "sans-serif", fontWeight: "700" as const },
        heavy: { fontFamily: "sans-serif", fontWeight: "800" as const },
      },
    }),
    [colors, isDark],
  )

  useEffect(() => {
    if (!ready) return
    const inAuth = segments[0] === "login"

    if (!authenticated && !inAuth) {
      router.replace("/login")
    } else if (authenticated && inAuth) {
      router.replace("/(tabs)")
    }
  }, [ready, authenticated, segments, router])

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Loading Dietinator"
        />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    )
  }

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="log-meal" options={{ presentation: "modal" }} />
        <Stack.Screen name="create-options" options={{ presentation: "modal" }} />
        <Stack.Screen name="manual-entry" options={{ presentation: "modal" }} />
        <Stack.Screen name="meal-builder" options={{ presentation: "modal" }} />
        <Stack.Screen name="scan" options={{ presentation: "modal" }} />
        <Stack.Screen name="add-food" options={{ presentation: "modal" }} />
      </Stack>
    </NavigationThemeProvider>
  )
}

export default function RootLayout() {
  useEffect(() => {
    // Once React has painted, swap the inlined pre-JS shell for the real app
    // and register the service worker for offline + instant repeat loads.
    hideWebShell()
    registerWebServiceWorker()
  }, [])

  // Presenting a modal marks the screen behind it aria-hidden. If the button
  // that opened the modal still holds focus, the browser blocks the attribute
  // ("Blocked aria-hidden on an element because its descendant retained
  // focus"). Blur the pressed button before the navigation commit so the
  // hidden screen never contains the focused element.
  useEffect(() => {
    if (Platform.OS !== "web") return
    const blurPressedButton = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (!target || !target.closest?.('button, [role="button"], a')) return
      ;(document.activeElement as HTMLElement | null)?.blur?.()
    }
    document.addEventListener("click", blurPressedButton, true)
    return () => document.removeEventListener("click", blurPressedButton, true)
  }, [])

  return (
    <>
      <Head>
        <title>Dietinator — Calorie & macro tracker</title>
        <meta
          name="description"
          content="Dietinator is a fast, ad-free calorie tracker that works offline. Log meals, track calories and macros, and search the YAZIO food database."
        />
      </Head>
      <AppErrorBoundary>
        <AppProvider>
          <ThemeProvider>
            <ThemedApp />
          </ThemeProvider>
        </AppProvider>
      </AppErrorBoundary>
    </>
  )
}

/**
 * Everything that renders themed UI. Lives inside ThemeProvider so the
 * gluestack mode and the status bar follow the user's explicit theme choice.
 */
function ThemedApp() {
  const { isDark } = useTheme()
  const gluestackMode = isDark ? "dark" : "light"

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GluestackUIProvider mode={gluestackMode}>
        <NetworkProvider>
          <ToastProvider>
            <UpdateProvider>
              <AiChatModalProvider>
                <RootNavigator />
                <AiChatModal />
              </AiChatModalProvider>
            </UpdateProvider>
          </ToastProvider>
        </NetworkProvider>
      </GluestackUIProvider>
    </GestureHandlerRootView>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textMuted,
    },
  })
