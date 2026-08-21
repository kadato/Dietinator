import { useCallback, useEffect, useRef, useState } from "react"
import { searchFoodsRemote } from "@/services/yazio/foods"
import { searchLocalFoods } from "@/db/food-cache"
import { mergeFoodResults } from "@/utils/food-search"
import { useApp } from "@/context/AppContext"
import type { SearchFoodResult } from "@/types"

type Options<T> = {
  /** When false the hook clears its list and stops fetching (for example, a category toggle). */
  enabled?: boolean
  /** Loads the list when the query is empty (favorites, recents, suggestions...). */
  emptyQuery?: () => Promise<T[]>
  /** Local (SQLite) failures. Remote failures just flip `yazioAvailable`. */
  onError?: (error: unknown) => void
}

/**
 * Local-first food search: cached matches render instantly, remote results
 * patch in when ready. Latest request wins; stale responses are dropped.
 * `T` is the empty-query row type (plain foods, or usage rows with amounts).
 */
export function useFoodSearch<T = SearchFoodResult>(
  debounced: string,
  options?: Options<T>,
): { foods: T[]; loading: boolean; refresh: () => void } {
  const { setYazioAvailable } = useApp()
  const enabled = options?.enabled ?? true
  const emptyQuery = options?.emptyQuery
  const onError = options?.onError
  const [foods, setFoods] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [nonce, setNonce] = useState(0)
  const requestRef = useRef(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  // Reset the list synchronously when `enabled` flips (React-recommended
  // "adjust state during render" pattern instead of setState-in-effect).
  const [prevEnabled, setPrevEnabled] = useState(enabled)
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled)
    setFoods([])
    setLoading(false)
  }

  // Without an `emptyQuery` provider there is nothing to show for a blank
  // query, so present an empty list rather than stale rows.
  const showResults = enabled && !(debounced.trim() === "" && !emptyQuery)

  useEffect(() => {
    if (!enabled) return
    const requestId = ++requestRef.current
    let cancelled = false
    const trimmed = debounced.trim()

    if (!trimmed) {
      if (!emptyQuery) return
      void (async () => {
        setLoading(true)
        try {
          const items = await emptyQuery()
          if (requestId !== requestRef.current || cancelled) return
          setFoods(items)
        } catch (error) {
          if (requestId === requestRef.current && !cancelled) onError?.(error)
        } finally {
          if (requestId === requestRef.current && !cancelled) setLoading(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      setLoading(true)
      try {
        const cached = await searchLocalFoods(trimmed)
        if (requestId !== requestRef.current || cancelled) return
        setFoods(cached as T[])
        setLoading(false)
        try {
          const remote = await searchFoodsRemote(trimmed)
          if (requestId !== requestRef.current || cancelled) return
          setFoods(mergeFoodResults(cached, remote) as T[])
          setYazioAvailable(true)
        } catch {
          if (requestId === requestRef.current && !cancelled) {
            setYazioAvailable(false)
          }
        }
      } catch (error) {
        if (requestId === requestRef.current && !cancelled) {
          setLoading(false)
          onError?.(error)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debounced, enabled, emptyQuery, nonce, onError, setYazioAvailable])

  return { foods: showResults ? foods : [], loading: showResults ? loading : false, refresh }
}
