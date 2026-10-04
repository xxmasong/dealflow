import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LOGIN } from '../graphql/documents';
import type { User } from '../graphql/types';
import { request, setUnauthenticatedHandler, tokenStore } from './api';

interface AuthState {
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(tokenStore.get);
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    tokenStore.set(null);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => setUnauthenticatedHandler(logout), [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { login } = await request<{ login: { token: string; user: User } }>(LOGIN, { email, password });
    tokenStore.set(login.token);
    setToken(login.token);
    return login.user;
  }, []);

  const value = useMemo(() => ({ token, login, logout }), [token, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
