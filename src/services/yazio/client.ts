import { Yazio } from 'yazio';
import {
  clearAuth,
  getCredentials,
  getToken,
  saveToken,
  type StoredToken,
} from './auth-storage';

let client: Yazio | null = null;

export function getYazioClient(): Yazio | null {
  return client;
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
  await clearAuth();
}
