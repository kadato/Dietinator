import { useCallback } from "react"
import { useRouter } from "expo-router"

/**
 * Returns a callback that pops the navigation stack if possible,
 * or safely replaces with the main tabs route when opened directly.
 */
export function useSafeBack(fallbackRoute: string = "/(tabs)"): () => void {
  const router = useRouter()
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace(fallbackRoute as never)
    }
  }, [fallbackRoute, router])
}
