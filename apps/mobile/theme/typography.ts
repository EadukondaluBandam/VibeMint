import { fontWeights } from '@vibemint/design-tokens';

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: fontWeights.bold },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: fontWeights.bold },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: fontWeights.semiBold },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: fontWeights.semiBold },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: fontWeights.regular },
  body: { fontSize: 14, lineHeight: 20, fontWeight: fontWeights.regular },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: fontWeights.regular },
  label: { fontSize: 14, lineHeight: 20, fontWeight: fontWeights.medium },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeights.regular },
} as const;
