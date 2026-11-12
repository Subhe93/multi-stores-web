import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mobileBottomNavSection } from './MobileBottomNav';
import { OPEN_MOBILE_MENU_EVENT } from './mobileMenuEvent';

// next-intl: return the key so labels are assertable without a provider.
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  usePathname: () => '/products',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push, prefetch: vi.fn() }),
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ itemCount: 0 }) }));

const BottomNav = mobileBottomNavSection.Component;

function renderNav(items: Record<string, unknown>[], locale = 'sv') {
  return render(
    <BottomNav settings={{}} content={{ items }} locale={locale} primaryLocale="sv" storeSlug="demo" />,
  );
}

afterEach(() => push.mockReset());

describe('MobileBottomNav', () => {
  it('labels built-in items through the message catalogue', () => {
    renderNav([{ type: 'home' }, { type: 'cart' }]);
    expect(screen.getByRole('navigation', { name: 'nav.mobileNavigation' })).toBeTruthy();
    expect(screen.getByText('common.home')).toBeTruthy();
    expect(screen.getByText('common.cart')).toBeTruthy();
  });

  it('points Search and Categories at different pages, so one is active at a time', () => {
    renderNav([{ type: 'search' }, { type: 'categories' }]);
    const search = screen.getByText('common.search').closest('a')!;
    const categories = screen.getByText('common.categories').closest('a')!;
    expect(search.getAttribute('href')).toBe('/products');
    expect(categories.getAttribute('href')).toBe('/collections');
    expect(search.getAttribute('aria-current')).toBe('page');
    expect(categories.getAttribute('aria-current')).toBeNull();
  });

  it('links home to the bare locale prefix, also for a typed "/"', () => {
    renderNav([{ type: 'home' }, { type: 'custom', label: 'Start', url: '/' }], 'ar');
    expect(screen.getByText('common.home').closest('a')!.getAttribute('href')).toBe('/ar');
    expect(screen.getByText('Start').closest('a')!.getAttribute('href')).toBe('/ar');
  });

  it('opens the header drawer from the menu item', () => {
    const listener = vi.fn((e: Event) => e.preventDefault());
    window.addEventListener(OPEN_MOBILE_MENU_EVENT, listener);
    renderNav([{ type: 'menu', url: '/collections' }]);
    fireEvent.click(screen.getByRole('button', { name: 'nav.menu' }));
    expect(listener).toHaveBeenCalledTimes(1);
    // Handled by the drawer: the typed fallback URL is not followed.
    expect(push).not.toHaveBeenCalled();
    window.removeEventListener(OPEN_MOBILE_MENU_EVENT, listener);
  });

  it('follows the typed URL when no drawer answers', () => {
    renderNav([{ type: 'menu', url: '/collections' }]);
    fireEvent.click(screen.getByRole('button', { name: 'nav.menu' }));
    expect(push).toHaveBeenCalledWith('/collections');
  });

  it('skips legacy wishlist items without a URL', () => {
    renderNav([{ type: 'wishlist' }, { type: 'home' }]);
    expect(screen.queryByText('nav.wishlist')).toBeNull();
  });

  it('reserves room at the end of the page for the fixed bar', () => {
    const { container } = renderNav([{ type: 'home' }]);
    const css = container.querySelector('style')?.innerHTML ?? '';
    expect(css).toContain('#store-nav-footer::after');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('max-width: 767.98px');
  });
});
