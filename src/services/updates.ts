import Constants from "expo-constants"
import { withRetry } from "@/utils/retry"

/** GitHub repository that publishes Dietinator releases (APK + changelog). */
export const GITHUB_REPO = "kadato/Dietinator"

/** GitHub web URL of the repository, used by the quota-free redirect fallback. */
export const RELEASE_PAGE_URL = `https://github.com/${GITHUB_REPO}`

/** Release asset name published by `.github/workflows/release.yml`. */
export const ANDROID_APK_ASSET = "Dietinator-Android.apk"

export type GitHubReleaseAsset = {
  name: string
  downloadUrl: string
  sizeBytes: number
}

export type GitHubRelease = {
  tag: string
  name: string
  notes: string | null
  publishedAt: string | null
  prerelease: boolean
  assets: GitHubReleaseAsset[]
}

/** Parse a release tag like "v1.2.3" (or "1.2.3") into numeric parts. */
export function parseVersion(tag: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(tag.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** True when the release tag is a newer semver than the installed version. */
export function isNewerThan(tag: string, installed: string): boolean {
  const release = parseVersion(tag)
  const current = parseVersion(installed)
  if (!release || !current) return false
  return (
    release[0] > current[0] ||
    (release[0] === current[0] &&
      (release[1] > current[1] || (release[1] === current[1] && release[2] > current[2])))
  )
}

/** Installed app version (app.json `version` baked in at build time). */
export function getCurrentVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0"
}

/** The Android APK attached to a release, or null when this release ships none. */
export function getApkAsset(release: GitHubRelease): GitHubReleaseAsset | null {
  return (
    release.assets.find((asset) => asset.name.toLowerCase() === ANDROID_APK_ASSET.toLowerCase()) ??
    null
  )
}

/**
 * Fetch the latest published release from GitHub. Returns null when the
 * repository has no releases yet. Throws on network/5xx (retried).
 *
 * When the JSON API is unavailable (unauthenticated rate limit, outage) the
 * check falls back to the redirect-based variant so updates keep working.
 */
export async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const response = await withRetry(async () => {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Dietinator-Updater",
        },
      })
      if (!res.ok && res.status >= 500) {
        throw new Error(`GitHub responded (${res.status})`)
      }
      return res
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`GitHub responded (${response.status})`)
    return parseRelease(await response.json())
  } catch {
    return fetchLatestReleaseViaRedirect()
  }
}

/**
 * Extract the release tag (vX.Y.Z) from a "latest" redirect target URL,
 * for example …/releases/latest becomes …/releases/tag/v1.2.3.
 */
export function parseTagFromRedirectUrl(url: string): string | null {
  const match = /\/releases\/tag\/(v\d+\.\d+\.\d+)/.exec(url)
  return match?.[1] ?? null
}

/**
 * Quota-free fallback update check. GitHub redirects /releases/latest to the
 * newest release page, so the version can be read out of the final URL. The
 * APK asset is exposed through its stable "latest download" URL, which always
 * points at the newest signed build. Returns null when nothing resolves.
 */
export async function fetchLatestReleaseViaRedirect(): Promise<GitHubRelease | null> {
  const response = await fetch(`${RELEASE_PAGE_URL}/releases/latest`, {
    headers: { "User-Agent": "Dietinator-Updater" },
  })
  if (!response.ok) return null
  const tag = parseTagFromRedirectUrl(response.url)
  if (!tag) return null
  return {
    tag,
    name: tag,
    notes: null,
    publishedAt: null,
    prerelease: false,
    assets: [
      {
        name: ANDROID_APK_ASSET,
        downloadUrl: `${RELEASE_PAGE_URL}/releases/latest/download/${ANDROID_APK_ASSET}`,
        sizeBytes: 0,
      },
    ],
  }
}

/** Parse a GitHub releases/latest JSON payload into a GitHubRelease. */
export function parseRelease(payload: unknown): GitHubRelease {
  const root = (payload ?? {}) as Record<string, unknown>
  const rawAssets = Array.isArray(root.assets) ? root.assets : []
  const assets: GitHubReleaseAsset[] = []
  for (const raw of rawAssets) {
    const asset = raw as Record<string, unknown>
    const name = typeof asset.name === "string" ? asset.name : ""
    if (!name) continue
    assets.push({
      name,
      downloadUrl: typeof asset.browser_download_url === "string" ? asset.browser_download_url : "",
      sizeBytes: typeof asset.size === "number" ? asset.size : 0,
    })
  }
  return {
    tag: typeof root.tag_name === "string" ? root.tag_name : "",
    name: typeof root.name === "string" ? root.name : "",
    notes: typeof root.body === "string" ? root.body : null,
    publishedAt: typeof root.published_at === "string" ? root.published_at : null,
    prerelease: root.prerelease === true,
    assets,
  }
}
