import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking, Platform } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { UpdateDialog } from '@/components/UpdateDialog';
import {
  fetchLatestRelease,
  getApkAsset,
  getCurrentVersion,
  isNewerThan,
  type GitHubRelease,
} from '@/services/updates';

type UpdateContextValue = {
  checking: boolean;
  /** Check GitHub for a newer release; manual checks surface toast feedback. */
  checkForUpdates: (options?: { manual?: boolean }) => Promise<void>;
  dismissDialog: () => void;
  /** Turns off the startup check and closes the dialog. */
  neverAskAgain: () => Promise<void>;
  /** Opens the signed APK download for the announced release. */
  downloadUpdate: () => void;
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

/** Delay before the silent startup check, so boot and first paint come first. */
const AUTO_CHECK_DELAY_MS = 4000;

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useApp();
  const { showSuccess, showInfo, showWarning, showError } = useToast();
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const autoCheckedRef = useRef(false);

  const checkForUpdates = useCallback(
    async (options?: { manual?: boolean }) => {
      const manual = options?.manual ?? false;
      setChecking(true);
      try {
        const latest = await fetchLatestRelease();
        if (!latest) {
          if (manual) showWarning('No releases have been published yet.', 'No update');
          return;
        }
        if (!isNewerThan(latest.tag, getCurrentVersion())) {
          if (manual) {
            showSuccess(`You're up to date (${getCurrentVersion()}).`, 'Updates');
          }
          return;
        }
        setRelease(latest);
        setDialogOpen(true);
      } catch (error) {
        if (manual) showError(error, 'Could not check for updates.');
      } finally {
        setChecking(false);
      }
    },
    [showError, showSuccess, showWarning],
  );

  // Silent check once per session, on Android only, when enabled in settings.
  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      settings.update_check_enabled !== 1 ||
      autoCheckedRef.current
    ) {
      return;
    }
    autoCheckedRef.current = true;
    const timer = setTimeout(() => {
      checkForUpdates().catch(() => undefined);
    }, AUTO_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [checkForUpdates, settings.update_check_enabled]);

  const dismissDialog = useCallback(() => setDialogOpen(false), []);

  const neverAskAgain = useCallback(async () => {
    setDialogOpen(false);
    try {
      await updateSettings({ update_check_enabled: 0 });
    } catch {
      // Best-effort — the dialog is closed either way.
    }
  }, [updateSettings]);

  const downloadUpdate = useCallback(() => {
    if (!release) return;
    const asset = getApkAsset(release);
    if (!asset?.downloadUrl) {
      showWarning('This release has no Android APK attached.', 'Download');
      return;
    }
    Linking.openURL(asset.downloadUrl).catch(() => undefined);
    showInfo(
      'The download starts in your browser — install the APK when it finishes.',
      'Update',
    );
  }, [release, showInfo, showWarning]);

  const value = useMemo(
    () => ({
      checking,
      checkForUpdates,
      dismissDialog,
      neverAskAgain,
      downloadUpdate,
    }),
    [checking, checkForUpdates, dismissDialog, neverAskAgain, downloadUpdate],
  );

  return (
    <UpdateContext.Provider value={value}>
      {children}
      {dialogOpen && release ? (
        <UpdateDialog
          release={release}
          currentVersion={getCurrentVersion()}
          onClose={dismissDialog}
          onNeverAsk={neverAskAgain}
          onDownload={downloadUpdate}
        />
      ) : null}
    </UpdateContext.Provider>
  );
}

export function useUpdates(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error('useUpdates must be used within UpdateProvider');
  return ctx;
}
