import type { FC } from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: FC = () => {
  return (
    <section style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>404</h1>
      <p style={{ fontSize: '1.25rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
        Page not found
      </p>
      <Link to="/">Back to Home</Link>
    </section>
  );
};
