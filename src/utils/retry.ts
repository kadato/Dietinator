/**
 * Retry policy: retry network/5xx/429 failures, never retry other 4xx.
 * The yazio package throws plain `Error("Error fetching `...` (401 Unauthorized)")`
 * without a `status` property, so the status is recovered from the message when absent.
 */
export function getErrorStatus(error: unknown): number | null {
  if (error && typeof error === "object") {
    const status = (error as { status?: unknown }).status
    if (typeof status === "number" && Number.isInteger(status)) return status
  }
  const message = error instanceof Error ? error.message : String(error)
  const match = /\((\d{3})[^)]*\)/.exec(message)
  return match ? Number(match[1]) : null
}

export function isRetriableError(error: unknown): boolean {
  const status = getErrorStatus(error)
  if (status === null) return true // network failure, no status
  return status >= 500 || status === 429
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 400,
  options?: { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 15000
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs)
    } catch (error) {
      lastError = error
      if (!isRetriableError(error)) throw error
      if (attempt < maxAttempts - 1) {
        const jitter = Math.random() * 100
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt + jitter))
      }
    }
  }
  throw lastError
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Timed out after ${ms}ms`) as Error & { status?: number }
      reject(err)
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  }) as Promise<T>
}
