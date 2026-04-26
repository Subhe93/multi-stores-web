'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  createElement,
} from 'react';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────

interface StoreTheme {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  [key: string]: unknown;
}

interface Store {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  favicon?: string;
  theme?: StoreTheme;
  currency?: string;
  language?: string;
  isActive?: boolean;
  creatorId?: string;
  [key: string]: unknown;
}

interface StoreState {
  store: Store | null;
  loading: boolean;
  error: string | null;
  /** True when browsing a creator's sub-store (subdomain detected) */
  isCreatorStore: boolean;
}

interface StoreContextValue extends StoreState {
  /** Manually refetch the store data */
  refresh: () => Promise<void>;
}

// ── Slug resolution ────────────────────────────────────

/**
 * Resolve the store slug from the current environment.
 * Priority:
 *   1. x-store-slug header set by middleware (not accessible client-side)
 *   2. Subdomain extracted from window.location.hostname
 */
const PLATFORM_DOMAINS = ['localhost', 'platform.com', 'www.platform.com'];

function resolveSlugFromHostname(): string | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;

  // If the hostname is a known platform domain, there is no store slug
  if (PLATFORM_DOMAINS.includes(hostname)) return null;

  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts[0] ?? null;
  }

  return null;
}

// ── Context ────────────────────────────────────────────

const StoreContext = createContext<StoreContextValue | null>(null);

// ── Provider ───────────────────────────────────────────

interface StoreProviderProps {
  children: ReactNode;
  /** Optionally pass the slug directly (e.g. from server component / middleware header) */
  slug?: string;
}

export function StoreProvider({ children, slug: slugProp }: StoreProviderProps) {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatorStore, setIsCreatorStore] = useState(false);

  const resolvedSlug = slugProp ?? resolveSlugFromHostname();

  // Fetch store data from the storefront API
  const fetchStore = async (storeSlug: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Store>(`/storefront/${storeSlug}`);
      setStore(data);
      setIsCreatorStore(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load store';
      setError(message);
      setStore(null);
      setIsCreatorStore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resolvedSlug) {
      fetchStore(resolvedSlug);
    } else {
      // No subdomain — this is the main platform, not a creator store
      setIsCreatorStore(false);
      setLoading(false);
    }
  }, [resolvedSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    if (resolvedSlug) {
      await fetchStore(resolvedSlug);
    }
  };

  const value: StoreContextValue = {
    store,
    loading,
    error,
    isCreatorStore,
    refresh,
  };

  return createElement(StoreContext.Provider, { value }, children);
}

// ── Hook ───────────────────────────────────────────────

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return ctx;
}
