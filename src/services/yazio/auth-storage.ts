import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from '@/utils/secure-storage';

const TOKEN_KEY = 'yazio_token';
const CREDENTIALS_KEY = 'yazio_credentials';
const LOGGED_IN_KEY = 'yazio_logged_in';

export type StoredToken = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
};

export type StoredCredentials = {
  username: string;
  password: string;
};

export async function saveToken(token: StoredToken): Promise<void> {
  await setSecureItem(TOKEN_KEY, JSON.stringify(token));
  await setSecureItem(LOGGED_IN_KEY, '1');
}

export async function getToken(): Promise<StoredToken | null> {
  const raw = await getSecureItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredToken;
  } catch {
    return null;
  }
}

export async function saveCredentials(credentials: StoredCredentials): Promise<void> {
  await setSecureItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}

export async function getCredentials(): Promise<StoredCredentials | null> {
  const raw = await getSecureItem(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCredentials;
  } catch {
    return null;
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const flag = await getSecureItem(LOGGED_IN_KEY);
  return flag === '1';
}

export async function clearAuth(): Promise<void> {
  await deleteSecureItem(TOKEN_KEY);
  await deleteSecureItem(CREDENTIALS_KEY);
  await deleteSecureItem(LOGGED_IN_KEY);
}
