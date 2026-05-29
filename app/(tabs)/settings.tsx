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
import { logoutYazio } from '@/services/yazio/client';
import { loadGoalsFromYazio, syncPendingEntries } from '@/services/yazio/sync';
import { exportDiaryCsv, exportDiaryJson } from '@/services/diary';
import { clearFoodCache } from '@/db/food-cache';
import { colors, spacing } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings, refreshAuth } = useApp();
  const [calorieGoal, setCalorieGoal] = useState(String(settings.calorie_goal));
  const [proteinGoal, setProteinGoal] = useState(String(settings.protein_goal));
  const [carbsGoal, setCarbsGoal] = useState(String(settings.carbs_goal));
  const [fatGoal, setFatGoal] = useState(String(settings.fat_goal));

  const saveGoals = async () => {
    await updateSettings({
      calorie_goal: Number(calorieGoal) || 2000,
      protein_goal: Number(proteinGoal) || 150,
      carbs_goal: Number(carbsGoal) || 200,
      fat_goal: Number(fatGoal) || 65,
    });
    Alert.alert('Saved', 'Goals updated.');
  };

  const handleLogout = async () => {
    await logoutYazio();
    await refreshAuth();
    router.replace('/login');
  };

  const handleExport = async (format: 'json' | 'csv') => {
    const content = format === 'json' ? await exportDiaryJson() : await exportDiaryCsv();
    await Share.share({ message: content, title: `diary-export.${format}` });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Daily goals</Text>
      <GoalInput label="Calories (kcal)" value={calorieGoal} onChange={setCalorieGoal} />
      <GoalInput label="Protein (g)" value={proteinGoal} onChange={setProteinGoal} />
      <GoalInput label="Carbs (g)" value={carbsGoal} onChange={setCarbsGoal} />
      <GoalInput label="Fat (g)" value={fatGoal} onChange={setFatGoal} />
      <Pressable style={styles.btn} onPress={saveGoals}>
        <Text style={styles.btnText}>Save goals</Text>
      </Pressable>
      <Pressable
        style={styles.btnSecondary}
        onPress={async () => {
          await loadGoalsFromYazio();
          Alert.alert('Imported', 'Goals loaded from YAZIO.');
        }}
      >
        <Text style={styles.btnSecondaryText}>Import goals from YAZIO</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>YAZIO sync</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Sync diary to YAZIO (best-effort)</Text>
        <Switch
          value={settings.yazio_sync_enabled === 1}
          onValueChange={async (v) => {
            await updateSettings({ yazio_sync_enabled: v ? 1 : 0 });
          }}
          trackColor={{ true: colors.primary }}
        />
      </View>
      <Pressable
        style={styles.btnSecondary}
        onPress={async () => {
          const count = await syncPendingEntries();
          Alert.alert('Sync', `Synced ${count} entries.`);
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
                await clearFoodCache();
                Alert.alert('Done', 'Food cache cleared.');
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
    </ScrollView>
  );
}

function GoalInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.goalRow}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
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
  btnText: { color: colors.background, fontWeight: '700' },
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
