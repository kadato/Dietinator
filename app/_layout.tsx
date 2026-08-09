import { Stack, useRouter, useSegments } from "expo-router"
import Head from "expo-router/head"
import { useEffect, useMemo } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { AppErrorBoundary } from "@/components/AppErrorBoundary"
import { AppProvider, useApp } from "@/context/AppContext"
import { NetworkProvider } from "@/context/NetworkContext"
import { ToastProvider } from "@/context/ToastContext"
import { UpdateProvider } from "@/context/UpdateContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { useTheme } from "@/hooks/useTheme"
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
      </View>
    )
  }

  return (
    <>
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
        <Stack.Screen name="ai-chat" options={{ presentation: "modal" }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  useEffect(() => {
    // Once React has painted, swap the inlined pre-JS shell for the real app
    // and register the service worker for offline + instant repeat loads.
    hideWebShell()
    registerWebServiceWorker()
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
    <GluestackUIProvider mode={gluestackMode}>
      <NetworkProvider>
        <ToastProvider>
          <UpdateProvider>
            <RootNavigator />
          </UpdateProvider>
        </ToastProvider>
      </NetworkProvider>
    </GluestackUIProvider>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
  })
