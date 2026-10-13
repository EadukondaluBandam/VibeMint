import type { FC } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { AdminRouteGuard } from '../../components/auth/AdminRouteGuard';
import { DashboardPage } from '../../pages/DashboardPage';
import { ModerationPage } from '../../pages/ModerationPage';
import { LoginPage } from '../../pages/LoginPage';
import { NotFoundPage } from '../../pages/NotFoundPage';

export const AppRouter: FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/login" element={<LoginPage />} />

      {/* Protected Administrator Routes */}
      <Route path="/admin" element={<AdminRouteGuard />}>
        <Route element={<AdminLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="moderation" element={<ModerationPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
