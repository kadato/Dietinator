import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { logFood } from '@/services/diary';
import { getFoodRemote } from '@/services/yazio/foods';
import type { MealType, SearchFoodResult } from '@/types';
import { scaleNutrients } from '@/utils/nutrients';
import { PageContainer } from '@/components/PageContainer';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

export default function AddFoodScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{
    meal: string;
    date: string;
    productId?: string;
    name?: string;
    kcal?: string;
    amount?: string;
    unit?: string;
    protein?: string;
    carbs?: string;
    fat?: string;
    serving?: string;
    servingQty?: string;
  }>();

  const mealType = (params.meal ?? 'lunch') as MealType;
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  const initialFood = useMemo<SearchFoodResult | null>(() => {
    if (!params.productId || !params.name) return null;
    const baseAmount = Number(params.amount) || 100;
    return {
      product_id: params.productId,
      name: params.name,
      producer: '',
      nutrients: {
        kcal: Number(params.kcal) || 0,
        protein: Number(params.protein) || 0,
        carbs: Number(params.carbs) || 0,
        fat: Number(params.fat) || 0,
      },
      serving: {
        serving: params.serving ?? 'portion',
        amount: baseAmount,
        serving_quantity: Number(params.servingQty) || baseAmount,
      },
      base_unit: params.unit ?? 'g',
      is_verified: true,
    };
  }, [params]);

  const [food, setFood] = useState<SearchFoodResult | null>(initialFood);
  const [amount, setAmount] = useState(String(initialFood?.serving.amount ?? 100));
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    if (!food) return null;
    const amt = Number(amount) || 0;
    return scaleNutrients(food.nutrients, food.serving.amount, amt);
  }, [food, amount]);

  const handleSave = async () => {
    if (!food) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive amount.');
      return;
    }
    setSaving(true);
    try {
      let resolved = food;
      if (params.productId && !food.nutrients.kcal) {
        const remote = await getFoodRemote(params.productId);
        if (remote) resolved = remote;
      }
      await logFood({ date, mealType, food: resolved, amount: amt });
      router.back();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not save entry.');
    } finally {
      setSaving(false);
    }
  };

  if (!food) {
    return (
      <View style={styles.center}>
        <PageContainer variant="narrow" contentStyle={styles.centerContent}>
          <Text style={styles.message}>No food selected.</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </PageContainer>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer grow={false} variant="narrow" contentStyle={styles.page}>
      <Text style={styles.title}>{food.name}</Text>
      <Text style={styles.subtitle}>
        {mealType} · {date}
      </Text>

      <Text style={styles.label}>Amount ({food.base_unit})</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      {preview && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Nutrition</Text>
          <Text style={styles.previewRow}>{preview.kcal} kcal</Text>
          <Text style={styles.previewRow}>
            P {preview.protein}g · C {preview.carbs}g · F {preview.fat}g
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.saveBtn, saving && styles.saveDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Add to diary'}</Text>
      </Pressable>

      <Pressable style={styles.cancel} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
      </PageContainer>
    </ScrollView>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  page: { padding: spacing.lg },
  center: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  message: { color: colors.text },
  link: { color: colors.primary, marginTop: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    fontSize: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewTitle: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  previewRow: { color: colors.text, fontSize: 16, marginBottom: spacing.xs },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  cancel: { alignItems: 'center', marginTop: spacing.lg },
  cancelText: { color: colors.textMuted },
});
