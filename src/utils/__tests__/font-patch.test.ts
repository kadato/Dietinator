import { StyleSheet } from "react-native"
import { isIconFamily, applyFontPatch } from "../font-patch"
import { fonts } from "@/theme"

describe("font-patch", () => {
  describe("isIconFamily", () => {
    it("recognizes standard @expo/vector-icons font families regardless of casing or formatting", () => {
      // Expo / react-native-vector-icons internal family names
      expect(isIconFamily("feather")).toBe(true)
      expect(isIconFamily("Feather")).toBe(true)
      expect(isIconFamily("material-community")).toBe(true)
      expect(isIconFamily("MaterialCommunityIcons")).toBe(true)
      expect(isIconFamily("Material Design Icons")).toBe(true)
      expect(isIconFamily("ionicons")).toBe(true)
      expect(isIconFamily("Ionicons")).toBe(true)
      expect(isIconFamily("material")).toBe(true)
      expect(isIconFamily("MaterialIcons")).toBe(true)
      expect(isIconFamily("Material Icons")).toBe(true)
      expect(isIconFamily("FontAwesome")).toBe(true)
      expect(isIconFamily("FontAwesome5Free-Solid")).toBe(true)
      expect(isIconFamily("FontAwesome6Brands")).toBe(true)
      expect(isIconFamily("anticon")).toBe(true)
      expect(isIconFamily("AntDesign")).toBe(true)
      expect(isIconFamily("entypo")).toBe(true)
      expect(isIconFamily("evilicons")).toBe(true)
      expect(isIconFamily("fontisto")).toBe(true)
      expect(isIconFamily("foundation")).toBe(true)
      expect(isIconFamily("fontcustom")).toBe(true)
      expect(isIconFamily("octicons")).toBe(true)
      expect(isIconFamily("simple-line-icons")).toBe(true)
      expect(isIconFamily("zocial")).toBe(true)
      expect(isIconFamily("icomoon")).toBe(true)
      expect(isIconFamily("fontello")).toBe(true)
    })

    it("does not match non-icon fonts", () => {
      expect(isIconFamily("Departure Mono")).toBe(false)
      expect(isIconFamily("DepartureMono")).toBe(false)
      expect(isIconFamily("DepartureMono-Regular")).toBe(false)
      expect(isIconFamily("Roboto")).toBe(false)
      expect(isIconFamily("sans-serif")).toBe(false)
      expect(isIconFamily("monospace")).toBe(false)
      expect(isIconFamily("System")).toBe(false)
      expect(isIconFamily("Arial")).toBe(false)
      expect(isIconFamily("")).toBe(false)
      expect(isIconFamily(null)).toBe(false)
      expect(isIconFamily(undefined)).toBe(false)
    })
  })

  describe("applyFontPatch", () => {
    it("runs idempotently and patches StyleSheet.flatten", () => {
      applyFontPatch()
      applyFontPatch()

      const regularStyle = StyleSheet.flatten({
        fontSize: 16,
        fontWeight: "700",
        fontStyle: "italic",
      })
      expect(regularStyle).toEqual(
        expect.objectContaining({
          fontFamily: fonts.mono,
          fontWeight: "400",
          fontStyle: "normal",
        }),
      )

      const iconStyle = StyleSheet.flatten({ fontFamily: "feather", fontSize: 24 })
      expect(iconStyle).toEqual(
        expect.objectContaining({
          fontFamily: "feather",
          fontSize: 24,
        }),
      )

      const nullStyle = StyleSheet.flatten(null)
      expect(nullStyle).toBeUndefined()
    })
  })
})
