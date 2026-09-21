'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  createElement,
} from 'react';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  role: 'CUSTOMER' | 'CREATOR' | 'PROVIDER';
  first_name?: string;
  last_name?: string;
  phone?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// API response uses snake_case
interface AuthTokensResponse {
  access_token: string;
  refresh_token: string;
}

interface AuthRegisterResponse {
  user: any;
  access_token: string;
  refresh_token: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterData) => Promise<string>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  getProfile: () => Promise<User>;
  /**
   * Exchange the stored refresh token for a new access token. Resolves with
   * the new access token, or null when there is no refresh token / the
   * refresh was rejected — in which case the local auth state is cleared
   * (same behaviour as the mount-time refresh).
   */
  refresh: () => Promise<string | null>;
}

// ── Helpers ────────────────────────────────────────────

const TOKEN_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';

function saveTokens(tokens: AuthTokens) {
  localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function getSavedToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function getSavedRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

// ── Context ────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the current user profile
  const getProfile = useCallback(async (): Promise<User> => {
    const currentToken = token ?? getSavedToken();
    if (!currentToken) throw new Error('No token available');

    const profile = await api<User>('/auth/me', { token: currentToken });
    setUser(profile);
    return profile;
  }, [token]);

  // Exchange the stored refresh token for a fresh access token. Used on mount
  // when the saved access token is rejected, and by callers whose request came
  // back 401 with a Bearer token attached (e.g. the Kustom checkout session).
  // A rejected / missing refresh token clears the local auth state, so the app
  // stops sending a token the API will keep refusing.
  const refresh = useCallback(async (): Promise<string | null> => {
    const refreshToken = getSavedRefreshToken();
    if (!refreshToken) {
      clearTokens();
      setToken(null);
      setUser(null);
      return null;
    }
    try {
      const res = await api<AuthTokensResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const tokens: AuthTokens = {
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
      };
      saveTokens(tokens);
      setToken(tokens.accessToken);
      return tokens.accessToken;
    } catch {
      clearTokens();
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // Auto-load profile on mount when a saved token exists
  useEffect(() => {
    const saved = getSavedToken();
    if (saved) {
      setToken(saved);
      api<User>('/auth/me', { token: saved })
        .then((profile) => setUser(profile))
        .catch(async () => {
          // Token may be expired — try refreshing
          const fresh = await refresh();
          if (fresh) {
            const profile = await api<User>('/auth/me', { token: fresh });
            setUser(profile);
          }
        })
        .catch(() => {
          // Profile fetch failed even with a fresh token — treat as signed out
          clearTokens();
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Log in with email and password
  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const result = await api<AuthTokensResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const tokens: AuthTokens = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
    };
    saveTokens(tokens);
    setToken(tokens.accessToken);

    const profile = await api<User>('/auth/me', { token: tokens.accessToken });
    setUser(profile);

    window.dispatchEvent(new CustomEvent('auth-changed'));
    return profile;
  }, []);

  // Register a new account — returns the access token for immediate use
  const register = useCallback(async (data: RegisterData): Promise<string> => {
    const result = await api<AuthRegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // API returns tokens on register — save them and authenticate immediately
    if (result.access_token) {
      const tokens: AuthTokens = {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
      };
      saveTokens(tokens);
      setToken(tokens.accessToken);

      try {
        const profile = await api<User>('/auth/me', { token: tokens.accessToken });
        setUser(profile);
      } catch {
        // Profile fetch failed but token is saved
      }

      window.dispatchEvent(new CustomEvent('auth-changed'));
      return tokens.accessToken;
    }

    // Fallback: if register doesn't return tokens, login manually
    const loginResult = await api<AuthTokensResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: data.email, password: data.password }),
    });

    const tokens: AuthTokens = {
      accessToken: loginResult.access_token,
      refreshToken: loginResult.refresh_token,
    };
    saveTokens(tokens);
    setToken(tokens.accessToken);

    const profile = await api<User>('/auth/me', { token: tokens.accessToken });
    setUser(profile);

    window.dispatchEvent(new CustomEvent('auth-changed'));
    return tokens.accessToken;
  }, []);

  // Log out and clear stored tokens
  const logout = useCallback(async () => {
    const currentToken = token ?? getSavedToken();
    try {
      if (currentToken) {
        await api('/auth/logout', {
          method: 'POST',
          token: currentToken,
        });
      }
    } catch {
      // Ignore errors — clear local state regardless
    } finally {
      clearTokens();
      setToken(null);
      setUser(null);
      window.dispatchEvent(new CustomEvent('auth-changed'));
    }
  }, [token]);

  // Request a password-reset email
  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    await api('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    forgotPassword,
    getProfile,
    refresh,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

// ── Hook ───────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
