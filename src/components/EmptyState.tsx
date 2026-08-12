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
   * `large` (default): 80px rounded-square icon tile, `lg` bold title —
   * used for whole-list empty states. `compact`: 48px circle icon with an
   * `sm` muted line — used inside cards.
   */
  variant?: "large" | "compact"
  /** Extra classes for the wrapper (e.g. "mt-12", "pt-14"). */
  className?: string
}

/**
 * The app's single empty-state visual language. Before this existed the tabs
 * had two competing designs (48px circle vs 80px rounded square), each
 * copy-pasted in several places.
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
        <Box className="h-12 w-12 items-center justify-center rounded-full bg-primary-500/10">
          <Ionicons name={icon} size={22} color={tint} />
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
      <Box className="h-20 w-20 items-center justify-center rounded-2xl bg-background-50 shadow-soft-1">
        <Ionicons name={icon} size={36} color={tint} />
      </Box>
      <Text size="lg" bold className="mt-5 text-center text-typography-900">
        {title}
      </Text>
      {message ? (
        <Text size="sm" className="mt-2 max-w-[420px] text-center leading-5 text-typography-500">
          {message}
        </Text>
      ) : null}
      {action ? <Box className="mt-5">{action}</Box> : null}
    </Box>
  )
}
