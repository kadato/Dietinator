import { deleteSecureItem, getSecureItem, setSecureItem } from "@/utils/secure-storage"

const TOKEN_KEY = "yazio_token"
const CREDENTIALS_KEY = "yazio_credentials"
const LOGGED_IN_KEY = "yazio_logged_in"
const REMEMBER_LOGIN_KEY = "yazio_remember_login"
const REMEMBERED_EMAIL_KEY = "yazio_remembered_email"
const REMEMBERED_PASSWORD_KEY = "yazio_remembered_password"

export type StoredToken = {
  token_type: string
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
}

export type StoredCredentials = {
  username: string
  password: string
}

export async function saveToken(token: StoredToken): Promise<void> {
  await setSecureItem(TOKEN_KEY, JSON.stringify(token))
  await setSecureItem(LOGGED_IN_KEY, "1")
}

export async function getToken(): Promise<StoredToken | null> {
  const raw = await getSecureItem(TOKEN_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredToken
  } catch {
    return null
  }
}

export async function saveCredentials(credentials: StoredCredentials): Promise<void> {
  await setSecureItem(CREDENTIALS_KEY, JSON.stringify(credentials))
}

export async function getCredentials(): Promise<StoredCredentials | null> {
  const raw = await getSecureItem(CREDENTIALS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredCredentials
  } catch {
    return null
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const flag = await getSecureItem(LOGGED_IN_KEY)
  return flag === "1"
}

export async function saveRememberedLogin(email: string, password: string): Promise<void> {
  await setSecureItem(REMEMBER_LOGIN_KEY, "1")
  await setSecureItem(REMEMBERED_EMAIL_KEY, email)
  await setSecureItem(REMEMBERED_PASSWORD_KEY, password)
}

export async function getRememberedLogin(): Promise<{
  email: string
  password: string
} | null> {
  const flag = await getSecureItem(REMEMBER_LOGIN_KEY)
  if (flag !== "1") return null
  const email = await getSecureItem(REMEMBERED_EMAIL_KEY)
  if (!email) return null
  const password = (await getSecureItem(REMEMBERED_PASSWORD_KEY)) ?? ""
  return { email, password }
}

export async function clearRememberedLogin(): Promise<void> {
  await deleteSecureItem(REMEMBER_LOGIN_KEY)
  await deleteSecureItem(REMEMBERED_EMAIL_KEY)
  await deleteSecureItem(REMEMBERED_PASSWORD_KEY)
}

export async function clearAuth(): Promise<void> {
  await deleteSecureItem(TOKEN_KEY)
  await deleteSecureItem(CREDENTIALS_KEY)
  await deleteSecureItem(LOGGED_IN_KEY)
}

/** Demo mode: mark the session signed in without real YAZIO credentials. */
export async function setDemoLoggedIn(): Promise<void> {
  await setSecureItem(LOGGED_IN_KEY, "1")
}

const ACTIVE_ACCOUNT_KEY = "yazio_active_account"

export function normalizeAccountId(id: string): string {
  return id.trim().toLowerCase()
}

export async function getActiveAccountId(): Promise<string | null> {
  const raw = await getSecureItem(ACTIVE_ACCOUNT_KEY)
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

export async function setActiveAccountId(id: string): Promise<void> {
  await setSecureItem(ACTIVE_ACCOUNT_KEY, normalizeAccountId(id))
}

export async function clearActiveAccountId(): Promise<void> {
  await deleteSecureItem(ACTIVE_ACCOUNT_KEY)
}
