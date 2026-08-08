import { useCallback, useEffect, useRef, useState } from 'react';
import { searchFoodsRemote } from '@/services/yazio/foods';
import { searchLocalFoods } from '@/db/food-cache';
import { mergeFoodResults } from '@/utils/food-search';
import { useApp } from '@/context/AppContext';
import type { SearchFoodResult } from '@/types';

type Options = {
  /** When false the hook clears its list and stops fetching (e.g. a category toggle). */
  enabled?: boolean;
  /** Loads the list when the query is empty (favorites, recents, suggestions...). */
  emptyQuery?: () => Promise<SearchFoodResult[]>;
  /** Local (SQLite) failures — remote failures just flip `yazioAvailable`. */
  onError?: (error: unknown) => void;
};

/**
 * Local-first food search: cached matches render instantly, remote results
 * patch in when ready. Latest request wins; stale responses are dropped.
 */
export function useFoodSearch(
  debounced: string,
  options?: Options,
): { foods: SearchFoodResult[]; loading: boolean; refresh: () => void } {
  const { setYazioAvailable } = useApp();
  const enabled = options?.enabled ?? true;
  const emptyQuery = options?.emptyQuery;
  const onError = options?.onError;
  const [foods, setFoods] = useState<SearchFoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const requestRef = useRef(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setFoods([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestRef.current;
    let cancelled = false;
    const trimmed = debounced.trim();

    if (!trimmed) {
      if (!emptyQuery) {
        setFoods([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      (async () => {
        try {
          const items = await emptyQuery();
          if (requestId !== requestRef.current || cancelled) return;
          setFoods(items);
        } catch (error) {
          if (requestId === requestRef.current && !cancelled) onError?.(error);
        } finally {
          if (requestId === requestRef.current && !cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    (async () => {
      try {
        const cached = await searchLocalFoods(trimmed);
        if (requestId !== requestRef.current || cancelled) return;
        setFoods(cached);
        setLoading(false);
        try {
          const remote = await searchFoodsRemote(trimmed);
          if (requestId !== requestRef.current || cancelled) return;
          setFoods(mergeFoodResults(cached, remote));
          setYazioAvailable(true);
        } catch {
          if (requestId === requestRef.current && !cancelled) {
            setYazioAvailable(false);
          }
        }
      } catch (error) {
        if (requestId === requestRef.current && !cancelled) {
          setLoading(false);
          onError?.(error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, enabled, emptyQuery, nonce, onError, setYazioAvailable]);

  return { foods, loading, refresh };
}
