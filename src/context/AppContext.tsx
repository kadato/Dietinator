import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getDatabase } from '@/db/database';
import { getSettings, updateSettings } from '@/db/settings';
import type { AppSettings } from '@/types';
import { isLoggedIn } from '@/services/yazio/auth-storage';
import { initYazioClient as setupClient } from '@/services/yazio/client';

type AppContextValue = {
  ready: boolean;
  authenticated: boolean;
  settings: AppSettings;
  yazioAvailable: boolean;
  refreshAuth: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setYazioAvailable: (value: boolean) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    calorie_goal: 2000,
    protein_goal: 150,
    carbs_goal: 200,
    fat_goal: 65,
    units: 'metric',
    yazio_sync_enabled: 0,
  });
  const [yazioAvailable, setYazioAvailable] = useState(true);

  const refreshSettings = useCallback(async () => {
    const next = await getSettings();
    setSettings(next);
  }, []);

  const refreshAuth = useCallback(async () => {
    const loggedIn = await isLoggedIn();
    setAuthenticated(loggedIn);
    if (loggedIn) {
      await setupClient();
      setYazioAvailable(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await getDatabase();
      await refreshSettings();
      await refreshAuth();
      setReady(true);
    })();
  }, [refreshAuth, refreshSettings]);

  const updateSettingsFn = useCallback(async (partial: Partial<AppSettings>) => {
    await updateSettings(partial);
    await refreshSettings();
  }, [refreshSettings]);

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      settings,
      yazioAvailable,
      refreshAuth,
      refreshSettings,
      updateSettings: updateSettingsFn,
      setYazioAvailable,
    }),
    [
      ready,
      authenticated,
      settings,
      yazioAvailable,
      refreshAuth,
      refreshSettings,
      updateSettingsFn,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
