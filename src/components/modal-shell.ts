import { StyleSheet } from "react-native"
import type { ColorPalette } from "@/theme"

/** Dim level every overlay dialog (water, weight, AI chat) uses. */
export const MODAL_BACKDROP = "rgba(0, 0, 0, 0.45)"
/** Elevation shadow for centered dialogs on wide screens. */
export const MODAL_DIALOG_SHADOW = "0px 8px 40px rgba(0, 0, 0, 0.35)"

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
      backgroundColor: colors.background,
    },
    dialogWrap: {
      flex: 1,
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
      paddingHorizontal: 24,
    },
    dialogBox: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: MODAL_DIALOG_SHADOW,
      elevation: 12,
    },
  })
}
