import { tva, isWeb } from "@gluestack-ui/utils/nativewind-utils"
const baseStyle = isWeb ? "flex flex-col relative z-0" : ""

export const cardStyle = tva({
  base: baseStyle,
  variants: {
    size: {
      sm: "p-3 rounded-none border border-outline-200",
      md: "p-4 rounded-none border border-outline-200",
      lg: "p-6 rounded-none border border-outline-200",
    },
    variant: {
      elevated: "bg-background-50 rounded-none border border-outline-200",
      outline: "border border-outline-200 bg-background-50 rounded-none",
      ghost: "rounded-none border-0",
      filled: "bg-background-100 rounded-none border border-outline-200",
    },
  },
})
