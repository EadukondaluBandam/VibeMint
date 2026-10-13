import { createContext, useContext, useState, useEffect, type ReactNode, type FC } from 'react';
import type { SafeAdminUser } from '@vibemint/types';
import { adminAuthService } from '../services/adminAuthService';

export interface AdminAuthContextValue {
  adminUser: SafeAdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isForbidden: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export const AdminAuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<SafeAdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);

  const refreshAdmin = async () => {
    setIsLoading(true);
    setIsForbidden(false);
    try {
      const user = await adminAuthService.getMe();
      setAdminUser(user);
    } catch (err: unknown) {
      setAdminUser(null);
      if (
        err &&
        typeof err === 'object' &&
        'status' in err &&
        (err as { status: number }).status === 403
      ) {
        setIsForbidden(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAdmin();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setIsForbidden(false);
    try {
      const user = await adminAuthService.login(email, password);
      setAdminUser(user);
    } catch (err: unknown) {
      setAdminUser(null);
      if (
        err &&
        typeof err === 'object' &&
        'status' in err &&
        (err as { status: number }).status === 403
      ) {
        setIsForbidden(true);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await adminAuthService.logout();
    } finally {
      setAdminUser(null);
      setIsForbidden(false);
      setIsLoading(false);
    }
  };

  const value: AdminAuthContextValue = {
    adminUser,
    isAuthenticated: Boolean(adminUser && adminUser.role === 'ADMIN'),
    isLoading,
    isForbidden,
    login,
    logout,
    refreshAdmin,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = (): AdminAuthContextValue => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
