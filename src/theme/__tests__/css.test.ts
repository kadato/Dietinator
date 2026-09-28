import {
  cssVarsForTheme,
  cssVarsToString,
  darkCssVars,
  generateAllThemesCss,
  generateThemeCss,
  lightCssVars,
} from "../css"

describe("theme css vars", () => {
  it("exposes light and dark vars with meal tokens", () => {
    const light = lightCssVars()
    expect(light["--app-background"]).toBeDefined()
    expect(light["--meal-b"]).toBeDefined()
    expect(light["--bg-grid"]).toContain("15, 23, 42")
    const dark = darkCssVars()
    expect(dark["--app-background"]).toBeDefined()
    expect(dark["--bg-grid"]).toContain("192, 202, 245")
    expect(dark["--scrim"]).toContain("rgba")
  })

  it("resolves named themes and returns null for unknown", () => {
    expect(cssVarsForTheme("light")?.["--app-background"]).toBeDefined()
    expect(cssVarsForTheme("dark")?.["--app-background"]).toBeDefined()
    expect(cssVarsForTheme("nope")).toBeNull()
  })

  it("renders vars as CSS declarations", () => {
    expect(cssVarsToString({ "--a": "1" })).toBe("  --a: 1;")
    expect(cssVarsToString({ "--a": "1", "--b": "2" })).toContain("--b: 2;")
  })

  it("generates theme stylesheets", () => {
    const css = generateThemeCss()
    expect(css).toContain(":root")
    expect(css).toContain("html.dark")
    const all = generateAllThemesCss()
    expect(all).toContain(":root")
    expect(all).toContain("html.dark")
  })
})
