import React from "react"

import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils"
import { StyleSheet, Text as RNText } from "react-native"
import { fonts } from "@/theme"
import { textStyle } from "./styles"

type ITextProps = React.ComponentProps<typeof RNText> & VariantProps<typeof textStyle>

const Text = React.forwardRef<React.ComponentRef<typeof RNText>, ITextProps>(function Text(
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
    style,
    ...props
  },
  ref,
) {
  return (
    <RNText
      className={textStyle({
        isTruncated: isTruncated as boolean,
        bold: bold as boolean,
        underline: underline as boolean,
        strikeThrough: strikeThrough as boolean,
        size,
        sub: sub as boolean,
        italic: italic as boolean,
        highlight: highlight as boolean,
        class: className,
      })}
      style={StyleSheet.flatten([{ fontFamily: fonts.mono }, style as object])}
      {...props}
      ref={ref}
    />
  )
})

Text.displayName = "Text"

export { Text }
