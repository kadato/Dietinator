import { computeAdherence, computeLogStreak } from "../adherence"

describe("computeAdherence", () => {
  const history = [
    { date: "2026-08-09", kcal: 1800 },
    { date: "2026-08-10", kcal: 2100 },
    { date: "2026-08-11", kcal: 1900 },
  ]

  it("counts logged, on-target and over-goal days", () => {
    const summary = computeAdherence(history, 2000)
    expect(summary).toEqual({
      loggedDays: 3,
      onTargetDays: 2,
      overGoalDays: 1,
      onTargetPct: 67,
    })
  })

  it("ignores zero-kcal days when sampling", () => {
    const summary = computeAdherence([...history, { date: "2026-08-12", kcal: 0 }], 2000)
    expect(summary.loggedDays).toBe(3)
  })

  it("returns null percentage without logged days or a goal", () => {
    expect(computeAdherence([], 2000).onTargetPct).toBeNull()
    expect(computeAdherence(history, 0).onTargetPct).toBeNull()
  })
})

describe("computeLogStreak", () => {
  const history = [
    { date: "2026-08-06", kcal: 1500 },
    { date: "2026-08-07", kcal: 1600 },
    { date: "2026-08-08", kcal: 1700 },
    { date: "2026-08-09", kcal: 1800 },
    { date: "2026-08-11", kcal: 1900 },
  ]

  it("counts consecutive logged days ending today", () => {
    // Gap on the 10th — only the 11th counts when today is the 11th.
    expect(computeLogStreak(history, "2026-08-11")).toBe(1)
  })

  it("keeps the run when today itself has no entries yet", () => {
    // Today (the 12th) is unlogged: the run ending yesterday (the 11th) still counts.
    expect(computeLogStreak(history, "2026-08-12")).toBe(1)
  })

  it("counts a run that includes today", () => {
    const extended = [...history, { date: "2026-08-10", kcal: 2000 }]
    expect(computeLogStreak(extended, "2026-08-10")).toBe(5)
  })

  it("returns 0 without any logged days", () => {
    expect(computeLogStreak([], "2026-08-11")).toBe(0)
    expect(computeLogStreak(history, "2026-08-01")).toBe(0)
  })
})
