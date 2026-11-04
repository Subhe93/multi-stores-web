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
  /** Account role from /auth/me — the storefront only accepts CUSTOMER. */
  role?: string;
  /** Store the customer account belongs to (null for staff). Every customer
   *  account is scoped to exactly one store. */
  store_id?: string | null;
  /** Optional store summary of /auth/me; used to match by slug when the
   *  provider only knows the store slug (builder preview). */
  store?: { id?: string | null; slug?: string | null } | null;
  /** Customer profile row of /auth/me; the b2b fields are the company
   *  defaults used to prefill checkout (M2-DESIGN D8 / L9). */
  customer?: {
    first_name?: string;
    last_name?: string;
    phone?: string | null;
    customer_type?: 'PERSON' | 'COMPANY' | null;
    company_name?: string | null;
    org_number?: string | null;
    vat_number?: string | null;
  } | null;
}

// ── Storefront account guard ───────────────────────────
// Dashboard accounts (CREATOR / PROVIDER / ADMIN) share the same /auth/login
// endpoint but must never be signed in on the storefront, and a customer
// account only exists inside the store it was created in. `login()` rejects
// both cases with an Error carrying a code so callers can show a specific
// message; the mount/refresh paths silently drop such sessions.

export const NOT_CUSTOMER_ACCOUNT = 'NOT_CUSTOMER_ACCOUNT';
/** A customer account of another store, or a customer session where no store
 *  is known (the platform pages). Same code as the API's 403. */
export const CUSTOMER_STORE_MISMATCH = 'CUSTOMER_STORE_MISMATCH';

export interface AuthError extends Error {
  code?: string;
}

function isCustomer(profile: User): boolean {
  return profile.role === 'CUSTOMER';
}

/** Store the AuthProvider runs in. Without one (platform pages) no customer
 *  session is accepted, because every customer account belongs to a store. */
export interface AuthStoreContext {
  /** Route param `[storeSlug]`; never derived from the hostname. */
  storeSlug?: string;
  storeId?: string;
}

/**
 * Whether a customer profile belongs to the current store. The store id is
 * compared when the provider knows it; otherwise the slug of the optional
 * `store` block of /auth/me. When neither can be compared, the API's
 * store-scoped token (issued for the store_slug sent at login) is relied upon.
 */
export function profileMatchesStore(profile: User, ctx: AuthStoreContext): boolean {
  if (!ctx.storeSlug && !ctx.storeId) return false;
  if (ctx.storeId) {
    const profileStoreId = profile.store_id ?? profile.store?.id ?? null;
    return profileStoreId === ctx.storeId;
  }
  const profileSlug = profile.store?.slug;
  if (profileSlug) return profileSlug === ctx.storeSlug;
  return true;
}

function notCustomerAccountError(): AuthError {
  const err: AuthError = new Error('This is a dashboard account, not a customer account');
  err.code = NOT_CUSTOMER_ACCOUNT;
  return err;
}

function storeMismatchError(): AuthError {
  const err: AuthError = new Error('This account belongs to another store');
  err.code = CUSTOMER_STORE_MISMATCH;
  return err;
}

/** True when `err` is the rejection thrown by `login()` for a non-customer account. */
export function isNotCustomerAccountError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === NOT_CUSTOMER_ACCOUNT
  );
}

/** True when `err` says the account belongs to another store (client-side
 *  check or the API's 403 CUSTOMER_STORE_MISMATCH). */
export function isStoreMismatchError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === CUSTOMER_STORE_MISMATCH
  );
}

/** Body fields telling the API which store an auth request comes from. The
 *  API validates the hostname against the store's active hosts. */
export function storeContextBody(storeSlug?: string): { store_slug?: string; hostname?: string } {
  if (!storeSlug) return {};
  return {
    store_slug: storeSlug,
    ...(typeof window !== 'undefined' ? { hostname: window.location.hostname } : {}),
  };
}

export interface RegisterData {
  email: string;
  password: string;
  role: 'CUSTOMER' | 'CREATOR' | 'PROVIDER';
  first_name?: string;
  last_name?: string;
  phone?: string;
  /** Store context: required by the API for CUSTOMER accounts. Inside a store
   *  the provider sets it from the route, overriding these values. */
  store_slug?: string;
  hostname?: string;
  locale?: string;
}

/** Body of POST /auth/guest-register: the server generates the password
 *  and emails it together with a one-click login link. */
export interface GuestRegisterData {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  store_slug?: string;
  hostname?: string;
  locale?: string;
}

