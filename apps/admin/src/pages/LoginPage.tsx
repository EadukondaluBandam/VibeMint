import { useState, type FC, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { useAdminAuth } from '../stores/AdminAuthContext';
import { Button, Input } from '../components/ui';

export const LoginPage: FC = () => {
  const { isAuthenticated, isLoading, login } = useAdminAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated as admin, redirect to dashboard
  if (!isLoading && isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both email and password');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await login(trimmedEmail, password);
      navigate('/admin/dashboard', { replace: true });
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Login failed. Please check your credentials.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: colors.dark.background,
        padding: spacing.md,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: colors.dark.surface,
          border: `1px solid ${colors.dark.border}`,
          borderRadius: radius.xl,
          padding: spacing['2xl'],
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: radius.lg,
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              color: colors.dark.primary,
              fontSize: '1.5rem',
              marginBottom: spacing.sm,
            }}
          >
            🛡️
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: fontWeights.bold,
              color: colors.dark.foreground,
              margin: '0 0 0.25rem 0',
            }}
          >
            VibeMint Admin
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: colors.dark.mutedForeground,
              margin: 0,
            }}
          >
            Enter your credentials to access the administrative portal
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              color: '#f87171',
              fontSize: '0.875rem',
              marginBottom: spacing.lg,
              lineHeight: 1.4,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
        >
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@vibemint.internal"
            autoComplete="email"
            disabled={submitting}
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            autoComplete="current-password"
            disabled={submitting}
            required
          />

          <div style={{ marginTop: spacing.sm }}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={submitting}
              style={{ width: '100%' }}
            >
              Sign In to Portal
            </Button>
          </div>
        </form>

        <p
          style={{
            marginTop: spacing.xl,
            textAlign: 'center',
            fontSize: '0.75rem',
            color: colors.dark.mutedForeground,
          }}
        >
          Protected System · Unauthorized access is prohibited
        </p>
      </div>
    </div>
  );
};
