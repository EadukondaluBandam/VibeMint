import type { FC } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
}

export const Input: FC<InputProps> = ({
  label,
  error,
  helperText,
  disabled = false,
  containerStyle,
  style,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        editable={!disabled}
        placeholderTextColor={theme.colors.mutedForeground}
        style={[
          styles.input,
          error ? styles.inputError : undefined,
          disabled ? styles.inputDisabled : undefined,
          style,
        ]}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {!error && helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.label.fontSize,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
  },
  input: {
    height: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.foreground,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  inputDisabled: {
    backgroundColor: theme.colors.surfaceMuted,
    opacity: 0.6,
  },
  errorText: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  helperText: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.xs,
  },
});
