import type { FC } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../stores/auth/AuthContext';

export const ProtectedRoute: FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
          color: '#94a3b8',
        }}
      >
        <span>Loading session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Redirect users with incomplete onboarding to /onboarding
  if (user && user.onboardingCompleted === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Redirect users who already completed onboarding away from /onboarding
  if (user && user.onboardingCompleted === true && location.pathname === '/onboarding') {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
};

export const PublicAuthRoute: FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
          color: '#94a3b8',
        }}
      >
        <span>Loading...</span>
      </div>
    );
  }

  if (isAuthenticated) {
    if (user && user.onboardingCompleted === false) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
};
