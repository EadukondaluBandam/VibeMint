import type { FC } from 'react';

export const Footer: FC = () => {
  return (
    <footer
      style={{
        marginTop: 'auto',
        padding: '1.5rem',
        borderTop: '1px solid #1e293b',
        backgroundColor: '#0f172a',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.875rem',
      }}
    >
      <p>VibeMint — Connect. Create. Discover. Earn.</p>
    </footer>
  );
};
