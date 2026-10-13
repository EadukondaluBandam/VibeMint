export interface ColorTokens {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  background: string;
  foreground: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  muted: string;
  mutedForeground: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export const darkThemeColors: ColorTokens = {
  primary: '#10b981',
  primaryForeground: '#022c22',
  secondary: '#6366f1',
  secondaryForeground: '#ffffff',
  background: '#0b0f17',
  foreground: '#f8fafc',
  surface: '#111827',
  surfaceElevated: '#1f2937',
  surfaceMuted: '#141d2e',
  border: '#1e293b',
  borderStrong: '#334155',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#38bdf8',
};

export const lightThemeColors: ColorTokens = {
  primary: '#059669',
  primaryForeground: '#ffffff',
  secondary: '#4f46e5',
  secondaryForeground: '#ffffff',
  background: '#f8fafc',
  foreground: '#0f172a',
  surface: '#ffffff',
  surfaceElevated: '#f1f5f9',
  surfaceMuted: '#e2e8f0',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  info: '#0284c7',
};

export const colors = {
  dark: darkThemeColors,
  light: lightThemeColors,
} as const;

export type ThemeMode = keyof typeof colors;
