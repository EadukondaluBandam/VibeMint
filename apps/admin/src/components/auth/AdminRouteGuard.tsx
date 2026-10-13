import type { FC } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { useAdminAuth } from '../../stores/AdminAuthContext';
import { Button } from '../ui';

export const AdminRouteGuard: FC = () => {
  const { isAuthenticated, isLoading, isForbidden, logout } = useAdminAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: colors.dark.background,
          color: colors.dark.foreground,
          gap: spacing.md,
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: `3px solid ${colors.dark.surfaceMuted}`,
            borderTopColor: colors.dark.primary,
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ color: colors.dark.mutedForeground, fontSize: '0.875rem' }}>
          Verifying administrator credentials...
        </p>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: colors.dark.background,
          padding: spacing.xl,
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: colors.dark.surface,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: radius.xl,
            padding: spacing['2xl'],
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              margin: '0 auto',
              marginBottom: spacing.md,
            }}
          >
            ✕
          </div>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: fontWeights.bold,
              color: colors.dark.foreground,
              marginBottom: spacing.xs,
            }}
          >
            Access Denied
          </h2>
          <p
            style={{
              fontSize: '0.875rem',
              color: colors.dark.mutedForeground,
              lineHeight: 1.5,
              marginBottom: spacing.xl,
            }}
          >
            Your account is authenticated, but does not possess the <strong>ADMIN</strong> role
            required to access this portal.
          </p>
          <Button
            variant="outline"
            size="md"
            onClick={() => void logout()}
            style={{ width: '100%' }}
          >
            Sign In with Different Account
          </Button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};
