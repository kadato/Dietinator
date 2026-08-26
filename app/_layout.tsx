import {
  Stack,
  ThemeProvider as NavigationThemeProvider,
  useRouter,
  useSegments,
} from "expo-router"
import Head from "expo-router/head"
import { useEffect, useMemo } from "react"
import { LogBox, Platform, StyleSheet, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { LoadingSpinner } from "@/components/LoadingSpinner"
import { AppErrorBoundary } from "@/components/AppErrorBoundary"
import { AppProvider, useApp } from "@/context/AppContext"
import { AiChatModalProvider } from "@/context/AiChatContext"
import { NetworkProvider } from "@/context/NetworkContext"
import { ToastProvider } from "@/context/ToastContext"
import { UpdateProvider } from "@/context/UpdateContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { useTheme } from "@/hooks/useTheme"
import { useBundledTerminalFont } from "@/utils/web-fonts"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { hideWebShell, registerWebServiceWorker } from "@/utils/web-shell"
import { fonts, type ColorPalette } from "@/theme"
import { GluestackUIProvider } from "@ui/gluestack-ui-provider"
import "../global.css"

import { AiChatModal } from "@/components/AiChatModal"

void SplashScreen.preventAutoHideAsync().catch(() => undefined)

// Module-level silencing: must run before first render so the initial
// mount does not flash warnings. The deprecation is intentional (style
// pointerEvents is dropped by css-interop on web, verified live). RN's
// LogBox only silences its own logger; React DOM warnings go to
// console.error directly, so patch that on web as well.
LogBox.ignoreLogs([
  "props.pointerEvents is deprecated",
  "React does not recognize the `accessibilityRole`",
  '"barcode-scan" is not a valid icon name',
])
if (Platform.OS === "web" && typeof window !== "undefined") {
  const origError = console.error
  const origWarn = console.warn
  const shouldSuppress = (args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ")
    return (
      text.includes("props.pointerEvents is deprecated") ||
      text.includes("accessibilityRole") ||
      text.includes("is not a valid icon name")
    )
  }

  console.error = (...args: unknown[]) => {
    if (shouldSuppress(args)) return
    origError(...(args as Parameters<typeof console.error>))
  }

  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args)) return
    origWarn(...(args as Parameters<typeof console.warn>))
  }
}

function RootNavigator() {
  const { ready, authenticated } = useApp()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const segments = useSegments()
  const router = useRouter()
  const fontsLoaded = useBundledTerminalFont()

  // React Navigation paints the screen container with its own theme. Without
  // this, the light DefaultTheme (background #f2f2f2) flashes behind the app
  // in dark mode during transitions/overscroll. Match it to the app palette.
  const navTheme = useMemo(
    () => ({
      dark: isDark,
      colors: {
        primary: colors.primary,
        background: "transparent",
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
      fonts: {
        regular: {
          fontFamily: fonts.mono,
          fontWeight: "400" as const,
        },
        medium: {
          fontFamily: fonts.mono,
          fontWeight: "500" as const,
        },
        bold: {
          fontFamily: fonts.mono,
          fontWeight: "700" as const,
        },
        heavy: {
          fontFamily: fonts.mono,
          fontWeight: "800" as const,
        },
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

  useEffect(() => {
    if (ready && fontsLoaded) {
      void SplashScreen.hideAsync().catch(() => undefined)
    }
  }, [ready, fontsLoaded])

  if (!ready || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <LoadingSpinner size={32} />
      </View>
    )
  }

  const inAuth = segments[0] === "login"
  if (!authenticated && !inAuth) {
    return (
      <View style={styles.loading}>
        <LoadingSpinner size={32} />
      </View>
    )
  }
  if (authenticated && inAuth) {
    return (
      <View style={styles.loading}>
        <LoadingSpinner size={32} />
      </View>
    )
  }

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}
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
        <title>Dietinator: calorie and macro tracker</title>
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
    <SafeAreaProvider>
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
    </SafeAreaProvider>
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
