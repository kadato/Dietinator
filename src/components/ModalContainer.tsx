import type { ReactNode } from "react"
import { Box } from "@ui/box"
import { useLayout } from "@/hooks/useLayout"
import { useTheme } from "@/hooks/useTheme"

type Props = {
  children: ReactNode
  /**
   * Max width of the dialog column on wide screens.
   * On phones the container is full width.
   */
  maxWidth?: number
  /**
   * When true the dialog hugs its content height instead of filling the
   * viewport. Use for short forms (e.g. manual entry, create options).
   */
  hug?: boolean
  /** Give the inner column the app's surface color on phones too (full-bleed). */
  surface?: boolean
  /** Extra classes for the phone (full-width) wrapper. */
  outerClassName?: string
}

/**
 * Full-screen modal shell. On phones it is plain full width; on wide
 * (desktop / big screen) viewports the content becomes a centered,
 * floating dialog column with rounded corners and elevation.
 */
export function ModalContainer({
  children,
  maxWidth = 640,
  hug = false,
  surface = false,
  outerClassName,
}: Props) {
  const { isWide } = useLayout()
  const { colors } = useTheme()

  if (!isWide) {
    return (
      <Box
        className={`w-full flex-1 ${outerClassName ?? ""}`}
        style={surface ? { backgroundColor: colors.surface } : undefined}
      >
        {children}
      </Box>
    )
  }

  return (
    <Box className="w-full flex-1 items-center justify-center px-6 py-10">
      <Box
        className={`w-full ${hug ? "" : "flex-1"} overflow-hidden rounded-2xl`}
        style={{
          maxWidth,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          boxShadow: "0px 4px 24px rgba(0, 0, 0, 0.08)",
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
