import { fireEvent, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// M156 §5: client link builders read the request's path prefix from the
// StorePathPrefix context; without one they keep their legacy formula.

const nav = vi.hoisted(() => ({ pathname: '/products' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('next-intl', () => ({ useLocale: () => 'de' }));

import { StorePathPrefixProvider, useStorePathPrefix } from './useStorePathPrefix';
import { useLocalePath } from './useLocalePath';
import { MarketProvider } from './useMarket';
import { LocaleSwitcher } from '@/themes/minimal/sections/chrome/LocaleSwitcher.client';
import { footerColumnsSection } from '@/themes/minimal/sections/chrome/FooterColumns';
import { sectionHref } from '@/themes/minimal/sections/_shared/links';
import { NAMEZ_EU, NAMEZ_EU_LEGACY, NAMEZ_SE } from '@/lib/localePaths.fixtures';

const withPrefix = (value?: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StorePathPrefixProvider value={value}>{children}</StorePathPrefixProvider>;
  };

describe('StorePathPrefix context', () => {
  it('useStorePathPrefix: the provided prefix, else the legacy formula', () => {
    expect(renderHook(() => useStorePathPrefix('de', 'en'), { wrapper: withPrefix('/de-at') }).result.current).toBe('/de-at');
    expect(renderHook(() => useStorePathPrefix('en', 'en'), { wrapper: withPrefix('') }).result.current).toBe('');
    expect(renderHook(() => useStorePathPrefix('de', 'en')).result.current).toBe('/de');
    expect(renderHook(() => useStorePathPrefix('en', 'en')).result.current).toBe('');
  });

  it('useLocalePath: the provided prefix wins; without it the pathname detection runs as before', () => {
    nav.pathname = '/store/namez/products';
    expect(renderHook(() => useLocalePath(), { wrapper: withPrefix('/de-at') }).result.current('/cart')).toBe('/de-at/cart');
    expect(renderHook(() => useLocalePath(), { wrapper: withPrefix('') }).result.current('/cart')).toBe('/cart');
    expect(renderHook(() => useLocalePath()).result.current('/cart')).toBe('/cart');
    nav.pathname = '/de/pricing';
    expect(renderHook(() => useLocalePath()).result.current('/cart')).toBe('/de/cart');
  });
});

describe('section links with pathPrefix', () => {
  it('sectionHref keeps a /de-at visitor on /de-at', () => {
    expect(sectionHref('/collections/a', { locale: 'de', primaryLocale: 'en', pathPrefix: '/de-at' })).toBe('/de-at/collections/a');
    expect(sectionHref('/de-at/x', { locale: 'de', primaryLocale: 'en', pathPrefix: '/de-at' })).toBe('/de-at/x');
    expect(sectionHref('https://example.com', { locale: 'de', primaryLocale: 'en', pathPrefix: '/de-at' })).toBe('https://example.com');
    // Legacy: unchanged.
    expect(sectionHref('/collections/a', { locale: 'de', primaryLocale: 'en' })).toBe('/de/collections/a');
    expect(sectionHref('', { locale: 'de', primaryLocale: 'en' })).toBe('#');
  });

  it('FooterColumns links use the request prefix', () => {
    const FooterColumns = footerColumnsSection.Component;
    const content = { columns: [{ heading: 'Shop', links: [{ label: 'All', url: '/products' }, { label: 'Home', url: '/' }] }] };
    const props = { settings: {}, content, locale: 'de', primaryLocale: 'en', storeSlug: 'namez-se', chrome: true };
    const at = render(<FooterColumns {...props} pathPrefix="/de-at" />);
    expect([...at.container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/de-at/products', '/de-at']);
    at.unmount();
    const legacy = render(<FooterColumns {...props} />);
    expect([...legacy.container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/de/products', '/de']);
  });
});

describe('LocaleSwitcher on a locale-path market', () => {
  const assign = vi.fn();
  function stubLocation(pathname: string) {
    vi.stubGlobal('location', { ...window.location, pathname, search: '', hash: '', protocol: 'http:', href: `http://localhost${pathname}`, assign });
  }
  afterEach(() => {
    vi.unstubAllGlobals();
    assign.mockReset();
  });

  function renderSwitcher(market: typeof NAMEZ_EU, preferred: string | null, current = 'de') {
    return render(
      <MarketProvider market={market} markets={[NAMEZ_SE, market]} preferredCountry={preferred}>
        <LocaleSwitcher current={current} primary="en" others={['de', 'fr', 'ar']} accent="#111" bg="#fff" fg="#000" borderColor="#ddd" />
      </MarketProvider>,
    );
  }

  const pick = (container: HTMLElement, index: number) => {
    // The list stays open after a pick (navigation is stubbed): open it only once.
    if (!container.querySelector('[role="menuitem"]')) fireEvent.click(container.querySelector('button')!);
    fireEvent.click(container.querySelectorAll('[role="menuitem"]')[index]!);
  };

  it('maps the language to the path of the visitor\'s country', () => {
    stubLocation('/de-at/products/x');
    const r = renderSwitcher(NAMEZ_EU, 'AT');
    pick(r.container, 0); // English
    expect(assign).toHaveBeenLastCalledWith('/products/x');
    // AT lists [en, de, ar]: fr has no AT path, so it is not offered.
    pick(r.container, 2); // Arabic (language-only path)
    expect(assign).toHaveBeenLastCalledWith('/ar/products/x');
    r.unmount();
    stubLocation('/products/x');
    const be = renderSwitcher(NAMEZ_EU, 'BE', 'en');
    // BE lists [en, fr, ar]: de has no BE path.
    pick(be.container, 1); // French
    expect(assign).toHaveBeenLastCalledWith('/fr-be/products/x');
  });

  it('regression: a market without paths keeps /<locale>', () => {
    stubLocation('/de/products/x');
    const r = renderSwitcher(NAMEZ_EU_LEGACY, 'AT');
    pick(r.container, 2);
    expect(assign).toHaveBeenLastCalledWith('/fr/products/x');
  });
});
