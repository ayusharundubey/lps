import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiClient } from '../services/apiClient';
import type { AuthenticatedUser } from '../types/api';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  loading: boolean;
  adminBootstrapRequired: boolean;
  authMode: 'local_postgres' | 'supabase_hybrid';
  refreshAuth: () => Promise<void>;
  setUser: (user: AuthenticatedUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminBootstrapRequired, setAdminBootstrapRequired] = useState(false);
  const [authMode, setAuthMode] = useState<'local_postgres' | 'supabase_hybrid'>('local_postgres');

  const refreshAuth = useCallback(async () => {
    try {
      const status = await apiClient.getAuthStatus();
      setUser(status.user);
      setAdminBootstrapRequired(status.adminBootstrapRequired);
      setAuthMode(status.authMode);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
    await refreshAuth();
  }, [refreshAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        adminBootstrapRequired,
        authMode,
        refreshAuth,
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
