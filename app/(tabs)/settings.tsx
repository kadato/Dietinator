import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { logoutYazio, getYazioProfile } from '@/services/yazio/client';
import { importFromYazio, syncPendingEntries } from '@/services/yazio/sync';
import { toDateKey } from '@/utils/date';
import { exportDiaryCsv, exportDiaryJson } from '@/services/diary';
import { clearFoodCache } from '@/db/food-cache';
import { PageContainer } from '@/components/PageContainer';
import { SettingsSection } from '@/components/SettingsSection';
import { FoodDatabaseCountryPicker } from '@/components/FoodDatabaseCountryPicker';
import {
  getFoodDatabaseCountryLabel,
  resolveFoodDatabaseCountry,
} from '@/utils/food-database-country';
import { useTheme } from '@/hooks/useTheme';
import { confirmAction } from '@/utils/confirm';
import { Box } from '@ui/box';
import { Text } from '@ui/text';
import { Input, InputField } from '@ui/input';
import { Button, ButtonText } from '@ui/button';
import { Switch } from '@ui/switch';

function SettingsRow({
  children,
  bordered = true,
}: {
  children: ReactNode;
  bordered?: boolean;
}) {
  return (
    <Box className={`px-4 py-3 ${bordered ? 'border-b border-outline-100' : ''}`}>{children}</Box>
  );
}

