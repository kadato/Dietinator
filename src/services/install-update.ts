import { Platform } from "react-native"
import { Directory, File, Paths } from "expo-file-system"
import * as IntentLauncher from "expo-intent-launcher"
import type { DownloadProgress } from "expo-file-system"

/** Where the downloaded APK is cached on Android (inside the FileProvider root). */
export const APK_CACHE_DIR_NAME = "updates"

/** File name the release pipeline publishes (`ANDROID_APK_ASSET`). */
export const APK_FILE_NAME = "Dietinator-Android.apk"

/** Intent action that hands the APK to the system package installer. */
export const INSTALL_PACKAGE_ACTION = "android.intent.action.INSTALL_PACKAGE"

/** `Intent.FLAG_GRANT_READ_URI_PERMISSION`, which lets the installer read our FileProvider URI. */
export const FLAG_GRANT_READ_URI_PERMISSION = 0x1

/**
 * True on Android where the app can download the APK itself and hand it to
 * the system package installer. Everywhere else the update falls back to
 * opening the download page in the browser.
 */
export function supportsInAppInstall(platform: string = Platform.OS): boolean {
  return platform === "android"
}

/**
 * Download the release APK into the app cache (idempotent: a leftover file
 * from an earlier attempt is overwritten). `onProgress` reports bytes written
 * so callers can show download progress.
 */
export async function downloadUpdateApk(
  url: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<File> {
  const dir = new Directory(Paths.cache, APK_CACHE_DIR_NAME)
  dir.create({ intermediates: true, idempotent: true })
  const target = new File(dir, APK_FILE_NAME)
  return File.downloadFileAsync(url, target, { idempotent: true, onProgress })
}

/**
 * Hand the downloaded APK to the system package installer. The file must live
 * under the app's files/cache directory so the FileProvider can mint a
 * `content://` URI the installer is allowed to read.
 */
export async function installApk(file: File): Promise<void> {
  if (!file.contentUri) {
    throw new Error("Installing the update failed: the APK is not shareable.")
  }
  await IntentLauncher.startActivityAsync(INSTALL_PACKAGE_ACTION, {
    data: file.contentUri,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  })
}
