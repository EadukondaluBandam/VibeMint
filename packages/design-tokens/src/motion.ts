export const duration = {
  instant: '0ms',
  fast: '150ms',
  normal: '250ms',
  slow: '400ms',
} as const;

export const durationMs = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

export const easing = {
  default: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const motion = {
  duration,
  durationMs,
  easing,
} as const;
