import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '@/context/ToastContext';
import type { MealType } from '@/types';
import { toDateKey } from '@/utils/date';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

function routeParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

type CreateOption = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
};

const OPTIONS: CreateOption[] = [
  {
    id: 'quick-add',
    title: 'Quick Add',
    description: 'Track calories and nutrients without creating a new item',
    icon: 'flash',
    iconColor: '#eab308',
  },
  {
    id: 'barcode-food',
    title: 'New food with barcode',
    description: 'Individual item (e.g. Raisin Bran, Kellogg\'s)',
    icon: 'nutrition',
    iconColor: '#f97316',
  },
  {
    id: 'manual-food',
    title: 'New food without barcode',
    description: 'Individual item (e.g. Bread roll)',
    icon: 'nutrition',
    iconColor: '#f97316',
  },
  {
    id: 'meal',
    title: 'New meal',
    description: 'Foods you often eat together (e.g. Cornflakes with milk)',
    icon: 'restaurant',
    iconColor: '#14b8a6',
  },
  {
    id: 'recipe',
    title: 'New recipe',
    description:
      'A recipe with optional instructions (e.g. Homemade Cream of Mushroom Soup)',
    icon: 'book',
    iconColor: '#8b5cf6',
  },
];

export default function CreateOptionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const mealType = (routeParam(params.meal) ?? 'lunch') as MealType;
  const date = routeParam(params.date) ?? toDateKey();
  const { showWarning } = useToast();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const onSelect = (id: string) => {
    switch (id) {
      case 'barcode-food':
        router.push({ pathname: '/scan', params: { meal: mealType, date } });
        break;
      case 'manual-food':
        router.back();
        break;
      case 'quick-add':
      case 'meal':
      case 'recipe':
        showWarning('This option is not available yet.', 'Coming soon');
        break;
      default:
        break;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
      </View>

      <Text style={styles.heading}>What would you like to create?</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            style={styles.card}
            onPress={() => onSelect(option.id)}
            accessibilityRole="button"
          >
            <View style={[styles.iconWrap, { backgroundColor: `${option.iconColor}22` }]}>
              <Ionicons name={option.icon} size={24} color={option.iconColor} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardDesc}>{option.description}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    heading: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    list: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardText: { flex: 1 },
    cardTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    cardDesc: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },
  });
