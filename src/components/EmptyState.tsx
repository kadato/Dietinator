import type { ComponentProps, ReactNode } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type IconName = ComponentProps<typeof Ionicons>["name"]

type Props = {
  icon: IconName
  /** Icon color; defaults to the theme primary. */
  iconColor?: string
  title: string
  message?: string
  /** Extra content below the message (e.g. a primary action button). */
  action?: ReactNode
  /**
   * `large` (default): 64px soft icon circle with a bold title —
   * used for whole-list empty states. `compact`: 44px circle icon with an
   * `sm` muted line — used inside cards.
   */
  variant?: "large" | "compact"
  /** Extra classes for the wrapper (e.g. "mt-12", "pt-14"). */
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
  const tint = iconColor ?? colors.primary

  if (variant === "compact") {
    return (
      <Box className={`items-center px-6 py-8 ${className}`}>
        <Box className="h-11 w-11 items-center justify-center rounded-full bg-background-100">
          <Ionicons name={icon} size={20} color={tint} />
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
    <Box className={`items-center px-6 pb-10 ${className}`}>
      <Box className="h-16 w-16 items-center justify-center rounded-full bg-background-100">
        <Ionicons name={icon} size={28} color={tint} />
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
