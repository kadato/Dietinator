import { Yazio } from 'yazio';
import {
  clearAuth,
  getCredentials,
  getToken,
  saveToken,
  type StoredToken,
} from './auth-storage';
import { installYazioWebFetch } from './web-fetch';

installYazioWebFetch();

let client: Yazio | null = null;
let cachedEnergyUnit: string | null = null;

export function getYazioClient(): Yazio | null {
  return client;
}

/** YAZIO profile `unit_energy` (kcal or kj); cached per session. */
export async function getYazioEnergyUnit(): Promise<string> {
  if (cachedEnergyUnit) return cachedEnergyUnit;
  const yazio = getYazioClient() ?? (await initYazioClient());
  if (!yazio) return 'kcal';
  const profile = await yazio.user.get();
  cachedEnergyUnit = profile.unit_energy ?? 'kcal';
  return cachedEnergyUnit;
}

export function clearYazioEnergyUnitCache(): void {
  cachedEnergyUnit = null;
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

  if (token) {
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
  await saveCredentials({ username, password });

  const yazio = new Yazio({
    credentials: { username, password },
    onRefresh: async ({ token }) => {
      await saveToken(token as StoredToken);
    },
  });

  await yazio.user.get();
  const { getToken: readStoredToken } = await import('./auth-storage');
  const stored = await readStoredToken();
  if (!stored) {
    throw new Error('Authentication succeeded but no token was stored.');
  }
  client = yazio;
  return yazio;
}

export async function logoutYazio(): Promise<void> {
  client = null;
  clearYazioEnergyUnitCache();
  await clearAuth();
}