/** Token pair as returned by /auth/login, /auth/register and /auth/magic-login. */
export interface AuthTokensPayload {
  access_token: string;
  refresh_token: string;
  user?: { role?: string } | null;
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
  user: User;
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
  /** Create a CUSTOMER with a server-generated password (guest checkout).
   *  Resolves with the access token, like `register`. */
  registerGuest: (data: GuestRegisterData) => Promise<string>;
  /**
   * Sign in with a token pair obtained elsewhere (e.g. /auth/magic-login).
   * Only CUSTOMER accounts of the current store are accepted; others reject
   * with NOT_CUSTOMER_ACCOUNT / CUSTOMER_STORE_MISMATCH and nothing is kept.
   */
  loginWithTokens: (data: AuthTokensPayload) => Promise<User>;
  /**
   * Redeem an emailed magic-link token. Inside a store the store context is
   * sent, so the API refuses (without spending the single-use link) a link
   * that belongs to another store's customer. Then as loginWithTokens.
   */
  loginWithMagicToken: (token: string) => Promise<User>;
  /**
   * Swap in a fresh token pair for the signed-in account (change-password
   * returns one: the API revokes every token issued before the change).
   */
  replaceTokens: (data: { access_token: string; refresh_token: string }) => void;
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

/** The access token in storage, for a flow that needs the token of a session
 *  created a moment ago, before React state has caught up. */
export function readStoredAccessToken(): string | null {
  return getSavedToken();
}

function getSavedRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

// ── Context ────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────

export function AuthProvider({
  children,
  storeSlug,
  storeId,
}: { children: ReactNode } & AuthStoreContext) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Drop the stored session and the in-memory auth state in one place.
  const clearAuth = useCallback(() => {
    clearTokens();
    setToken(null);
    setUser(null);
  }, []);

  // Accept a /auth/me profile: a customer of this store is kept; staff
  // accounts and customers of another store are signed out immediately.
  // Returns null when accepted, else the error describing the rejection.
  const applyProfile = useCallback(
    (profile: User): AuthError | null => {
      if (!isCustomer(profile)) {
        clearAuth();
        return notCustomerAccountError();
      }
      if (!profileMatchesStore(profile, { storeSlug, storeId })) {
        clearAuth();
        return storeMismatchError();
      }
      setUser(profile);
      return null;
    },
    [clearAuth, storeSlug, storeId],
  );

  // applyProfile() for flows that must fail loudly on a rejected profile.
  const acceptProfile = useCallback(
    (profile: User): User => {
      const rejected = applyProfile(profile);
      if (rejected) throw rejected;
      return profile;
    },
    [applyProfile],
  );

  // Profile of an account created a moment ago. A failed fetch keeps the
  // saved token; a rejected profile signs out and throws.
  const loadNewAccountProfile = useCallback(
    async (accessToken: string): Promise<void> => {
      let profile: User;
      try {
        profile = await api<User>('/auth/me', { token: accessToken });
      } catch {
        return;
      }
      acceptProfile(profile);
    },
    [acceptProfile],
  );

  // Fetch the current user profile
  const getProfile = useCallback(async (): Promise<User> => {
    const currentToken = token ?? getSavedToken();
    if (!currentToken) throw new Error('No token available');

    const profile = await api<User>('/auth/me', { token: currentToken });
    return acceptProfile(profile);
  }, [token, acceptProfile]);

  // Exchange the stored refresh token for a fresh access token. Used on mount
  // when the saved access token is rejected, and by callers whose request came
  // back 401 with a Bearer token attached (e.g. the Kustom checkout session).
  // A rejected / missing refresh token clears the local auth state, so the app
  // stops sending a token the API will keep refusing. Refresh tokens are bound
  // to the user id, so no store context is sent.
  // `expose: false` (mount) stores the new pair but keeps it out of React
  // state until the caller has accepted the profile.
  const refreshTokens = useCallback(async (expose: boolean): Promise<string | null> => {
    const refreshToken = getSavedRefreshToken();
    if (!refreshToken) {
      clearAuth();
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
      if (expose) setToken(tokens.accessToken);
      return tokens.accessToken;
    } catch {
      clearAuth();
      return null;
    }
  }, [clearAuth]);
  const refresh = useCallback(() => refreshTokens(true), [refreshTokens]);

  // Auto-load profile on mount when a saved token exists. A dashboard account
  // or another store's customer still in storage is signed out here.
  useEffect(() => {
    const saved = getSavedToken();
    if (saved) {
      // The saved token reaches React state (cart sync, checkout, account
      // pages) only once its profile is accepted: on a shared origin
      // (localhost, /store/[slug] paths) it may be another store's session,
      // whose cart must not load here nor receive this store's guest lines.
      api<User>('/auth/me', { token: saved })
        .then((profile) => {
          if (!applyProfile(profile)) setToken(saved);
        })
        .catch(async () => {
          // Token may be expired — try refreshing
          const fresh = await refreshTokens(false);
          if (fresh) {
            const profile = await api<User>('/auth/me', { token: fresh });
            if (!applyProfile(profile)) setToken(fresh);
          }
        })
        .catch(() => {
          // Profile fetch failed even with a fresh token — treat as signed out
          clearAuth();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Log in with email and password
  const login = useCallback(async (email: string, password: string): Promise<User> => {
    // Customer accounts are per store: the store context selects the account.
    const result = await api<AuthTokensResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...storeContextBody(storeSlug) }),
    });

    const tokens: AuthTokens = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
    };
    saveTokens(tokens);
    setToken(tokens.accessToken);

    const profile = await api<User>('/auth/me', { token: tokens.accessToken });
    // Dashboard accounts and other stores' customers are rejected: the
    // just-saved tokens are wiped again and the caller gets a coded error.
    acceptProfile(profile);

    window.dispatchEvent(new CustomEvent('auth-changed'));
    return profile;
  }, [acceptProfile, storeSlug]);

