import type { FC, ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { theme } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
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

  const containerStyles: (ViewStyle | false | undefined)[] = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    isDisabled && styles.disabled,
    style as ViewStyle,
  ];

  const textStyles: (TextStyle | false | undefined)[] = [
    styles.textBase,
    styles[`textSize_${size}`],
    styles[`textVariant_${variant}`],
  ];

  return (
    <TouchableOpacity disabled={isDisabled} activeOpacity={0.8} style={containerStyles} {...props}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? theme.colors.primaryForeground : theme.colors.foreground}
        />
      ) : typeof children === 'string' ? (
        <Text style={textStyles}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
  },
  disabled: {
    opacity: 0.6,
  },
  size_sm: {
    height: 32,
    paddingHorizontal: theme.spacing.sm,
  },
  size_md: {
    height: 40,
    paddingHorizontal: theme.spacing.lg,
  },
  size_lg: {
    height: 48,
    paddingHorizontal: theme.spacing.xl,
  },
  variant_primary: {
    backgroundColor: theme.colors.primary,
  },
  variant_secondary: {
    backgroundColor: theme.colors.secondary,
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_destructive: {
    backgroundColor: theme.colors.error,
  },
  textBase: {
    fontWeight: '600',
  },
  textSize_sm: {
    fontSize: 13,
  },
  textSize_md: {
    fontSize: 14,
  },
  textSize_lg: {
    fontSize: 16,
  },
  textVariant_primary: {
    color: theme.colors.primaryForeground,
  },
  textVariant_secondary: {
    color: theme.colors.secondaryForeground,
  },
  textVariant_outline: {
    color: theme.colors.foreground,
  },
  textVariant_ghost: {
    color: theme.colors.foreground,
  },
  textVariant_destructive: {
    color: '#ffffff',
  },
});
