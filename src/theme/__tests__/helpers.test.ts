import {
  chipTint,
  cardStyle,
  borderStyle,
  iconBoxStyle,
  flat,
  wellStyle,
  inputStyle,
  chipStyle,
  chipBorder,
  surfaceWellStyle,
  pressedStyle,
  barTrackStyle,
  barHighlight,
  borders,
  radii,
  tints,
  overlays,
} from "../helpers"
import { darkColors } from "../themes"

describe("theme helpers", () => {
  it("exports tokens correctly", () => {
    expect(borders.width).toBeDefined()
    expect(radii.none).toBe(0)
    expect(tints.chip).toBeDefined()
    expect(overlays.highlight).toBeDefined()
    expect(flat.elevation).toBe(0)
    expect(barHighlight.borderTopWidth).toBe(borders.width)
  })

  it("calculates chipTint correctly", () => {
    const tint = chipTint("#ff0000", 0.5)
    expect(typeof tint).toBe("string")
    expect(chipTint("#ff0000")).toBeDefined()
  })

  it("generates cardStyle with border and surface color", () => {
    const style = cardStyle(darkColors)
    expect(style.backgroundColor).toBe(darkColors.surface)
    expect(style.borderColor).toBe(darkColors.border)
    expect(style.borderWidth).toBe(borders.width)
    expect(style.borderRadius).toBe(radii.none)
    expect(style.elevation).toBe(0)
  })

  it("generates borderStyle", () => {
    const style = borderStyle(darkColors)
    expect(style.borderColor).toBe(darkColors.border)
    expect(style.borderWidth).toBe(borders.width)
    expect(style.borderRadius).toBe(radii.none)
  })

  it("generates iconBoxStyle with accent tint", () => {
    const style = iconBoxStyle("#00ff00", darkColors)
    expect(style.borderColor).toBe(darkColors.border)
    expect(style.borderWidth).toBe(borders.width)
    expect(style.borderRadius).toBe(radii.none)
    expect(style.backgroundColor).toBeDefined()
  })

  it("generates wellStyle", () => {
    const style = wellStyle(darkColors)
    expect(style.backgroundColor).toBe(darkColors.surfaceAlt)
    expect(style.borderColor).toBe(darkColors.border)
    expect(style.elevation).toBe(0)
  })

  it("generates inputStyle", () => {
    const style = inputStyle(darkColors)
    expect(style.backgroundColor).toBe(darkColors.surface)
    expect(style.borderColor).toBe(darkColors.border)
    expect(style.elevation).toBe(0)
  })

  it("generates chipStyle with default and custom options", () => {
    const defaultChip = chipStyle("#0000ff")
    expect(defaultChip.borderWidth).toBe(borders.width)
    expect(defaultChip.elevation).toBe(0)

    const customChip = chipStyle("#0000ff", { alpha: 0.2, borderAlpha: 0.5 })
    expect(customChip.backgroundColor).toBeDefined()
    expect(customChip.borderColor).toBeDefined()
  })

  it("generates chipBorder outline", () => {
    expect(chipBorder("#123456")).toBeDefined()
    expect(chipBorder("#123456", 0.8)).toBeDefined()
  })

  it("generates surfaceWellStyle with and without accent", () => {
    const plainWell = surfaceWellStyle(darkColors)
    expect(plainWell.backgroundColor).toBe(darkColors.surfaceAlt)

    const tintedWell = surfaceWellStyle(darkColors, "#ff00aa")
    expect(tintedWell.borderColor).toBe(darkColors.border)
    expect(tintedWell.borderRadius).toBe(radii.none)
  })

  it("generates pressedStyle", () => {
    const style = pressedStyle(darkColors)
    expect(style.backgroundColor).toBe(darkColors.surfaceAlt)
    expect(style.opacity).toBe(0.9)
  })

  it("generates barTrackStyle", () => {
    const style = barTrackStyle(darkColors)
    expect(style.backgroundColor).toBe(darkColors.surfaceAlt)
    expect(style.overflow).toBe("hidden")
    expect(style.borderWidth).toBe(borders.width)
  })
})
