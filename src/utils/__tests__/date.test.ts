import { matchesDateKey, parseDateKey, shiftDateKey, toDateKey, toYazioApiDate } from "../date"

describe("toDateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(toDateKey(new Date(2026, 7, 8))).toBe("2026-08-08")
    expect(toDateKey(new Date(2026, 0, 3))).toBe("2026-01-03")
  })

  it("defaults to the current local date", () => {
    const now = new Date()
    const expected = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    expect(toDateKey()).toBe(expected)
  })
})

describe("parseDateKey", () => {
  it("parses a date key as local time", () => {
    const date = parseDateKey("2026-08-08")
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7)
    expect(date.getDate()).toBe(8)
  })
})

describe("shiftDateKey", () => {
  it("moves forward and backward by whole days", () => {
    expect(shiftDateKey("2026-08-08", 1)).toBe("2026-08-09")
    expect(shiftDateKey("2026-08-08", -1)).toBe("2026-08-07")
  })

  it("handles month boundaries", () => {
    expect(shiftDateKey("2026-01-31", 1)).toBe("2026-02-01")
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28")
  })

  it("is DST-safe for a summer-to-winter transition", () => {
    // 2026-10-25 is the EU DST end date; shifting must stay on calendar days.
    expect(shiftDateKey("2026-10-25", -1)).toBe("2026-10-24")
    expect(shiftDateKey("2026-10-24", 1)).toBe("2026-10-25")
  })
})

describe("matchesDateKey", () => {
  it("matches YYYY-MM-DD payloads", () => {
    expect(matchesDateKey("2026-08-08", "2026-08-08")).toBe(true)
  })

  it("matches payloads with time suffixes", () => {
    expect(matchesDateKey("2026-08-08 12:30:00", "2026-08-08")).toBe(true)
  })

  it("rejects other dates, malformed values and undefined", () => {
    expect(matchesDateKey("2026-08-09", "2026-08-08")).toBe(false)
    expect(matchesDateKey("08/08/2026", "2026-08-08")).toBe(false)
    expect(matchesDateKey(undefined, "2026-08-08")).toBe(false)
  })
})

describe("toYazioApiDate", () => {
  it("passes date keys through unchanged", () => {
    expect(toYazioApiDate("2026-08-08")).toBe("2026-08-08")
  })
})
