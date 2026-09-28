import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"

const WEB_PREFIX = "calorie_tracker_"

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`SecureStore timed out after ${ms}ms`)), ms)
    promise
      .then((v) => {
        clearTimeout(t)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(t)
        reject(e)
      })
  })
}

async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false
  try {
    return await withTimeout(SecureStore.isAvailableAsync(), 800)
  } catch {
    return false
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  const available = await isSecureStoreAvailable()
  if (!available) {
    if (typeof localStorage === "undefined") return null
    try {
      return localStorage.getItem(WEB_PREFIX + key)
    } catch {
      return null
    }
  }
  try {
    return await withTimeout(SecureStore.getItemAsync(key), 1200)
  } catch {
    return null
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  const available = await isSecureStoreAvailable()
  if (!available) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(WEB_PREFIX + key, value)
    }
    return
  }
  await withTimeout(SecureStore.setItemAsync(key, value), 1200)
}

export async function deleteSecureItem(key: string): Promise<void> {
  const available = await isSecureStoreAvailable()
  if (!available) {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(WEB_PREFIX + key)
    }
    return
  }
  await withTimeout(SecureStore.deleteItemAsync(key), 1200)
}
