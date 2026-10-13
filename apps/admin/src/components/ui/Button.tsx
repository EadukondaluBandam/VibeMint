import type { ButtonHTMLAttributes, FC } from 'react';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  style,
  ...props
}) => {
  const isDisabled = disabled || loading;

  const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
    sm: {
      padding: `${spacing.xs} ${spacing.sm}`,
      fontSize: '0.8125rem',
      height: '32px',
    },
    md: {
      padding: `${spacing.sm} ${spacing.lg}`,
      fontSize: '0.875rem',
      height: '40px',
    },
    lg: {
      padding: `${spacing.md} ${spacing.xl}`,
      fontSize: '1rem',
      height: '48px',
    },
  };

  const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      backgroundColor: colors.dark.primary,
      color: colors.dark.primaryForeground,
      border: 'none',
    },
    secondary: {
      backgroundColor: colors.dark.secondary,
      color: colors.dark.secondaryForeground,
      border: 'none',
    },
    outline: {
      backgroundColor: 'transparent',
      color: colors.dark.foreground,
      border: `1px solid ${colors.dark.borderStrong}`,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.dark.foreground,
      border: 'none',
    },
    destructive: {
      backgroundColor: colors.dark.error,
      color: '#ffffff',
      border: 'none',
    },
  };

  return (
    <button
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderRadius: radius.md,
        fontWeight: fontWeights.semiBold,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'opacity 150ms ease, transform 150ms ease',
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
};
