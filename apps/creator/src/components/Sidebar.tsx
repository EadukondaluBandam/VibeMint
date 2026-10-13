import type { FC } from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', path: '/creator/dashboard' },
  { label: 'Content', path: '/creator/content' },
  { label: 'Analytics', path: '/creator/analytics' },
  { label: 'Earnings', path: '/creator/earnings' },
  { label: 'Settings', path: '/creator/settings' },
];

export const Sidebar: FC = () => {
  return (
    <aside
      style={{
        width: '240px',
        minWidth: '200px',
        backgroundColor: '#0f172a',
        borderRight: '1px solid #1e293b',
        padding: '1.5rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <div style={{ marginBottom: '1.5rem', paddingLeft: '0.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff' }}>VibeMint</h2>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Creator Studio</span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            style={({ isActive }) => ({
              display: 'block',
              padding: '0.625rem 0.75rem',
              borderRadius: '6px',
              color: isActive ? '#ffffff' : '#94a3b8',
              backgroundColor: isActive ? '#1e293b' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 400,
              fontSize: '0.875rem',
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