function GoalInput({
  label,
  value,
  onChange,
  bordered = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  bordered?: boolean;
}) {
  return (
    <SettingsRow bordered={bordered}>
      <Box className="flex-row items-center">
        <Text size="md" className="flex-1 text-typography-900">
          {label}
        </Text>
        <Input size="sm" variant="outline" className="w-[100px]">
          <InputField
            keyboardType="numeric"
            value={value}
            onChangeText={onChange}
            className="text-right"
          />
        </Input>
      </Box>
    </SettingsRow>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings, refreshAuth, refreshSettings } = useApp();
  const { showSuccess, showError } = useToast();
  const { colors } = useTheme();
  const [calorieGoal, setCalorieGoal] = useState(String(settings.calorie_goal));
  const [proteinGoal, setProteinGoal] = useState(String(settings.protein_goal));
  const [carbsGoal, setCarbsGoal] = useState(String(settings.carbs_goal));
  const [fatGoal, setFatGoal] = useState(String(settings.fat_goal));
  const [goalError, setGoalError] = useState<string | null>(null);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [profileCountry, setProfileCountry] = useState<string | null>(null);

  // Keep local fields in step when settings change elsewhere (e.g. YAZIO import).
  useEffect(() => {
    setCalorieGoal(String(settings.calorie_goal));
    setProteinGoal(String(settings.protein_goal));
    setCarbsGoal(String(settings.carbs_goal));
    setFatGoal(String(settings.fat_goal));
  }, [
    settings.calorie_goal,
    settings.protein_goal,
    settings.carbs_goal,
    settings.fat_goal,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getYazioProfile();
        if (!cancelled) {
          setProfileCountry(profile?.food_database_country ?? null);
        }
      } catch {
        if (!cancelled) setProfileCountry(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveCountry = resolveFoodDatabaseCountry(
    settings.food_database_country,
    profileCountry,
  );
  const countryUsesProfileDefault = !settings.food_database_country?.trim();

  const saveGoals = async () => {
    const values = {
      calorie_goal: Number(calorieGoal),
      protein_goal: Number(proteinGoal),
      carbs_goal: Number(carbsGoal),
      fat_goal: Number(fatGoal),
    };
    if (
      !values.calorie_goal ||
      values.calorie_goal <= 0 ||
      !values.protein_goal ||
      values.protein_goal <= 0 ||
      !values.carbs_goal ||
      values.carbs_goal <= 0 ||
      !values.fat_goal ||
      values.fat_goal <= 0
    ) {
      setGoalError('All goals must be positive numbers.');
      return;
    }
    setGoalError(null);
    try {
      await updateSettings(values);
      showSuccess('Goals updated.', 'Saved');
    } catch (error) {
      showError(error, 'Could not save goals.');
    }
  };

  const handleLogout = async () => {
    try {
      await logoutYazio();
    } catch (error) {
      showError(error, 'Could not clear stored credentials.', 'Sign out');
    }
    await refreshAuth();
    router.replace('/login');
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const content = format === 'json' ? await exportDiaryJson() : await exportDiaryCsv();
      await Share.share({ message: content, title: `diary-export.${format}` });
    } catch (error) {
      showError(error, 'Could not export diary.');
    }
  };

  return (
    <ScrollView className="flex-1 bg-background-0" contentContainerClassName="pb-16">
      <PageContainer grow={false} contentStyle={{ padding: 16 }}>
        <Text size="2xl" bold className="text-typography-900 mb-1">
          Settings
        </Text>
        <Text size="sm" className="text-typography-500 mb-6">
          Goals, sync, and your data
        </Text>

        <SettingsSection title="Daily goals">
          <GoalInput label="Calories (kcal)" value={calorieGoal} onChange={setCalorieGoal} />
          <GoalInput label="Protein (g)" value={proteinGoal} onChange={setProteinGoal} />
          <GoalInput label="Carbs (g)" value={carbsGoal} onChange={setCarbsGoal} />
          <GoalInput label="Fat (g)" value={fatGoal} onChange={setFatGoal} bordered={false} />
          <View className="p-4 gap-2 border-t border-outline-100">
            {goalError ? (
              <Text size="sm" bold className="mb-1" style={{ color: colors.danger }}>
                {goalError}
              </Text>
            ) : null}
            <Button size="md" onPress={saveGoals}>
              <ButtonText>Save goals</ButtonText>
            </Button>
            <Button
              size="md"
              variant="outline"
              action="secondary"
              onPress={async () => {
                try {
                  const { imported, skipped, failed } = await importFromYazio(toDateKey());
                  await refreshSettings();
                  const parts = ['Goals updated.'];
                  if (imported > 0) {
                    parts.push(
                      imported === 1
                        ? 'Imported 1 food for today.'
                        : `Imported ${imported} foods for today.`,
                    );
                  } else if (skipped > 0 && failed === 0) {
                    parts.push("Today's foods are already up to date.");
                  }
                  if (failed > 0) {
                    parts.push(`${failed} item(s) could not be loaded.`);
                  }
                  showSuccess(parts.join(' '), 'Imported from YAZIO');
                } catch (error) {
                  showError(error, 'Could not import from YAZIO.');
                }
              }}
            >
              <ButtonText>Import today from YAZIO</ButtonText>
            </Button>
          </View>
        </SettingsSection>

        <SettingsSection title="Food search">
          <Pressable
            className="flex-row items-center px-4 py-3.5 gap-2 active:opacity-80"
            onPress={() => setCountryPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Change food database country"
          >
            <Box className="h-9 w-9 items-center justify-center rounded-full bg-background-muted">
              <Ionicons name="globe-outline" size={18} color={colors.primary} />
            </Box>
            <Box className="flex-1">
              <Text size="sm" className="text-typography-900">
                Food database country
              </Text>
              <Text size="md" className="text-typography-500 mt-0.5">
                {getFoodDatabaseCountryLabel(effectiveCountry)}
              </Text>
              {countryUsesProfileDefault && profileCountry ? (
                <Text size="xs" className="text-typography-500 mt-1">
                  Using your YAZIO profile until you pick a country here.
                </Text>
              ) : null}
            </Box>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </SettingsSection>
        <FoodDatabaseCountryPicker
          visible={countryPickerOpen}
          selectedCode={effectiveCountry}
          onClose={() => setCountryPickerOpen(false)}
          onSelect={async (code) => {
            try {
              await updateSettings({ food_database_country: code });
              setProfileCountry(null);
              showSuccess(
                `Search now uses ${getFoodDatabaseCountryLabel(code)}.`,
                'Food database',
              );
            } catch (error) {
              showError(error, 'Could not save food database country.');
            }
          }}
        />

        <SettingsSection title="Units">
          <SettingsRow>
            <Box className="flex-row items-center justify-between">
              <Text size="sm" className="flex-1 text-typography-900 mr-4">
                Units for weight and water
              </Text>
              <Switch
                value={settings.units !== 'imperial'}
                accessibilityLabel="Units for weight and water"
                onValueChange={async (v) => {
                  try {
                    await updateSettings({ units: v ? 'metric' : 'imperial' });
                  } catch (error) {
                    showError(error, 'Could not update units.');
                  }
                }}
              />
            </Box>
            <Text size="xs" className="text-typography-500 mt-1">
              {settings.units === 'imperial' ? 'Imperial (lb, fl oz)' : 'Metric (kg, L)'}
            </Text>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="YAZIO sync">
          <SettingsRow>
            <Box className="flex-row items-center justify-between">
              <Text size="sm" className="flex-1 text-typography-900 mr-4">
                Sync diary to YAZIO (best-effort)
              </Text>
              <Switch
                value={settings.yazio_sync_enabled === 1}
                accessibilityLabel="Sync diary to YAZIO"
                onValueChange={async (v) => {
                  try {
                    await updateSettings({ yazio_sync_enabled: v ? 1 : 0 });
                  } catch (error) {
                    showError(error, 'Could not update sync setting.');
                  }
                }}
              />
            </Box>
          </SettingsRow>
          <View className="p-4 border-t border-outline-100">
            <Button
              size="md"
              variant="outline"
              action="secondary"
              onPress={async () => {
                try {
                  const count = await syncPendingEntries();
                  showSuccess(
                    count === 1 ? 'Synced 1 entry.' : `Synced ${count} entries.`,
                    'Sync',
                  );
                } catch (error) {
                  showError(error, 'Could not sync entries to YAZIO.');
                }
              }}
            >
              <ButtonText>Sync pending entries now</ButtonText>
            </Button>
          </View>
        </SettingsSection>

        <SettingsSection title="Data">
          <View className="p-4 gap-2">
            <Button size="md" variant="outline" action="secondary" onPress={() => handleExport('json')}>
              <ButtonText>Export diary (JSON)</ButtonText>
            </Button>
            <Button size="md" variant="outline" action="secondary" onPress={() => handleExport('csv')}>
              <ButtonText>Export diary (CSV)</ButtonText>
            </Button>
            <Button
              size="md"
              variant="outline"
              action="negative"
              onPress={() => {
                confirmAction({
                  title: 'Clear cache?',
                  message: 'Removes cached YAZIO foods.',
                  confirmLabel: 'Clear',
                  onConfirm: async () => {
                    try {
                      await clearFoodCache();
                      showSuccess('Food cache cleared.', 'Done');
                    } catch (error) {
                      showError(error, 'Could not clear food cache.');
                    }
                  },
                });
              }}
            >
              <ButtonText>Clear food cache</ButtonText>
            </Button>
          </View>
        </SettingsSection>

        <Button size="lg" variant="outline" action="negative" onPress={handleLogout}>
          <ButtonText>Sign out</ButtonText>
        </Button>
      </PageContainer>
    </ScrollView>
  );
}
