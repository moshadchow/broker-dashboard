import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as authService from '../services/authService';
import { getSession } from '../services/tokenStorage';
import { SESSION_INVALIDATED_EVENT, installAuthInterceptors } from '../services/authInterceptor';
import type { AuthState } from '../types/auth';

interface AuthContextValue extends AuthState {
  login:  (loginId: string, password: string, mfaCode?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionToUser(session: ReturnType<typeof getSession>): AuthState['user'] {
  if (!session) return null;
  return { userId: session.userId, displayName: session.displayName, email: session.email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'checking',
    user:   null,
    mfaKey: null,
    error:  null,
  });

  useEffect(() => {
    installAuthInterceptors();

    const session = getSession();
    setState({
      status: session ? 'authenticated' : 'unauthenticated',
      user:   sessionToUser(session),
      mfaKey: null,
      error:  null,
    });

    function onSessionInvalidated() {
      setState({ status: 'unauthenticated', user: null, mfaKey: null, error: null });
    }

    window.addEventListener(SESSION_INVALIDATED_EVENT, onSessionInvalidated);
    return () => window.removeEventListener(SESSION_INVALIDATED_EVENT, onSessionInvalidated);
  }, []);

  async function login(loginId: string, password: string, mfaCode?: string) {
    setState(s => ({ ...s, status: 'checking', error: null }));
    try {
      const mfaKey = state.mfaKey ?? '';
      const data = await authService.login(loginId, password, mfaKey, mfaCode ?? '');

      if (data.isMfaRequired) {
        setState({ status: 'mfa-required', user: null, mfaKey: data.mfaKey, error: null });
        return;
      }

      setState({
        status: 'authenticated',
        user:   { userId: data.userId, displayName: data.displayName, email: data.email },
        mfaKey: null,
        error:  null,
      });
    } catch (err) {
      setState(s => ({
        ...s,
        status: s.status === 'mfa-required' ? 'mfa-required' : 'unauthenticated',
        error:  err instanceof Error ? err.message : 'Login failed',
      }));
    }
  }

  function logout() {
    authService.logout();
    setState({ status: 'unauthenticated', user: null, mfaKey: null, error: null });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
