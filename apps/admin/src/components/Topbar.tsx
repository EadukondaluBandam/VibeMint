import type { FC } from 'react';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { useAdminAuth } from '../stores/AdminAuthContext';
import { Badge, Button } from './ui';

export const Topbar: FC = () => {
  const { adminUser, logout } = useAdminAuth();

  return (
    <header
      style={{
        height: '60px',
        borderBottom: `1px solid ${colors.dark.border}`,
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${spacing.lg}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: fontWeights.semiBold,
            color: colors.dark.foreground,
          }}
        >
          VibeMint Administration
        </span>
        <Badge variant="warning">PORTAL</Badge>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
        {adminUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <span style={{ fontSize: '0.8125rem', color: colors.dark.mutedForeground }}>
              {adminUser.email}
            </span>
            <Badge variant="info">{adminUser.role}</Badge>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void logout()}
          style={{
            fontSize: '0.75rem',
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: radius.md,
          }}
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
};
