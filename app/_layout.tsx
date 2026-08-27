import {
  Stack,
  ThemeProvider as NavigationThemeProvider,
  useRouter,
  useSegments,
} from "expo-router"
import Head from "expo-router/head"
import { useEffect, useMemo, useState } from "react"
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
import { applyFontPatch } from "@/utils/font-patch"
import "../global.css"

import { AiChatModal } from "@/components/AiChatModal"

applyFontPatch()

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
      const demoSuffix =
        typeof window !== "undefined" &&
        typeof window.location !== "undefined" &&
        window.location?.search &&
        new URLSearchParams(window.location.search).get("demo") === "1"
          ? "?demo=1"
          : ""
      ;(router.replace as unknown as (path: string) => void)(`/login${demoSuffix}`)
    } else if (authenticated && inAuth) {
      router.replace("/(tabs)")
    }
  }, [ready, authenticated, segments, router])

  useEffect(() => {
    if (ready && fontsLoaded) {
      void SplashScreen.hideAsync().catch(() => undefined)
    }
  }, [ready, fontsLoaded])

  // Safety: if fonts never resolve (for example a bundled asset miss on a
  // release APK after a storage clear), still hide the native splash after
  // 4s. The JS loader continues to show the spinner but the OS splash
  // never looks frozen.
  useEffect(() => {
    const t = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined)
    }, 4000)
    return () => clearTimeout(t)
  }, [])

  // Unconditional escape: even if JS is stuck, never leave the OS splash
  // visible forever. After 6s force hide.
  useEffect(() => {
    const t = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined)
    }, 6000)
    return () => clearTimeout(t)
  }, [])

  // Also hide as soon as the app is ready even if fonts still load: the
  // fallback system monospace is readable, a frozen logo is not.
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => {
      if (!fontsLoaded) void SplashScreen.hideAsync().catch(() => undefined)
    }, 1200)
    return () => clearTimeout(t)
  }, [ready, fontsLoaded])

  const [forceShow, setForceShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 5500)
    return () => clearTimeout(t)
  }, [])

  if (!forceShow && (!ready || !fontsLoaded)) {
    return (
      <View style={styles.loading}>
        <LoadingSpinner size={32} />
      </View>
    )
  }

  // Don't block render on auth/segments – render the stack and let the
  // redirect effect handle it. Blocking here caused a dead lock when
  // segments was still [] on first frame and router.replace hadn't fired yet.
  // Keeping a spinner here forever looked like a frozen splash.

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

  // Top-level splash hide that runs even if AppProvider or RootNavigator
  // crashes. Previous hides were inside RootNavigator which never mounted
  // when the window.location bug crashed JS before navigation.
  useEffect(() => {
    const t1 = setTimeout(() => void SplashScreen.hideAsync().catch(() => undefined), 3500)
    const t2 = setTimeout(() => void SplashScreen.hideAsync().catch(() => undefined), 6000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
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
