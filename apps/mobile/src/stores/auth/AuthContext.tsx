import { createContext, useContext, useState, useEffect, type ReactNode, type FC } from 'react';
import { mobileAuthService, type MobileAuthUser } from '../../services/auth/authService';

export interface MobileAuthContextValue {
  user: MobileAuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const MobileAuthContext = createContext<MobileAuthContextValue | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MobileAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const currentUser = await mobileAuthService.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await mobileAuthService.login(email, password);
    setUser(res.user);
  };

  const signup = async (email: string, password: string) => {
    const res = await mobileAuthService.signup(email, password);
    setUser(res.user);
  };

  const logout = async () => {
    await mobileAuthService.logout();
    setUser(null);
  };

  const value: MobileAuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    signup,
    logout,
    refreshUser,
  };

  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>;
};

export const useAuth = (): MobileAuthContextValue => {
  const context = useContext(MobileAuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
