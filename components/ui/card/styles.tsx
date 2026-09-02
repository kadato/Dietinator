import { tva, isWeb } from "@gluestack-ui/utils/nativewind-utils"

// Deduped: every card is square with 1.5px ink rule; variant only swaps the fill.
// The border color is overridden globally to var(--app-border) so outline-200 stays sync.
// To add a theme, keep this file untouched and update global.css / src/theme/css.ts.
const baseStyle = isWeb ? "flex flex-col relative z-0" : ""
const cardBorder = "rounded-none border border-outline-200"

export const cardStyle = tva({
  base: baseStyle,
  variants: {
    size: {
      sm: `p-3 ${cardBorder}`,
      md: `p-4 ${cardBorder}`,
      lg: `p-6 ${cardBorder}`,
    },
    variant: {
      elevated: `bg-background-50 ${cardBorder}`,
      outline: `border border-outline-200 bg-background-50 rounded-none`,
      ghost: "rounded-none border-0",
      filled: `bg-background-100 ${cardBorder}`,
    },
  },
})
