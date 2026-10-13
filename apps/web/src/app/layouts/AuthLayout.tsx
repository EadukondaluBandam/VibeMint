import type { FC } from 'react';
import { Outlet, Link } from 'react-router-dom';

export const AuthLayout: FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: '#0b0f17',
      }}
    >
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/"
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#ffffff',
            textDecoration: 'none',
          }}
        >
          VibeMint
        </Link>
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2rem',
          backgroundColor: '#0f172a',
          borderRadius: '8px',
          border: '1px solid #1e293b',
        }}
      >
        <Outlet />
      </div>
    </div>
  );
};
