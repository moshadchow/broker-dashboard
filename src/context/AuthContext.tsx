import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as authService from '../services/authService';
import { getTokens } from '../services/tokenStorage';
import type { AuthStatus, LoginRequest, User } from '../types/auth';

interface AuthContextValue {
  user:   User | null;
  status: AuthStatus;
  error:  string | null;
  login:  (payload: LoginRequest) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    const me = await authService.fetchMe();
    setUser(me);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    const tokens = getTokens();
    if (!tokens?.accessToken) {
      setStatus('unauthenticated');
      return;
    }

    refreshUser().catch(() => {
      setUser(null);
      setStatus('unauthenticated');
    });
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginRequest): Promise<User> => {
    setError(null);
    try {
      await authService.login(payload);
      const me = await authService.fetchMe();
      setUser(me);
      setStatus('authenticated');
      return me;
    } catch {
      setError('Invalid email or password.');
      throw new Error('Invalid email or password.');
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, error, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
