import { StyleSheet } from "react-native"
import { fonts } from "./tokens"
import type { TextStyle } from "react-native"

/**
 * Centralized typography presets. Every text style that repeats
 * fontFamily + tabular-nums + letterSpacing + transform should
 * derive from here, so font or tracking changes stay in one place.
 */

export const monoTabular: TextStyle = {
  fontFamily: fonts.mono,
  fontVariant: ["tabular-nums"],
}

export const monoUppercase = (letterSpacing = 0.4): TextStyle => ({
  fontFamily: fonts.mono,
  fontVariant: ["tabular-nums"],
  textTransform: "uppercase",
  letterSpacing,
})

export const presets = StyleSheet.create({
  display: {
    fontFamily: fonts.mono,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  headline: {
    fontFamily: fonts.mono,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.04,
  },
  title: {
    fontFamily: fonts.mono,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.04,
  },
  label: {
    fontFamily: fonts.mono,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.08,
  },
  labelSmall: {
    fontFamily: fonts.mono,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  body: {
    fontFamily: fonts.mono,
    fontWeight: "400",
    letterSpacing: 0,
  },
  monoNumeric: {
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.2,
  },
  monoNumericBold: {
    fontFamily: fonts.mono,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.4,
  },
})
