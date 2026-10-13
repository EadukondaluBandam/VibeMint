import { useState, useEffect, type FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { colors, radius, fontWeights } from '@vibemint/design-tokens';
import { useAuth } from '../stores/auth/AuthContext';
import { webNotificationsService } from '../services/notifications/notificationsService';

export const Header: FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (isAuthenticated) {
      void webNotificationsService
        .getUnreadCount()
        .then((res) => setUnreadCount(res.unreadCount))
        .catch(() => setUnreadCount(0));
    } else {
      setUnreadCount(0);
    }
  }, [isAuthenticated, location.pathname]);

  const navLinkStyle = {
    color: '#cbd5e1',
    textDecoration: 'none',
    fontSize: '0.9375rem',
    fontWeight: fontWeights.medium,
    padding: '0.375rem 0.5rem',
    borderRadius: radius.md,
    transition: 'color 0.15s ease',
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #1e293b',
        backgroundColor: '#0f172a',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      <Link
        to={isAuthenticated ? '/home' : '/'}
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#ffffff',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span>VibeMint</span>
      </Link>

      <nav style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {isAuthenticated ? (
          <>
            <Link to="/home" style={navLinkStyle}>
              Home
            </Link>

            <Link
              to="/notifications"
              style={{
                ...navLinkStyle,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                position: 'relative',
              }}
            >
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: colors.dark.primary,
                    color: colors.dark.primaryForeground,
                    fontSize: '0.6875rem',
                    fontWeight: fontWeights.bold,
                    padding: '0.125rem 0.4375rem',
                    borderRadius: radius.full,
                    minWidth: '16px',
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            <Link to="/profile/me" style={navLinkStyle}>
              Profile
            </Link>

            <button
              type="button"
              onClick={() => void logout()}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.9375rem',
                cursor: 'pointer',
                padding: '0.375rem 0.5rem',
                borderRadius: radius.md,
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/" style={navLinkStyle}>
              Public
            </Link>
            <Link to="/login" style={navLinkStyle}>
              Login
            </Link>
            <Link to="/signup" style={navLinkStyle}>
              Sign Up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
};
