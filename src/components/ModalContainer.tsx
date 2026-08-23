import { useEffect } from "react"
import type { ReactNode } from "react"
import { Platform, Pressable } from "react-native"
import { Box } from "@ui/box"
import { useLayout } from "@/hooks/useLayout"
import { useTheme } from "@/hooks/useTheme"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"
import { useSafeBack } from "@/hooks/useSafeBack"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type Props = {
  children: ReactNode
  /**
   * Max width of the dialog column on wide screens.
   * On phones the container is full width.
   */
  maxWidth?: number
  /**
   * When true the dialog hugs its content height instead of filling the
   * viewport. Use for short forms (for examplemanual entry, create options).
   */
  hug?: boolean
  /** Give the inner column the app's surface color on phones too (full-bleed). */
  surface?: boolean
  /** Extra classes for the phone (full-width) wrapper. */
  outerClassName?: string
  /** Called when backdrop or Escape is pressed. Defaults to safeBack. */
  onDismiss?: () => void
  /** Set false to disable backdrop/Escape dismiss. */
  dismissable?: boolean
}

/**
 * Full-screen modal shell. On phones it is plain full width; on wide
 * (desktop / big screen) viewports the content becomes a centered dialog
 * column: square sheet, 1.5px ink rule, no shadow (Field Terminal depth is
 * rule weight and invert, never lift).
 */
export function ModalContainer({
  children,
  maxWidth = 640,
  hug = false,
  surface = false,
  outerClassName,
  onDismiss,
  dismissable = true,
}: Props) {
  const { isWide } = useLayout()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const safeBack = useSafeBack()
  const handleDismiss = onDismiss ?? safeBack

  // The screen behind a presented modal is marked aria-hidden by the
  // navigator, but the button that opened the modal keeps focus. The browser
  // then blocks the aria-hidden attribute ("Blocked aria-hidden on an element
  // because its descendant retained focus"). Blur before that happens.
  useEffect(() => {
    if (Platform.OS !== "web") return
    const active = document.activeElement as HTMLElement | null
    active?.blur?.()
  }, [])

  useEscapeToClose(dismissable, handleDismiss)

  if (!isWide) {
    return (
      <Box
        className={`w-full ${hug ? "" : "flex-1"} ${outerClassName ?? ""}`}
        style={[
          surface ? { backgroundColor: colors.surface } : undefined,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {children}
      </Box>
    )
  }

  return (
    <Box className="w-full flex-1 items-center justify-center px-6 py-10">
      {dismissable ? (
        <Pressable
          onPress={handleDismiss}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
      ) : null}
      <Box
        className={`w-full ${hug ? "" : "flex-1"} overflow-hidden rounded-none`}
        style={{
          maxWidth,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.border,
          boxShadow: "none",
          elevation: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
