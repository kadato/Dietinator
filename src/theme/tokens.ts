import { Platform } from "react-native"

export const spacing = {
  "2xs": 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
} as const

export const borders = {
  width: 1.5,
  widthThin: 1,
  radius: 0,
} as const

export const radii = {
  none: 0,
} as const

/**
 * Chip tint alpha - centralizes the 14% rule so contrast can be tuned once.
 * Update here and every meal pill, budget badge and icon well follows.
 */
export const tints = {
  chip: 0.14,
  chipStrong: 0.2,
  overlay: 0.14,
  /** Modal scrim opacity. */
  backdrop: 0.45,
  /** Top highlight for progress fills - luminance separation beyond hue. */
  highlight: 0.22,
  /** Paper grid alpha. */
  grid: 0.035,
} as const

export const overlays = {
  /** Modal backdrop: rgba(0,0,0,0.45) */
  backdrop: "rgba(0, 0, 0, 0.45)",
  /** Top edge highlight for bar fills. */
  highlight: "rgba(255, 255, 255, 0.22)",
} as const

/** Breakpoints and max widths for tablet / desktop / web layouts.
 * 600 is thumb-to-two-column, 900 is phone-to-desktop rail, 1280 is
 * comfortable desktop where whitespace would otherwise pool. The 11px grid
 * stays crisp at every width because Departure Mono snaps to 11px increments.
 */
export const layout = {
  breakpointMedium: 600,
  breakpointWide: 900,
  breakpointLarge: 1280,
  breakpointXl: 1440,
  maxWidthNarrow: 420,
  maxWidthContent: 720,
  maxWidthWide: 1160,
  maxWidthXl: 1360,
  /** Centered app shell for wide viewports so nothing rests on the screen edge. */
  shellMaxWidth: 1440,
  shellPadding: 24,
  shellGap: 20,
  sideTabWidth: 96,
  sideTabItemWidth: 84,
  /** Fixed bottom tab bar height on phones, excluding the safe-area inset. */
  tabBarHeight: 56,
} as const

/**
 * Terminal face: Departure Mono everywhere, single bundled face.
 * Web: registered from assets/fonts by src/utils/web-fonts.ts.
 * Native: resolved verbatim from android/app/src/main/assets/fonts
 * as Departure Mono per RN font manager rules.
 */
const DEPARTURE_WEB = "'Departure Mono', monospace"
const DEPARTURE_NATIVE = "Departure Mono"

export const fonts = {
  mono: Platform.OS === "web" ? DEPARTURE_WEB : DEPARTURE_NATIVE,
  sans: Platform.OS === "web" ? DEPARTURE_WEB : DEPARTURE_NATIVE,
  display: Platform.OS === "web" ? DEPARTURE_WEB : DEPARTURE_NATIVE,
} as const

/**
 * Typography presets. Departure Mono is the only face; hierarchy comes from
 * size, tracking and transform, not weight synthesis.
 */
export const typography = {
  mono: {
    fontFamily: DEPARTURE_WEB,
    fontVariant: ["tabular-nums"] as const,
  },
  label: {
    fontFamily: DEPARTURE_WEB,
    fontVariant: ["tabular-nums"] as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
    fontWeight: "700" as const,
  },
  title: {
    fontFamily: DEPARTURE_WEB,
    letterSpacing: 0.04,
    fontWeight: "700" as const,
  },
} as const
