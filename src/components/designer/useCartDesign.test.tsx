import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (k: string) => k }));
vi.mock('next/navigation', () => ({ useParams: () => ({ storeSlug: 'shop' }), usePathname: () => '/' }));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ replaceDesignLine: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ token: null, loading: false }) }));

import { CART_DESIGN_CACHE_MAX, cartDesignCacheSize, clearCartDesignCache, rememberCartDesign } from './useCartDesign';

describe('useCartDesign module cache (D25)', () => {
  beforeEach(() => clearCartDesignCache());

  it('never grows past the bound and drops the oldest entries first', () => {
    for (let i = 0; i < CART_DESIGN_CACHE_MAX + 10; i++) {
      rememberCartDesign(`d${i}`, { at: Date.now(), proofUrl: null, editable: true, productSlug: null });
    }
    expect(cartDesignCacheSize()).toBe(CART_DESIGN_CACHE_MAX);
    // Re-storing an entry moves it to the newest position.
    rememberCartDesign('d20', { at: Date.now(), proofUrl: '/p', editable: true, productSlug: null });
    for (let i = 0; i < CART_DESIGN_CACHE_MAX - 1; i++) {
      rememberCartDesign(`x${i}`, { at: Date.now(), proofUrl: null, editable: true, productSlug: null });
    }
    expect(cartDesignCacheSize()).toBe(CART_DESIGN_CACHE_MAX);
    clearCartDesignCache('d20');
    expect(cartDesignCacheSize()).toBe(CART_DESIGN_CACHE_MAX - 1);
    clearCartDesignCache();
    expect(cartDesignCacheSize()).toBe(0);
  });
});
