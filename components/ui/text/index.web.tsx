import React from "react"
import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils"
import { StyleSheet, type StyleProp, type TextStyle } from "react-native"
import { fonts } from "@/theme"
import { textStyle } from "./styles"

const lineClampByCount: Record<number, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
}

function lineClampClass(numberOfLines?: number): string | undefined {
  if (numberOfLines == null || numberOfLines < 1) return undefined
  return lineClampByCount[numberOfLines] ?? lineClampByCount[6]
}

type ITextProps = Omit<React.ComponentProps<"span">, "style"> &
  VariantProps<typeof textStyle> & {
    numberOfLines?: number
    style?: StyleProp<TextStyle> | React.CSSProperties
  }

const Text = React.forwardRef<React.ComponentRef<"span">, ITextProps>(function Text(
  {
    className,
    isTruncated,
    bold,
    underline,
    strikeThrough,
    size = "md",
    sub,
    italic,
    highlight,
    numberOfLines,
    // React Native prop with no DOM equivalent. Stripped before spreading to <span>
    // to avoid "React does not recognize the `adjustsFontSizeToFit` prop" on web.
    adjustsFontSizeToFit: _adjustsFontSizeToFit,
    minimumFontScale: _minimumFontScale,
    allowFontScaling: _allowFontScaling,
    selectable: _selectable,
    suppressHighlighting: _suppressHighlighting,
    ellipsizeMode: _ellipsizeMode,
    onPress,
    onClick,
    accessibilityRole,
    role,
    style,
    ...props
  }: { className?: string } & ITextProps & {
      adjustsFontSizeToFit?: boolean
      minimumFontScale?: number
      allowFontScaling?: boolean
      selectable?: boolean
      suppressHighlighting?: boolean
      ellipsizeMode?: string
      onPress?: (event: unknown) => void
      accessibilityRole?: string
    },
  ref,
) {
  const clampClass = lineClampClass(numberOfLines)

  const flatStyle = StyleSheet.flatten([{ fontFamily: fonts.mono }, style as object]) as
    Record<string, unknown> | undefined

  const normalizedStyle = flatStyle ? ({ ...flatStyle } as Record<string, unknown>) : {}
  if (normalizedStyle) {
    if (
      normalizedStyle.fontWeight &&
      normalizedStyle.fontWeight !== "400" &&
      normalizedStyle.fontWeight !== "normal"
    ) {
      normalizedStyle.fontWeight = "400"
    }
    if (typeof normalizedStyle.lineHeight === "number") {
      normalizedStyle.lineHeight = `${normalizedStyle.lineHeight}px`
    }
  }

  const effectiveOnClick =
    onClick ?? (onPress as unknown as React.MouseEventHandler<HTMLSpanElement> | undefined)
  const effectiveRole =
    role ??
    (accessibilityRole === "link" ? "link" : accessibilityRole === "button" ? "button" : undefined)

  if (effectiveOnClick && !normalizedStyle.cursor) {
    normalizedStyle.cursor = "pointer"
  }

  return (
    <span
      className={textStyle({
        isTruncated: isTruncated as boolean,
        bold: bold as boolean,
        underline: underline as boolean,
        strikeThrough: strikeThrough as boolean,
        size,
        sub: sub as boolean,
        italic: italic as boolean,
        highlight: highlight as boolean,
        class: [className, clampClass].filter(Boolean).join(" "),
      })}
      style={normalizedStyle as React.CSSProperties}
      onClick={effectiveOnClick}
      role={effectiveRole}
      {...props}
      ref={ref}
    />
  )
})

Text.displayName = "Text"

export { Text }
