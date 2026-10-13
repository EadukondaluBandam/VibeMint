import type { FC } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

export const AppLayout: FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main
        style={{
          flex: 1,
          padding: '2rem 1.5rem',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
