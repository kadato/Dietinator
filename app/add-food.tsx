import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { logFood } from '@/services/diary';
import { getFoodRemote } from '@/services/yazio/foods';
import { getFoodById } from '@/db/food-cache';
import type { FoodServing, MealType, SearchFoodResult } from '@/types';
import {
  isPerGramNutrients,
  nutrientsForAmount,
  resolveNutrientsRefAmount,
} from '@/utils/nutrients';
import {
  formatNutrientsServingLabel,
  formatServingOption,
} from '@/utils/food-display';
import { NutritionFactsCard } from '@/components/NutritionFactsCard';
import { PageContainer } from '@/components/PageContainer';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/context/ToastContext';
import { spacing, type ColorPalette } from '@/theme';

function routeParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function AddFoodScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { showError, showWarning } = useToast();
  const params = useLocalSearchParams<{
    meal: string;
    date: string;
    productId?: string;
  }>();

  const mealType = (routeParam(params.meal) ?? 'lunch') as MealType;
  const date = routeParam(params.date) ?? new Date().toISOString().slice(0, 10);
  const productId = routeParam(params.productId);

  useEffect(() => {
    if (!productId) {
      router.replace({
        pathname: '/(tabs)/search',
        params: { meal: mealType, date },
      });
    }
  }, [productId, mealType, date, router]);

  const [food, setFood] = useState<SearchFoodResult | null>(null);
  const [loadingFood, setLoadingFood] = useState(Boolean(productId));
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!productId) {
      setLoadingFood(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingFood(true);
      try {
        let resolved =
          (await getFoodRemote(productId)) ?? (await getFoodById(productId));
        if (
          resolved &&
          isPerGramNutrients(resolved.nutrients, resolved.base_unit || 'g')
        ) {
          const refreshed = await getFoodRemote(productId);
          if (refreshed) resolved = refreshed;
        }
        if (!cancelled && resolved) {
          const initialServing = resolved.servings?.[0] ?? resolved.serving;
          const unit = resolved.base_unit || 'g';
          const ref = resolveNutrientsRefAmount(
            resolved.nutrients,
            resolved.serving,
            unit,
          );
          const perHundred = Boolean(resolved.servings?.length) && ref === 100;
          setFood({
            ...resolved,
            serving: {
              serving: initialServing.serving,
              amount: initialServing.amount,
              serving_quantity: perHundred
                ? ref
                : initialServing.serving_quantity > 0
                  ? initialServing.serving_quantity
                  : initialServing.amount,
            },
          });
          setAmount(String(initialServing.amount));
        }
      } catch {
        if (!cancelled) {
          showError(
            new Error('Could not load food details'),
            'Try again or pick another item.',
          );
        }
      } finally {
        if (!cancelled) setLoadingFood(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, showError]);

  const servingOptions = useMemo((): FoodServing[] => {
    if (!food) return [];
    if (food.servings?.length) return food.servings;
    return [food.serving];
  }, [food]);

  const preview = useMemo(() => {
    if (!food) return null;
    const amt = Number(amount) || 0;
    if (amt <= 0) return null;
    return nutrientsForAmount(
      food.nutrients,
      food.serving,
      amt,
      food.base_unit,
    );
  }, [food, amount]);

  const selectServing = useCallback(
    (option: FoodServing) => {
      if (!food) return;
      const unit = food.base_unit || 'g';
      const ref = resolveNutrientsRefAmount(food.nutrients, food.serving, unit);
      const perHundredProduct = Boolean(food.servings?.length) && ref === 100;
      setFood({
        ...food,
        serving: {
          serving: option.serving,
          amount: option.amount,
          serving_quantity: perHundredProduct
            ? ref
            : option.serving_quantity > 0
              ? option.serving_quantity
              : option.amount,
        },
      });
      setAmount(String(option.amount));
    },
    [food],
  );

  const handleSave = async () => {
    if (!food) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      showWarning('Enter a positive amount.', 'Invalid amount');
      return;
    }
    setSaving(true);
    try {
      let resolved = food;
      if (!resolved.nutrients.kcal && productId) {
        const remote = await getFoodRemote(productId);
        if (remote) resolved = remote;
      }
      await logFood({ date, mealType, food: resolved, amount: amt });
      router.back();
    } catch (error) {
      showError(error, 'Could not save entry.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingFood) {
    return (
      <View style={styles.center}>
        <PageContainer variant="narrow" contentStyle={styles.centerContent}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading food details…</Text>
        </PageContainer>
      </View>
    );
  }

  if (!food) {
    return (
      <View style={styles.center}>
        <PageContainer variant="narrow" contentStyle={styles.centerContent}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>
            {productId ? 'Could not load this food.' : 'Opening food search…'}
          </Text>
          {productId ? (
            <Pressable onPress={() => router.back()}>
              <Text style={styles.link}>Go back</Text>
            </Pressable>
          ) : null}
        </PageContainer>
      </View>
    );
  }

  const unit = food.base_unit || 'g';
  const selectedServingKey = `${food.serving.serving}-${food.serving.amount}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer grow={false} variant="narrow" contentStyle={styles.page}>
        <Text style={styles.title}>{food.name}</Text>
        {food.producer ? (
          <Text style={styles.producer}>{food.producer}</Text>
        ) : null}
        <Text style={styles.subtitle}>
          {mealType} · {date}
        </Text>

        <Text style={styles.sectionLabel}>Serving size</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.servingRow}
        >
          {servingOptions.map((option) => {
            const key = `${option.serving}-${option.amount}`;
            const selected = key === selectedServingKey;
            return (
              <Pressable
                key={key}
                style={[styles.servingChip, selected && styles.servingChipSelected]}
                onPress={() => selectServing(option)}
              >
                <Text
                  style={[
                    styles.servingChipText,
                    selected && styles.servingChipTextSelected,
                  ]}
                >
                  {formatServingOption(option, unit)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>Amount ({unit})</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        {preview && (
          <NutritionFactsCard
            nutrients={preview}
            servingLabel={formatNutrientsServingLabel(food, Number(amount) || 0)}
          />
        )}

        <Pressable
          style={[styles.saveBtn, saving && styles.saveDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveText}>
            {saving ? 'Saving...' : 'Add to diary'}
          </Text>
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
      gap: spacing.md,
    },
    loadingText: { color: colors.textMuted, fontSize: 14 },
    message: { color: colors.text },
    link: { color: colors.primary, marginTop: spacing.md },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    producer: {
      fontSize: 15,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    subtitle: {
      color: colors.textMuted,
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    servingRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingBottom: spacing.md,
    },
    servingChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    servingChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    servingChipText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    servingChipTextSelected: {
      color: colors.onPrimary,
    },
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
