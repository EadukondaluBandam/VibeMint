import type { FC } from 'react';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { useAdminAuth } from '../stores/AdminAuthContext';
import { Badge, Card } from '../components/ui';

export const DashboardPage: FC = () => {
  const { adminUser } = useAdminAuth();

  return (
    <section style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ marginBottom: spacing['2xl'] }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.xs,
          }}
        >
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: fontWeights.bold,
              color: colors.dark.foreground,
              margin: 0,
            }}
          >
            Administrator Dashboard
          </h1>
          <Badge variant="success">Authenticated</Badge>
        </div>
        <p style={{ color: colors.dark.mutedForeground, fontSize: '0.9375rem', margin: 0 }}>
          Role-Based Access Control (RBAC) foundation active for VibeMint operator portal
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: spacing.lg,
          marginBottom: spacing['2xl'],
        }}
      >
        {/* Administrator Profile Card */}
        <Card
          style={{
            padding: spacing.xl,
            backgroundColor: colors.dark.surface,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: radius.xl,
          }}
        >
          <h2
            style={{
              fontSize: '1.125rem',
              fontWeight: fontWeights.semiBold,
              color: colors.dark.foreground,
              marginBottom: spacing.md,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <span>👤</span> Verified Administrator Identity
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: colors.dark.mutedForeground,
                  display: 'block',
                }}
              >
                Email Address
              </span>
              <span
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: fontWeights.medium,
                  color: colors.dark.foreground,
                }}
              >
                {adminUser?.email || 'N/A'}
              </span>
            </div>

            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: colors.dark.mutedForeground,
                  display: 'block',
                }}
              >
                Assigned Role
              </span>
              <div style={{ marginTop: '2px' }}>
                <Badge variant="info">{adminUser?.role || 'ADMIN'}</Badge>
              </div>
            </div>

            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: colors.dark.mutedForeground,
                  display: 'block',
                }}
              >
                Account Status
              </span>
              <div style={{ marginTop: '2px' }}>
                <Badge variant="success">{adminUser?.status || 'ACTIVE'}</Badge>
              </div>
            </div>

            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: colors.dark.mutedForeground,
                  display: 'block',
                }}
              >
                Administrator User ID
              </span>
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontFamily: 'monospace',
                  color: colors.dark.mutedForeground,
                  wordBreak: 'break-all',
                }}
              >
                {adminUser?.id || 'N/A'}
              </span>
            </div>

            {adminUser?.createdAt && (
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: colors.dark.mutedForeground,
                    display: 'block',
                  }}
                >
                  Member Since
                </span>
                <span style={{ fontSize: '0.8125rem', color: colors.dark.mutedForeground }}>
                  {new Date(adminUser.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Security & Moderation Readiness Card */}
        <Card
          style={{
            padding: spacing.xl,
            backgroundColor: colors.dark.surface,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: radius.xl,
          }}
        >
          <h2
            style={{
              fontSize: '1.125rem',
              fontWeight: fontWeights.semiBold,
              color: colors.dark.foreground,
              marginBottom: spacing.md,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <span>🛡️</span> System Status & Permissions
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            <div
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: radius.md,
                padding: `${spacing.sm} ${spacing.md}`,
                color: '#4ade80',
                fontSize: '0.8125rem',
                lineHeight: 1.4,
              }}
            >
              <strong>Backend RBAC:</strong> Protected by <code>requireAdmin</code> server-side
              authorization. Public role alteration is prohibited.
            </div>

            <div
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: radius.md,
                padding: `${spacing.sm} ${spacing.md}`,
                color: '#38bdf8',
                fontSize: '0.8125rem',
                lineHeight: 1.4,
              }}
            >
              <strong>Session Security:</strong> Server-verified session tokens with HttpOnly cookie
              support and strict CSRF protection.
            </div>

            <div
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: radius.md,
                padding: `${spacing.sm} ${spacing.md}`,
                color: '#4ade80',
                fontSize: '0.8125rem',
                lineHeight: 1.4,
              }}
            >
              <strong>Part 16 Moderation Queue:</strong> Admin moderation queue & review workflow is
              active with validated status transitions, durable audit trail, and target context
              investigation.{' '}
              <a
                href="/admin/moderation"
                style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 600 }}
              >
                Open Moderation Queue &rarr;
              </a>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};
