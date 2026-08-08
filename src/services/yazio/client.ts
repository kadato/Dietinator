import { Yazio } from 'yazio';
import { getSettings } from '@/db/settings';
import {
  clearAuth,
  getCredentials,
  getToken,
  saveToken,
  type StoredToken,
} from './auth-storage';
import { resolveFoodDatabaseCountry } from '@/utils/food-database-country';
import { installYazioWebFetch } from './web-fetch';

installYazioWebFetch();

let client: Yazio | null = null;

type YazioProfileSlice = {
  unit_energy: string;
  food_database_country: string;
  sex: 'male' | 'female' | 'other';
};

let cachedProfile: YazioProfileSlice | null = null;

export function getYazioClient(): Yazio | null {
  return client;
}

/** Return the singleton client, initializing it from stored tokens/credentials if needed. */
export async function ensureYazioClient(): Promise<Yazio | null> {
  let yazio = getYazioClient();
  if (!yazio) yazio = await initYazioClient();
  return yazio;
}

/** Cached YAZIO profile fields used for search and nutrient units. */
export async function getYazioProfile(): Promise<YazioProfileSlice | null> {
  if (cachedProfile) return cachedProfile;
  const yazio = await ensureYazioClient();
  if (!yazio) return null;
  const profile = await yazio.user.get();
  cachedProfile = {
    unit_energy: profile.unit_energy ?? 'kcal',
    food_database_country: profile.food_database_country || profile.country || 'DE',
    sex: profile.sex ?? 'male',
  };
  return cachedProfile;
}

/** YAZIO profile `unit_energy` (kcal or kj); cached per session. */
export async function getYazioEnergyUnit(): Promise<string> {
  const profile = await getYazioProfile();
  return profile?.unit_energy ?? 'kcal';
}

/** Product search options aligned with the user's YAZIO food database country. */
export async function getYazioProductSearchOptions(): Promise<{
  countries: string[];
  sex: 'male' | 'female';
}> {
  const [settings, profile] = await Promise.all([getSettings(), getYazioProfile()]);
  const country = resolveFoodDatabaseCountry(
    settings.food_database_country,
    profile?.food_database_country,
  );
  const sex = profile?.sex === 'female' ? 'female' : 'male';
  return {
    countries: [country.toUpperCase()],
    sex,
  };
}

export function clearYazioProfileCache(): void {
  cachedProfile = null;
}

export async function initYazioClient(): Promise<Yazio | null> {
  const token = await getToken();
  const credentials = await getCredentials();
  if (!token && !credentials) {
    client = null;
    return null;
  }

  const onRefresh = async ({ token: refreshed }: { token: StoredToken }) => {
    await saveToken(refreshed);
  };

  // Pass BOTH when available: an expired cached token cannot be refreshed
  // without credentials (the yazio client re-auths from `credentials`).
  if (token && credentials) {
    client = new Yazio({ token, credentials, onRefresh });
  } else if (token) {
    client = new Yazio({ token, onRefresh });
  } else if (credentials) {
    client = new Yazio({ credentials, onRefresh });
  }

  return client;
}

export async function loginWithCredentials(
  username: string,
  password: string,
): Promise<Yazio> {
  const { saveCredentials } = await import('./auth-storage');

  const yazio = new Yazio({
    credentials: { username, password },
    onRefresh: async ({ token }) => {
      await saveToken(token as StoredToken);
    },
  });

  // Validate credentials BEFORE persisting them — a failed login must not
  // leave stale credentials behind that poison every later session.
  await yazio.user.get();
  clearYazioProfileCache();
  const { getToken: readStoredToken } = await import('./auth-storage');
  const stored = await readStoredToken();
  if (!stored) {
    throw new Error('Authentication succeeded but no token was stored.');
  }
  await saveCredentials({ username, password });
  client = yazio;
  return yazio;
}

export async function logoutYazio(): Promise<void> {
  client = null;
  clearYazioProfileCache();
  await clearAuth();
}
