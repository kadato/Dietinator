import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"

const WEB_PREFIX = "calorie_tracker_"

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms)
    promise
      .then((v) => {
        clearTimeout(t)
        resolve(v)
      })
      .catch(() => {
        clearTimeout(t)
        resolve(fallback)
      })
  })
}

async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false
  try {
    const available = await withTimeout(SecureStore.isAvailableAsync(), 800, false)
    return available
  } catch {
    return false
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  const available = await isSecureStoreAvailable()
  if (!available) {
    if (typeof localStorage === "undefined") return null
    return localStorage.getItem(WEB_PREFIX + key)
  }
  return withTimeout(SecureStore.getItemAsync(key), 1200, null)
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  const available = await isSecureStoreAvailable()
  if (!available) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(WEB_PREFIX + key, value)
    }
    return
  }
  await withTimeout(SecureStore.setItemAsync(key, value), 1200, undefined as unknown as void)
}

export async function deleteSecureItem(key: string): Promise<void> {
  const available = await isSecureStoreAvailable()
  if (!available) {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(WEB_PREFIX + key)
    }
    return
  }
  await withTimeout(SecureStore.deleteItemAsync(key), 1200, undefined as unknown as void)
}
