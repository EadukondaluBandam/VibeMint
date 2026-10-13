export const fontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const;

export const fontFamilies = {
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as const;

export interface TypographyToken {
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  letterSpacing?: string;
}

export const typography = {
  Display: {
    fontSize: '2.5rem',
    lineHeight: '3rem',
    fontWeight: fontWeights.bold,
    letterSpacing: '-0.02em',
  },
  H1: {
    fontSize: '2rem',
    lineHeight: '2.5rem',
    fontWeight: fontWeights.bold,
    letterSpacing: '-0.015em',
  },
  H2: {
    fontSize: '1.5rem',
    lineHeight: '2rem',
    fontWeight: fontWeights.semiBold,
    letterSpacing: '-0.01em',
  },
  H3: {
    fontSize: '1.25rem',
    lineHeight: '1.75rem',
    fontWeight: fontWeights.semiBold,
  },
  H4: {
    fontSize: '1.125rem',
    lineHeight: '1.5rem',
    fontWeight: fontWeights.semiBold,
  },
  BodyLarge: {
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: fontWeights.regular,
  },
  Body: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
    fontWeight: fontWeights.regular,
  },
  BodySmall: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: fontWeights.regular,
  },
  Label: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: fontWeights.medium,
  },
  Caption: {
    fontSize: '0.75rem',
    lineHeight: '1rem',
    fontWeight: fontWeights.regular,
  },
  Numeric: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
    fontWeight: fontWeights.semiBold,
  },
} as const;
