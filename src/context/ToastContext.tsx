import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { Fab } from "@/components/Fab"
import { useTheme } from "@/hooks/useTheme"
import { getErrorMessage } from "@/utils/error-message"
import { mixColors } from "@/utils/color"
import { spacing, fonts, type ColorPalette } from "@/theme"

export type ToastType = "success" | "error" | "info" | "warning"

export type ToastOptions = {
  type?: ToastType
  title?: string
  message: string
  duration?: number
}

type ToastState = ToastOptions & { id: number }

type UndoState = { id: number; message: string; onUndo: () => void }

type ToastContextValue = {
  showToast: (options: ToastOptions) => void
  showSuccess: (message: string, title?: string) => void
  showError: (error: unknown, fallback?: string, title?: string) => void
  showInfo: (message: string, title?: string) => void
  showWarning: (message: string, title?: string) => void
  showUndo: (message: string, onUndo: () => void) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 2600,
  info: 2800,
  warning: 3200,
  error: 4000,
}

const UNDO_TTL_MS = 6000
const SWIPE_DISMISS_DX = 64
const NATIVE_DRIVER = Platform.OS !== "web"

function ToastHost({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [opacity] = useState(() => new Animated.Value(0))
  const [translateY] = useState(() => new Animated.Value(-24))
  const [translateX] = useState(() => new Animated.Value(0))
  const [progress] = useState(() => new Animated.Value(1))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) onDismiss()
    })
  }, [opacity, onDismiss])

  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => translateX.setValue(gesture.dx),
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) > SWIPE_DISMISS_DX) {
          Animated.timing(translateX, {
            toValue: gesture.dx > 0 ? 480 : -480,
            duration: 160,
            useNativeDriver: NATIVE_DRIVER,
          }).start(({ finished }) => {
            if (finished) onDismiss()
          })
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: NATIVE_DRIVER,
            bounciness: 0,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: NATIVE_DRIVER,
          bounciness: 0,
        }).start()
      },
    }),
  )

  useEffect(() => {
    if (!toast) return

    translateX.setValue(0)
    opacity.setValue(0)
    // Android hosts feedback at the bottom (Material convention), so it
    // rises into place. Other platforms drop from the top.
    translateY.setValue(Platform.OS === "android" ? 24 : -24)
    progress.setValue(1)
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: NATIVE_DRIVER }),
    ]).start()

    const type = toast.type ?? "info"
    const duration = toast.duration ?? DEFAULT_DURATION[type]
    Animated.timing(progress, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start()
    timerRef.current = setTimeout(dismiss, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast, opacity, translateX, translateY, progress, dismiss])

  if (!toast) return null

  const type = toast.type ?? "info"
  const palette = toastPalette(type, colors)
  const icon = toastIcon(type)
  const styles = createToastStyles(colors)
  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  })

  return (
    <View
      style={[
        styles.host,
        Platform.OS === "android"
          ? { bottom: 0, paddingBottom: insets.bottom + spacing.md }
          : { paddingTop: Platform.OS !== "web" ? insets.top + spacing.md : spacing.md },
        { pointerEvents: "box-none" as const },
      ]}
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.toast,
          { backgroundColor: palette.bg, borderColor: palette.border },
          { opacity, transform: [{ translateX }, { translateY }] },
        ]}
      >
        <Pressable
          style={styles.row}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <View
            style={[styles.iconChip, { backgroundColor: palette.chip, borderColor: colors.border }]}
          >
            <Feather name={icon} size={18} color={palette.tint} />
          </View>
          <View style={styles.textWrap}>
            {toast.title ? <Text style={styles.title}>{toast.title}</Text> : null}
            <Text style={styles.message}>{toast.message}</Text>
          </View>
          <Feather name="x" size={14} color={colors.textMuted} style={styles.closeIcon as any} />
        </Pressable>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { backgroundColor: palette.tint, width: barWidth }]}
          />
        </View>
      </Animated.View>
    </View>
  )
}

