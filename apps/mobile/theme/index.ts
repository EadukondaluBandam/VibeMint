import { themeColors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radiusPx } from '@vibemint/design-tokens';

export const theme = {
  colors: themeColors,
  typography,
  spacing,
  radius: radiusPx,
} as const;

export type Theme = typeof theme;
export * from './colors';
export * from './typography';
export * from './spacing';
