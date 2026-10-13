import type { FC } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CreatorLayout } from '../layouts/CreatorLayout';
import { DashboardPage } from '../../pages/DashboardPage';
import { NotFoundPage } from '../../pages/NotFoundPage';

export const AppRouter: FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/creator/dashboard" replace />} />
      <Route path="/creator" element={<CreatorLayout />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
