import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { getErrorMessage } from "@/utils/error-message"
import { spacing, type ColorPalette } from "@/theme"

export type ToastType = "success" | "error" | "info" | "warning"

export type ToastOptions = {
  type?: ToastType
  title?: string
  message: string
  duration?: number
}

type ToastState = ToastOptions & { id: number }

type ToastContextValue = {
  showToast: (options: ToastOptions) => void
  showSuccess: (message: string, title?: string) => void
  showError: (error: unknown, fallback?: string, title?: string) => void
  showInfo: (message: string, title?: string) => void
  showWarning: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 2600,
  info: 2800,
  warning: 3200,
  error: 4000,
}

function ToastHost({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [opacity] = useState(() => new Animated.Value(0))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (finished) onDismiss()
    })
  }, [opacity, onDismiss])

  useEffect(() => {
    if (!toast) return

    opacity.setValue(1)
    Animated.timing(opacity, {
      toValue: 1,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start()

    const type = toast.type ?? "info"
    const duration = toast.duration ?? DEFAULT_DURATION[type]
    timerRef.current = setTimeout(dismiss, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast, opacity, dismiss])

  if (!toast) return null

  const type = toast.type ?? "info"
  const styles = createToastStyles(colors)
  const icon = toastIcon(type)

  return (
    <View
      style={[
        Platform.OS === "web" ? styles.hostBottom : styles.host,
        Platform.OS !== "web" ? { paddingTop: insets.top + spacing.sm } : undefined,
        { pointerEvents: "box-none" },
      ]}
    >
      <Animated.View style={[styles.toast, toastAccent(type, colors), { opacity }]}>
        <Pressable style={styles.row} onPress={dismiss} accessibilityRole="button">
          <Ionicons name={icon.name} size={22} color={icon.color} style={styles.icon} />
          <View style={styles.textWrap}>
            {toast.title ? <Text style={styles.title}>{toast.title}</Text> : null}
            <Text style={styles.message}>{toast.message}</Text>
          </View>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </Animated.View>
    </View>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const idRef = useRef(0)

  const showToast = useCallback((options: ToastOptions) => {
    idRef.current += 1
    setToast({ ...options, id: idRef.current })
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

  const value = useMemo(
    () => ({ showToast, showSuccess, showError, showInfo, showWarning }),
    [showToast, showSuccess, showError, showInfo, showWarning],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
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
    hostBottom: {
      position: "absolute",
      bottom: spacing.lg,
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
      gap: spacing.sm,
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
  })
