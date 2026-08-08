import { getErrorStatus, isRetriableError, withRetry } from "../retry"

describe("getErrorStatus", () => {
  it("reads a numeric status property", () => {
    expect(getErrorStatus({ status: 503 })).toBe(503)
    expect(getErrorStatus({ status: 401 })).toBe(401)
  })

  it("ignores non-integer status properties", () => {
    expect(getErrorStatus({ status: "503" })).toBeNull()
  })

  it("recover statuses from yazio-style messages", () => {
    expect(getErrorStatus(new Error("Error fetching `foo` (401 Unauthorized)"))).toBe(401)
    expect(getErrorStatus(new Error("something (429 Too Many Requests)"))).toBe(429)
    expect(getErrorStatus(new Error("bare (503)"))).toBe(503)
  })

  it("returns null for network-style failures", () => {
    expect(getErrorStatus(new Error("Network request failed"))).toBeNull()
    expect(getErrorStatus("TypeError: fetch failed")).toBeNull()
    expect(getErrorStatus(undefined)).toBeNull()
  })
})

describe("isRetriableError", () => {
  it("retries 5xx and 429", () => {
    expect(isRetriableError({ status: 500 })).toBe(true)
    expect(isRetriableError({ status: 503 })).toBe(true)
    expect(isRetriableError({ status: 429 })).toBe(true)
  })

  it("never retries other 4xx", () => {
    expect(isRetriableError({ status: 400 })).toBe(false)
    expect(isRetriableError({ status: 401 })).toBe(false)
    expect(isRetriableError({ status: 404 })).toBe(false)
  })

  it("retries status-less network failures", () => {
    expect(isRetriableError(new Error("Network request failed"))).toBe(true)
  })
})

describe("withRetry", () => {
  beforeEach(() => jest.useFakeTimers())

  afterEach(() => jest.useRealTimers())

  it("returns the value on the first attempt", async () => {
    const fn = jest.fn().mockResolvedValue("ok")
    const promise = withRetry(fn, 3, 10)
    await jest.runAllTimersAsync()
    await expect(promise).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries 5xx failures and eventually succeeds", async () => {
    const fn = jest.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce("recovered")
    const promise = withRetry(fn, 3, 10)
    await jest.runAllTimersAsync()
    await expect(promise).resolves.toBe("recovered")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("throws immediately for non-retriable errors", async () => {
    const error = new Error("Error fetching `x` (401 Unauthorized)")
    const fn = jest.fn().mockRejectedValue(error)
    const assertion = expect(withRetry(fn, 3, 10)).rejects.toBe(error)
    await assertion
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("throws the last error after exhausting attempts", async () => {
    const error = { status: 500 }
    const fn = jest.fn().mockRejectedValue(error)
    const assertion = expect(withRetry(fn, 2, 10)).rejects.toBe(error)
    await jest.runAllTimersAsync()
    await assertion
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
