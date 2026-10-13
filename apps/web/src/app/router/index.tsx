import type { FC } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { AppLayout } from '../layouts/AppLayout';
import { HomePage } from '../../pages/HomePage';
import { LoginPage } from '../../pages/LoginPage';
import { SignupPage } from '../../pages/SignupPage';
import { AppHomePage } from '../../pages/AppHomePage';
import { MyProfilePage } from '../../pages/MyProfilePage';
import { PublicProfilePage } from '../../pages/PublicProfilePage';
import { NotificationsPage } from '../../pages/NotificationsPage';
import { OnboardingPage } from '../../pages/OnboardingPage';
import { BlockedUsersPage } from '../../pages/BlockedUsersPage';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { ProtectedRoute, PublicAuthRoute } from './RouteGuards';

export const AppRouter: FC = () => {
  return (
    <Routes>
      {/* Public Landing & Public Profile */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/profile/:username" element={<PublicProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Guest-only Auth Routes (redirects to /home if authenticated) */}
      <Route element={<PublicAuthRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>
      </Route>

      {/* Protected App Routes (redirects to /login if unauthenticated) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/home" element={<AppHomePage />} />
          <Route path="/profile/me" element={<MyProfilePage />} />
          <Route path="/settings/blocked-users" element={<BlockedUsersPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>
    </Routes>
  );
};
