import type { ReactNode } from "react"
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { Box } from "@ui/box"
import { useLayout, type LayoutVariant } from "@/hooks/useLayout"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type Props = {
  children: ReactNode
  variant?: LayoutVariant
  /** When false, inner content does not expand (use inside ScrollView). */
  grow?: boolean
  className?: string
  contentClassName?: string
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
}

export function PageContainer({
  children,
  variant = "default",
  grow = true,
  className,
  contentClassName,
  style,
  contentStyle,
}: Props) {
  const { contentMaxWidth } = useLayout(variant)
  const insets = useSafeAreaInsets()

  return (
    <Box
      className={`w-full flex-1 items-center ${className ?? ""}`}
      style={StyleSheet.flatten([{ paddingLeft: insets.left, paddingRight: insets.right }, style])}
    >
      <Box
        className={`w-full ${grow ? "flex-1" : ""} ${contentClassName ?? ""}`}
        style={StyleSheet.flatten([{ maxWidth: contentMaxWidth }, contentStyle])}
      >
        {children}
      </Box>
    </Box>
  )
}
