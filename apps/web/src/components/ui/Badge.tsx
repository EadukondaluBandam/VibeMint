import type { FC, HTMLAttributes } from 'react';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge: FC<BadgeProps> = ({ variant = 'default', children, style, ...props }) => {
  const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
    default: {
      backgroundColor: colors.dark.surfaceMuted,
      color: colors.dark.foreground,
      border: `1px solid ${colors.dark.border}`,
    },
    success: {
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      color: colors.dark.success,
      border: '1px solid rgba(34, 197, 94, 0.3)',
    },
    warning: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      color: colors.dark.warning,
      border: '1px solid rgba(245, 158, 11, 0.3)',
    },
    error: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      color: colors.dark.error,
      border: '1px solid rgba(239, 68, 68, 0.3)',
    },
    info: {
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      color: colors.dark.info,
      border: '1px solid rgba(56, 189, 248, 0.3)',
    },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `0.125rem ${spacing.sm}`,
        borderRadius: radius.full,
        fontSize: '0.75rem',
        fontWeight: fontWeights.medium,
        lineHeight: 1.25,
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
};
