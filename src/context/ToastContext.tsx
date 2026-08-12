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
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { getErrorMessage } from "@/utils/error-message"
import { layout, spacing, type ColorPalette } from "@/theme"

export type ToastType = "success" | "error" | "info" | "warning"

export type ToastOptions = {
  type?: ToastType
  title?: string
  message: string
  duration?: number
}

type ToastState = ToastOptions & { id: number }

/** Undo offered as a floating button, not inside the toast. */
type UndoState = { id: number; message: string; onUndo: () => void }

type ToastContextValue = {
  showToast: (options: ToastOptions) => void
  showSuccess: (message: string, title?: string) => void
  showError: (error: unknown, fallback?: string, title?: string) => void
  showInfo: (message: string, title?: string) => void
  showWarning: (message: string, title?: string) => void
  /** Confirmation toast + an "Undo" FAB that auto-disappears after a while. */
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

  // Created once; the callbacks only touch stable state setters.
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
    translateY.setValue(-24)
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: NATIVE_DRIVER }),
    ]).start()

    const type = toast.type ?? "info"
    const duration = toast.duration ?? DEFAULT_DURATION[type]
    timerRef.current = setTimeout(dismiss, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast, opacity, translateX, translateY, dismiss])

  if (!toast) return null

  const type = toast.type ?? "info"
  const styles = createToastStyles(colors)
  const icon = toastIcon(type)

  return (
    <View
      style={[
        styles.host,
        { paddingTop: Platform.OS !== "web" ? insets.top + spacing.sm : spacing.sm },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.toast,
          toastAccent(type, colors),
          { opacity, transform: [{ translateX }, { translateY }] },
        ]}
      >
        <Pressable style={styles.row} onPress={dismiss} accessibilityRole="button">
          <Ionicons name={icon.name} size={22} color={icon.color} style={styles.icon} />
          <View style={styles.textWrap}>
            {toast.title ? <Text style={styles.title}>{toast.title}</Text> : null}
            <Text style={styles.message}>{toast.message}</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.closeBtn}
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </Animated.View>
    </View>
  )
}

/** Floating "Undo" button with a countdown bar — auto-disappears after UNDO_TTL_MS. */
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
  const { colors } = useTheme()
  const [opacity] = useState(() => new Animated.Value(0))
  const [translateY] = useState(() => new Animated.Value(12))
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

  // Runs once per undo instance — the FAB is keyed by undo id and remounts.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: NATIVE_DRIVER,
        bounciness: 0,
      }),
    ]).start()
    Animated.timing(progress, {
      toValue: 0,
      duration: UNDO_TTL_MS,
      useNativeDriver: false,
    }).start()
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

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  })

  return (
    <View
      style={[undoStyles.layer, { bottom: layout.tabBarHeight + insets.bottom + 24 }]}
      pointerEvents="box-none"
    >
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <Pressable
          style={[undoStyles.fab, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleUndo}
          accessibilityRole="button"
          accessibilityLabel="Undo"
        >
          <Ionicons name="arrow-undo" size={20} color={colors.primary} />
          <Text style={[undoStyles.label, { color: colors.text }]}>Undo</Text>
        </Pressable>
        <View style={[undoStyles.track, { backgroundColor: colors.surfaceAlt }]}>
          <Animated.View style={[undoStyles.fill, { backgroundColor: colors.primary, width }]} />
        </View>
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

function toastIcon(type: ToastType): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (type) {
    case "success":
      return { name: "checkmark-circle", color: "#22c55e" }
    case "error":
      return { name: "alert-circle", color: "#ef4444" }
    case "warning":
      return { name: "warning", color: "#f59e0b" }
    default:
      return { name: "information-circle", color: "#3b82f6" }
  }
}

function toastAccent(type: ToastType, colors: ColorPalette) {
  switch (type) {
    case "success":
      return { borderLeftColor: colors.primary }
    case "error":
      return { borderLeftColor: colors.danger }
    case "warning":
      return { borderLeftColor: colors.warning }
    default:
      return { borderLeftColor: colors.primaryMuted }
  }
}

const undoStyles = StyleSheet.create({
  layer: {
    position: "absolute",
    right: 20,
    alignItems: "flex-end",
    zIndex: 9999,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 6,
    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.32)",
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
  },
  track: {
    alignSelf: "stretch",
    marginTop: 6,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
})

const createToastStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    host: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      alignItems: "center",
      paddingHorizontal: spacing.md,
    },
    toast: {
      width: "100%",
      maxWidth: 480,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.15)",
      elevation: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      paddingRight: spacing.xl,
      gap: spacing.sm,
    },
    closeBtn: {
      position: "absolute",
      top: 0,
      right: spacing.sm,
      bottom: 0,
      justifyContent: "center",
      paddingHorizontal: spacing.xs,
    },
    icon: { flexShrink: 0 },
    textWrap: { flex: 1 },
    title: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 2,
    },
    message: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    undoLayer: {
      position: "absolute",
      right: 20,
      alignItems: "flex-end",
      zIndex: 9999,
    },
    undoFab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 6,
      boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.32)",
    },
    undoLabel: {
      fontSize: 15,
      fontWeight: "700",
    },
    undoTrack: {
      alignSelf: "stretch",
      marginTop: 6,
      height: 3,
      borderRadius: 2,
      overflow: "hidden",
      backgroundColor: colors.surfaceAlt,
    },
    undoFill: {
      height: "100%",
      borderRadius: 2,
    },
  })
