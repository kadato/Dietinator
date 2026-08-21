import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Linking, Platform } from "react-native"
import type { File } from "expo-file-system"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { UpdateDialog } from "@/components/UpdateDialog"
import {
  fetchLatestRelease,
  getApkAsset,
  getCurrentVersion,
  isNewerThan,
  type GitHubRelease,
} from "@/services/updates"
import { installApk, downloadUpdateApk, supportsInAppInstall } from "@/services/install-update"

type UpdateContextValue = {
  checking: boolean
  /** True while the APK downloads in the background of the dialog. */
  downloading: boolean
  /** Download progress 0..1, null when unknown. */
  downloadProgress: number | null
  /** Check GitHub for a newer release; manual checks surface toast feedback. */
  checkForUpdates: (options?: { manual?: boolean }) => Promise<void>
  dismissDialog: () => void
  /** Turns off the startup check and closes the dialog. */
  neverAskAgain: () => Promise<void>
  /**
   * Downloads and installs the announced release. On Android the APK is
   * fetched in-app and handed to the system package installer; elsewhere it
   * falls back to opening the download page in the browser.
   */
  downloadUpdate: () => Promise<void>
}

const UpdateContext = createContext<UpdateContextValue | null>(null)

/** Delay before the silent startup check, so boot and first paint come first. */
const AUTO_CHECK_DELAY_MS = 4000

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useApp()
  const { showSuccess, showInfo, showWarning, showError } = useToast()
  const [release, setRelease] = useState<GitHubRelease | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const autoCheckedRef = useRef(false)

  const checkForUpdates = useCallback(
    async (options?: { manual?: boolean }) => {
      const manual = options?.manual ?? false
      setChecking(true)
      try {
        const latest = await fetchLatestRelease()
        if (!latest) {
          if (manual) showWarning("No releases have been published yet.", "No update")
          return
        }
        if (!isNewerThan(latest.tag, getCurrentVersion())) {
          if (manual) {
            showSuccess(`You're up to date (${getCurrentVersion()}).`, "Updates")
          }
          return
        }
        setRelease(latest)
        setDialogOpen(true)
      } catch (error) {
        if (manual) showError(error, "Could not check for updates.")
      } finally {
        setChecking(false)
      }
    },
    [showError, showSuccess, showWarning],
  )

  // Silent check once per session, on Android only, when enabled in settings.
  useEffect(() => {
    if (
      Platform.OS !== "android" ||
      settings.update_check_enabled !== 1 ||
      autoCheckedRef.current
    ) {
      return
    }
    autoCheckedRef.current = true
    const timer = setTimeout(() => {
      checkForUpdates().catch(() => undefined)
    }, AUTO_CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [checkForUpdates, settings.update_check_enabled])

  const dismissDialog = useCallback(() => setDialogOpen(false), [])

  const neverAskAgain = useCallback(async () => {
    setDialogOpen(false)
    try {
      await updateSettings({ update_check_enabled: 0 })
    } catch {
      // Best-effort. The dialog is closed either way.
    }
  }, [updateSettings])

  const downloadUpdate = useCallback(async () => {
    if (!release) return
    const asset = getApkAsset(release)
    if (!asset?.downloadUrl) {
      showWarning("This release has no Android APK attached.", "Download")
      return
    }

    // Outside Android we cannot install the APK in-app, so open the browser.
    if (!supportsInAppInstall()) {
      Linking.openURL(asset.downloadUrl).catch(() => undefined)
      showInfo("The download starts in your browser. Install the APK when it finishes.", "Update")
      return
    }

    setDownloading(true)
    setDownloadProgress(null)
    let file: File
    try {
      file = await downloadUpdateApk(asset.downloadUrl, (progress) => {
        if (progress.totalBytes > 0) {
          setDownloadProgress(progress.bytesWritten / progress.totalBytes)
        }
      })
    } catch (error) {
      showError(error, "Could not download the update.")
      setDownloading(false)
      setDownloadProgress(null)
      return
    }
    setDownloading(false)
    setDownloadProgress(null)
    setDialogOpen(false)
    showInfo("Update downloaded. Confirm the install to finish.", "Update")
    installApk(file).catch((error) => showError(error, "Could not open the installer."))
  }, [release, showError, showInfo, showWarning])

  const value = useMemo(
    () => ({
      checking,
      downloading,
      downloadProgress,
      checkForUpdates,
      dismissDialog,
      neverAskAgain,
      downloadUpdate,
    }),
    [
      checking,
      downloadProgress,
      downloading,
      checkForUpdates,
      dismissDialog,
      neverAskAgain,
      downloadUpdate,
    ],
  )

  return (
    <UpdateContext.Provider value={value}>
      {children}
      {dialogOpen && release ? (
        <UpdateDialog
          release={release}
          currentVersion={getCurrentVersion()}
          downloading={downloading}
          downloadProgress={downloadProgress}
          onClose={dismissDialog}
          onNeverAsk={neverAskAgain}
          onDownload={downloadUpdate}
        />
      ) : null}
    </UpdateContext.Provider>
  )
}

export function useUpdates(): UpdateContextValue {
  const ctx = useContext(UpdateContext)
  if (!ctx) throw new Error("useUpdates must be used within UpdateProvider")
  return ctx
}
