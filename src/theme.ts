export type ColorPalette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  text: string;
  textMuted: string;
  danger: string;
  warning: string;
  onWarning: string;
  border: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
};

export const darkColors: ColorPalette = {
  background: '#0f1419',
  surface: '#1a2332',
  surfaceAlt: '#243044',
  primary: '#3dd68c',
  primaryMuted: '#2a9d63',
  onPrimary: '#0f1419',
  text: '#f0f4f8',
  textMuted: '#94a3b8',
  danger: '#f87171',
  warning: '#fbbf24',
  onWarning: '#1a1a1a',
  border: '#334155',
  breakfast: '#60a5fa',
  lunch: '#f472b6',
  dinner: '#a78bfa',
  snack: '#fbbf24',
};

export const lightColors: ColorPalette = {
  background: '#f1f5f9',
  surface: '#ffffff',
  surfaceAlt: '#e2e8f0',
  primary: '#16a34a',
  primaryMuted: '#15803d',
  onPrimary: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  danger: '#dc2626',
  warning: '#d97706',
  onWarning: '#1a1a1a',
  border: '#cbd5e1',
  breakfast: '#2563eb',
  lunch: '#db2777',
  dinner: '#7c3aed',
  snack: '#ca8a04',
};

export function getColors(scheme: string | null | undefined): ColorPalette {
  return scheme === 'light' ? lightColors : darkColors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Breakpoints and max widths for tablet / desktop / web layouts. */
export const layout = {
  breakpointMedium: 600,
  breakpointWide: 900,
  maxWidthNarrow: 420,
  maxWidthContent: 720,
  maxWidthWide: 1100,
  sideTabWidth: 120,
};
