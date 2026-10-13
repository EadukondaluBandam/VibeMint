import { useId, type FC, type InputHTMLAttributes } from 'react';
import { colors, radius, spacing, typography } from '@vibemint/design-tokens';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: FC<InputProps> = ({
  label,
  error,
  helperText,
  disabled = false,
  id,
  style,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: typography.Label.fontSize,
            fontWeight: typography.Label.fontWeight,
            color: disabled ? colors.dark.mutedForeground : colors.dark.foreground,
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        style={{
          height: '40px',
          padding: `0 ${spacing.md}`,
          borderRadius: radius.md,
          border: `1px solid ${error ? colors.dark.error : colors.dark.border}`,
          backgroundColor: disabled ? colors.dark.surfaceMuted : colors.dark.surface,
          color: colors.dark.foreground,
          fontSize: typography.Body.fontSize,
          outline: 'none',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          ...style,
        }}
        {...props}
      />
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontSize: typography.Caption.fontSize,
            color: colors.dark.error,
          }}
        >
          {error}
        </span>
      )}
      {!error && helperText && (
        <span
          id={helperId}
          style={{
            fontSize: typography.Caption.fontSize,
            color: colors.dark.mutedForeground,
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};
