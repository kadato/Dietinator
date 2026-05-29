import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const WEB_PREFIX = 'calorie_tracker_';

async function useSecureStore(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return SecureStore.isAvailableAsync();
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (!(await useSecureStore())) {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(WEB_PREFIX + key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (!(await useSecureStore())) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WEB_PREFIX + key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (!(await useSecureStore())) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(WEB_PREFIX + key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
