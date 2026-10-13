import type { FC } from 'react';

export const Topbar: FC = () => {
  return (
    <header
      style={{
        height: '60px',
        borderBottom: '1px solid #1e293b',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Creator Portal</span>
      <span style={{ fontSize: '0.875rem', color: '#38bdf8' }}>VibeMint Studio</span>
    </header>
  );
};