  // Store a token pair from another sign-in flow (magic link). Mirrors
  // login(): the profile decides, and dashboard accounts are rejected.
  const loginWithTokens = useCallback(async (data: AuthTokensPayload): Promise<User> => {
    // Reject early when the response already says it is not a customer, so
    // the tokens never touch storage.
    if (data.user?.role && data.user.role !== 'CUSTOMER') throw notCustomerAccountError();

    const tokens: AuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
    saveTokens(tokens);
    setToken(tokens.accessToken);

    const profile = await api<User>('/auth/me', { token: tokens.accessToken });
    acceptProfile(profile);

    window.dispatchEvent(new CustomEvent('auth-changed'));
    return profile;
  }, [acceptProfile]);

  const loginWithMagicToken = useCallback(async (magicToken: string): Promise<User> => {
    const data = await api<AuthTokensPayload>('/auth/magic-login', {
      method: 'POST',
      body: JSON.stringify({ token: magicToken, ...storeContextBody(storeSlug) }),
    });
    return loginWithTokens(data);
  }, [loginWithTokens, storeSlug]);

  const replaceTokens = useCallback((data: { access_token: string; refresh_token: string }) => {
    saveTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
    setToken(data.access_token);
  }, []);

  // Guest checkout account: the server picks the password and emails it.
  const registerGuest = useCallback(async (data: GuestRegisterData): Promise<string> => {
    const result = await api<AuthRegisterResponse>('/auth/guest-register', {
      method: 'POST',
      body: JSON.stringify({ ...data, ...storeContextBody(storeSlug) }),
    });
    const tokens: AuthTokens = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
    };
    saveTokens(tokens);
    setToken(tokens.accessToken);

    await loadNewAccountProfile(tokens.accessToken);

    window.dispatchEvent(new CustomEvent('auth-changed'));
    return tokens.accessToken;
  }, [storeSlug, loadNewAccountProfile]);

  // Register a new account — returns the access token for immediate use
  const register = useCallback(async (data: RegisterData): Promise<string> => {
    const context = storeContextBody(storeSlug);
    const result = await api<AuthRegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...data, ...context }),
    });

    // API returns tokens on register — save them and authenticate immediately
    if (result.access_token) {
      const tokens: AuthTokens = {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
      };
      saveTokens(tokens);
      setToken(tokens.accessToken);

      await loadNewAccountProfile(tokens.accessToken);

      window.dispatchEvent(new CustomEvent('auth-changed'));
      return tokens.accessToken;
    }

    // Fallback: if register doesn't return tokens, login manually
    const loginResult = await api<AuthTokensResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: data.email, password: data.password, ...context }),
    });

    const tokens: AuthTokens = {
      accessToken: loginResult.access_token,
      refreshToken: loginResult.refresh_token,
    };
    saveTokens(tokens);
    setToken(tokens.accessToken);

    const profile = await api<User>('/auth/me', { token: tokens.accessToken });
    acceptProfile(profile);

    window.dispatchEvent(new CustomEvent('auth-changed'));
    return tokens.accessToken;
  }, [storeSlug, loadNewAccountProfile, acceptProfile]);

  // Log out and clear stored tokens
  const logout = useCallback(async () => {
    const currentToken = token ?? getSavedToken();
    try {
      if (currentToken) {
        // The refresh token goes along so the API records it as revoked; a
        // copy stolen earlier then stops working too.
        const refreshToken = getSavedRefreshToken();
        await api('/auth/logout', {
          method: 'POST',
          token: currentToken,
          ...(refreshToken && {
            body: JSON.stringify({ refresh_token: refreshToken }),
          }),
        });
      }
    } catch {
      // Ignore errors — clear local state regardless
    } finally {
      clearAuth();
      window.dispatchEvent(new CustomEvent('auth-changed'));
    }
  }, [token, clearAuth]);

  // Request a password-reset email for this store's customer account (staff
  // only when there is no store context). The API answers generically.
  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    await api('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, ...storeContextBody(storeSlug) }),
    });
  }, [storeSlug]);

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    register,
    registerGuest,
    loginWithTokens,
    loginWithMagicToken,
    replaceTokens,
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