function UndoFab({
  undo,
  onUndo,
  onDismiss,
}: {
  undo: UndoState
  onUndo: () => void
  onDismiss: () => void
}) {
  const insets = useSafeAreaInsets()
  const [opacity] = useState(() => new Animated.Value(0))
  const [translateY] = useState(() => new Animated.Value(12))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) onDismiss()
    })
  }, [opacity, onDismiss])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: NATIVE_DRIVER,
        bounciness: 0,
      }),
    ]).start()
    timerRef.current = setTimeout(dismiss, UNDO_TTL_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUndo = () => {
    undo.onUndo()
    dismiss()
  }

  return (
    <View
      style={[
        undoStyles.layer,
        { bottom: insets.bottom + 88 },
        { pointerEvents: "box-none" as const },
      ]}
    >
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        {/* Recovery is constructive: ink fill with a labeled action, never
            the destructive danger tone. The message lives in the toast
            above; this chip is the action itself. */}
        <Fab
          icon="rotate-ccw"
          label="Undo"
          size="sm"
          onPress={handleUndo}
          accessibilityLabel="Undo last change"
        />
      </Animated.View>
    </View>
  )
}
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [undo, setUndo] = useState<UndoState | null>(null)
  const toastIdRef = useRef(0)
  const undoIdRef = useRef(0)

  const showToast = useCallback((options: ToastOptions) => {
    toastIdRef.current += 1
    setToast({ ...options, id: toastIdRef.current })
  }, [])

  const showSuccess = useCallback(
    (message: string, title?: string) => showToast({ type: "success", message, title }),
    [showToast],
  )

  const showError = useCallback(
    (error: unknown, fallback?: string, title?: string) =>
      showToast({
        type: "error",
        title: title ?? "Error",
        message: getErrorMessage(error, fallback),
      }),
    [showToast],
  )

  const showInfo = useCallback(
    (message: string, title?: string) => showToast({ type: "info", message, title }),
    [showToast],
  )

  const showWarning = useCallback(
    (message: string, title?: string) => showToast({ type: "warning", message, title }),
    [showToast],
  )

  const showUndo = useCallback((message: string, onUndo: () => void) => {
    undoIdRef.current += 1
    setToast({ id: undoIdRef.current, type: "success", message })
    setUndo({ id: undoIdRef.current, message, onUndo })
  }, [])

  const value = useMemo(
    () => ({ showToast, showSuccess, showError, showInfo, showWarning, showUndo }),
    [showToast, showSuccess, showError, showInfo, showWarning, showUndo],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
      {undo ? (
        <UndoFab
          key={undo.id}
          undo={undo}
          onUndo={() => setUndo(null)}
          onDismiss={() => setUndo(null)}
        />
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

function toastIcon(type: ToastType): keyof typeof Feather.glyphMap {
  switch (type) {
    case "success":
      return "check-circle"
    case "error":
      return "alert-circle"
    case "warning":
      return "alert-triangle"
    default:
      return "info"
  }
}

function toastPalette(type: ToastType, colors: ColorPalette) {
  const tint =
    type === "success"
      ? colors.primary
      : type === "error"
        ? colors.danger
        : type === "warning"
          ? colors.warning
          : colors.primary
  return {
    tint,
    chip: `${tint}14`,
    border: colors.border,
    bg: mixColors(colors.surface, tint, 0.08),
  }
}

const undoStyles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 20,
    alignItems: "flex-start",
    zIndex: 9999,
    pointerEvents: "box-none",
  },
})

const createToastStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    host: {
      position: "absolute",
      left: 0,
      right: 0,
      zIndex: 9999,
      alignItems: "center",
      paddingHorizontal: spacing.md,
      pointerEvents: "box-none",
    },
    toast: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 0,
      borderWidth: 1.5,
      overflow: "hidden",
      boxShadow: "none",
      elevation: 0,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      paddingRight: spacing.md + spacing.xs,
      gap: spacing.sm + 2,
    },
    iconChip: {
      width: 34,
      height: 34,
      borderRadius: 0,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      boxShadow: "none",
      elevation: 0,
    },
    closeIcon: { flexShrink: 0 },
    textWrap: { flex: 1, gap: 2 },
    title: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    message: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: fonts.mono,
      letterSpacing: 0.2,
    },
    progressTrack: {
      height: 3,
      backgroundColor: colors.surfaceAlt,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    progressFill: {
      height: "100%",
    },
  })
