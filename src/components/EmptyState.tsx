import type { ComponentProps, ReactNode } from "react"
import { borders } from "@/theme"
import { Feather } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type IconName = ComponentProps<typeof Feather>["name"]

type Props = {
  icon: IconName
  /** Icon color; defaults to the theme primary. */
  iconColor?: string
  title: string
  message?: string
  /** Extra content below the message, for example a primary action button. */
  action?: ReactNode
  /**
   * Large is default. 64px soft icon circle with a bold title,
   * used for whole-list empty states. Compact is 44px circle icon with an
   * sm muted line, used inside cards.
   */
  variant?: "large" | "compact"
  /** Extra classes for the wrapper, for example mt-12 or pt-14. */
  className?: string
}

/**
 * The app's single empty-state visual language.
 */
export function EmptyState({
  icon,
  iconColor,
  title,
  message,
  action,
  variant = "large",
  className = "",
}: Props) {
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const tint = iconColor ?? colors.primary

  if (variant === "compact") {
    return (
      <Box className={`items-center px-6 py-8 ${className}`}>
        <Box className="h-11 w-11 items-center justify-center rounded-none border bg-background-100">
          <Feather name={icon} size={20} color={tint} />
        </Box>
        <Text size="sm" className="mt-3 max-w-[420px] text-center leading-5 text-typography-500">
          {title}
        </Text>
        {message ? (
          <Text size="sm" className="mt-1 max-w-[420px] text-center leading-5 text-typography-500">
            {message}
          </Text>
        ) : null}
        {action ? <Box className="mt-4">{action}</Box> : null}
      </Box>
    )
  }

  return (
    <Box
      className={`items-center px-6 pb-10 ${className} ${isWide ? "mx-auto w-full max-w-[720px] border bg-background-50 p-8" : ""}`}
      style={
        isWide
          ? {
              borderWidth: borders.width,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }
          : undefined
      }
    >
      <Box className="h-16 w-16 items-center justify-center rounded-none border bg-background-100">
        <Feather name={icon} size={28} color={tint} />
      </Box>
      <Text size="lg" bold className="mt-4 text-center text-typography-900">
        {title}
      </Text>
      {message ? (
        <Text size="sm" className="mt-1.5 max-w-[420px] text-center leading-5 text-typography-500">
          {message}
        </Text>
      ) : null}
      {action ? <Box className="mt-5">{action}</Box> : null}
    </Box>
  )
}
