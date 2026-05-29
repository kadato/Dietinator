import { useMemo } from 'react';
import type { ColorPalette } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

export function useThemedStyles<T>(factory: (colors: ColorPalette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
