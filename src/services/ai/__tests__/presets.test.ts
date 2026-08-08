import { AI_PRESETS, presetPrompt } from "../presets"

describe("AI presets", () => {
  it("exposes curated one-tap presets with unique ids", () => {
    expect(AI_PRESETS.length).toBeGreaterThanOrEqual(5)
    const ids = new Set(AI_PRESETS.map((p) => p.id))
    expect(ids.size).toBe(AI_PRESETS.length)
    for (const preset of AI_PRESETS) {
      expect(preset.title.length).toBeGreaterThan(0)
      expect(preset.prompt.length).toBeGreaterThan(0)
      expect(preset.icon.length).toBeGreaterThan(0)
    }
  })

  it("fills the {date} slot with today's date key", () => {
    const preset = AI_PRESETS.find((p) => p.prompt.includes("{date}"))
    expect(preset).toBeDefined()
    const prompt = presetPrompt(preset!)
    expect(prompt).not.toContain("{date}")
    expect(prompt).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it("leaves presets without slots untouched", () => {
    const plain = AI_PRESETS.find((p) => !p.prompt.includes("{date}"))
    expect(plain).toBeDefined()
    expect(presetPrompt(plain!)).toBe(plain!.prompt)
  })
})
