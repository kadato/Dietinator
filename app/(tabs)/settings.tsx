import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { logoutYazio } from '@/services/yazio/client';
import { importFromYazio, syncPendingEntries } from '@/services/yazio/sync';
import { toDateKey } from '@/utils/date';
import { exportDiaryCsv, exportDiaryJson } from '@/services/diary';
import { clearFoodCache } from '@/db/food-cache';
import { PageContainer } from '@/components/PageContainer';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings, refreshAuth, refreshSettings } = useApp();
  const { showSuccess, showError } = useToast();
  const { colors } = useTheme();
  const { isMedium } = useLayout();
  const styles = useThemedStyles(createStyles);
  const [calorieGoal, setCalorieGoal] = useState(String(settings.calorie_goal));
  const [proteinGoal, setProteinGoal] = useState(String(settings.protein_goal));
  const [carbsGoal, setCarbsGoal] = useState(String(settings.carbs_goal));
  const [fatGoal, setFatGoal] = useState(String(settings.fat_goal));

  const saveGoals = async () => {
    try {
      await updateSettings({
        calorie_goal: Number(calorieGoal) || 2000,
        protein_goal: Number(proteinGoal) || 150,
        carbs_goal: Number(carbsGoal) || 200,
        fat_goal: Number(fatGoal) || 65,
      });
      showSuccess('Goals updated.', 'Saved');
    } catch (error) {
      showError(error, 'Could not save goals.');
    }
  };

  const handleLogout = async () => {
    await logoutYazio();
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer grow={false} contentStyle={styles.pageContent}>
      <Text style={styles.sectionTitle}>Daily goals</Text>
      <View style={isMedium ? styles.goalsGrid : undefined}>
        <GoalInput label="Calories (kcal)" value={calorieGoal} onChange={setCalorieGoal} styles={styles} grid={isMedium} />
        <GoalInput label="Protein (g)" value={proteinGoal} onChange={setProteinGoal} styles={styles} grid={isMedium} />
        <GoalInput label="Carbs (g)" value={carbsGoal} onChange={setCarbsGoal} styles={styles} grid={isMedium} />
        <GoalInput label="Fat (g)" value={fatGoal} onChange={setFatGoal} styles={styles} grid={isMedium} />
      </View>
      <Pressable style={styles.btn} onPress={saveGoals}>
        <Text style={styles.btnText}>Save goals</Text>
      </Pressable>
      <Pressable
        style={styles.btnSecondary}
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
        <Text style={styles.btnSecondaryText}>Import today from YAZIO</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>YAZIO sync</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Sync diary to YAZIO (best-effort)</Text>
        <Switch
          value={settings.yazio_sync_enabled === 1}
          onValueChange={async (v) => {
            try {
              await updateSettings({ yazio_sync_enabled: v ? 1 : 0 });
            } catch (error) {
              showError(error, 'Could not update sync setting.');
            }
          }}
          trackColor={{ true: colors.primary }}
        />
      </View>
      <Pressable
        style={styles.btnSecondary}
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
        <Text style={styles.btnSecondaryText}>Sync pending entries now</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Data</Text>
      <Pressable style={styles.btnSecondary} onPress={() => handleExport('json')}>
        <Text style={styles.btnSecondaryText}>Export diary (JSON)</Text>
      </Pressable>
      <Pressable style={styles.btnSecondary} onPress={() => handleExport('csv')}>
        <Text style={styles.btnSecondaryText}>Export diary (CSV)</Text>
      </Pressable>
      <Pressable
        style={styles.btnDanger}
        onPress={() => {
          Alert.alert('Clear cache?', 'Removes cached YAZIO foods.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear',
              style: 'destructive',
              onPress: async () => {
                try {
                  await clearFoodCache();
                  showSuccess('Food cache cleared.', 'Done');
                } catch (error) {
                  showError(error, 'Could not clear food cache.');
                }
              },
            },
          ]);
        }}
      >
        <Text style={styles.btnDangerText}>Clear food cache</Text>
      </Pressable>

      <Pressable style={styles.btnDanger} onPress={handleLogout}>
        <Text style={styles.btnDangerText}>Sign out</Text>
      </Pressable>
      </PageContainer>
    </ScrollView>
  );
}

function GoalInput({
  label,
  value,
  onChange,
  styles,
  grid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  styles: ReturnType<typeof createStyles>;
  grid?: boolean;
}) {
  return (
    <View style={[styles.goalRow, grid && styles.goalRowGrid]}>
      <Text style={styles.goalLabel}>{label}</Text>
      <TextInput
        style={styles.goalInput}
        keyboardType="numeric"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl * 2 },
  pageContent: { padding: spacing.md },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalRowGrid: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 260,
  },
  goalLabel: { flex: 1, color: colors.text, fontSize: 15 },
  goalInput: {
    width: 100,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.text,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  btnText: { color: colors.onPrimary, fontWeight: '700' },
  btnSecondary: {
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: { color: colors.text, fontWeight: '600' },
  btnDanger: {
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
  },
  btnDangerText: { color: colors.danger, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowLabel: { flex: 1, color: colors.text, fontSize: 14, marginRight: spacing.md },
});
