import type { FC } from 'react';

export const DashboardPage: FC = () => {
  return (
    <section>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>VibeMint</h1>
      <h2
        style={{ fontSize: '1.25rem', color: '#94a3b8', fontWeight: 500, marginBottom: '1.5rem' }}
      >
        Creator Studio
      </h2>
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          padding: '1.5rem',
        }}
      >
        <h3 style={{ fontSize: '1.125rem' }}>Dashboard</h3>
      </div>
    </section>
  );
};
