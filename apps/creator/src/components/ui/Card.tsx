import type { FC, HTMLAttributes } from 'react';
import { colors, radius, shadows, spacing, type SpacingKey } from '@vibemint/design-tokens';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated';
  bordered?: boolean;
  padding?: SpacingKey;
}

export const Card: FC<CardProps> = ({
  variant = 'default',
  bordered = true,
  padding = 'lg',
  children,
  style,
  ...props
}) => {
  const isElevated = variant === 'elevated';

  return (
    <div
      style={{
        backgroundColor: isElevated ? colors.dark.surfaceElevated : colors.dark.surface,
        borderRadius: radius.lg,
        border: bordered ? `1px solid ${colors.dark.border}` : 'none',
        boxShadow: isElevated ? shadows.md : shadows.none,
        padding: spacing[padding],
        color: colors.dark.foreground,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
