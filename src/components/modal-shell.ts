import { Platform, StatusBar, StyleSheet } from "react-native"
import type { ColorPalette } from "@/theme"
import { borders, spacing, overlays } from "@/theme/tokens"

/** Dim level every overlay dialog (water, weight, AI chat) uses. */
export const MODAL_BACKDROP = overlays.backdrop

/**
 * Top safe-area value for full-bleed dialogs. The provider's insets can be 0
 * before its first native measurement (or inside modal windows on some
 * Android builds), which makes headers slide up into the camera hole. Android
 * reports the status bar + cutout height synchronously as a fallback.
 */
export function topInset(insets: { top: number }): number {
  if (insets.top > 0) return insets.top
  if (Platform.OS === "android") return StatusBar.currentHeight ?? 0
  return 0
}

/**
 * Shared shell styles for RN `Modal`-based dialogs. Before this existed the
 * backdrop, sheet, dialog wrapper, shadow and FAB layers were copy-pasted in
 * LogWaterModal, LogWeightModal and AiChatModal with small numeric drift
 * (backdrop 0.4 vs 0.45, radius 20 vs 24, shadow 6px vs 8px).
 */
export function createModalShellStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: MODAL_BACKDROP,
    },
    sheet: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    dialogWrap: {
      flex: 1,
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      pointerEvents: "box-none",
    },
    dialogBox: {
      backgroundColor: colors.surface,
      borderWidth: borders.width,
      borderColor: colors.border,
      overflow: "hidden",
    },
  })
}
