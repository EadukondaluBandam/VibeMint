import type { FC, ReactNode } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { theme } from '../../theme';

export interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated';
  bordered?: boolean;
  children: ReactNode;
}

export const Card: FC<CardProps> = ({
  variant = 'default',
  bordered = true,
  children,
  style,
  ...props
}) => {
  const containerStyles: (ViewStyle | false | undefined)[] = [
    styles.base,
    variant === 'elevated' ? styles.elevated : styles.defaultSurface,
    bordered && styles.bordered,
    style as ViewStyle,
  ];

  return (
    <View style={containerStyles} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  defaultSurface: {
    backgroundColor: theme.colors.surface,
  },
  elevated: {
    backgroundColor: theme.colors.surfaceElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  bordered: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
