/**
 * Compatibility shim. New helpers live in `src/theme/helpers.ts` with
 * additional primitives (wellStyle, chipStyle, barTrackStyle, etc.).
 * This file re-exports that module so existing `import { chipTint } from "@/theme.helpers"`
 * keeps working while new code can import from `@/theme` or `@/theme/helpers`.
 */
export * from "./theme/helpers"
