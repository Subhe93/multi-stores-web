import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings, type CheckoutSettings } from '@/lib/checkoutSettings';

// Focused storefront chrome: the header is logo + "back to site" + cart and
// nothing else; the footer is legal links + back link + seller details + the
// platform line; the store 404 offers one way out (the external site).

const cart = { itemCount: 0 };
let pathname = '/products/sommarkurs';

vi.mock('next-intl', () => {
  const t = Object.assign(
    (key: string, values?: Record<string, unknown>) => (values ? `${key}:${Object.values(values).join('|')}` : key),
    { rich: (key: string, values?: Record<string, unknown>) => `${key}:${String(values?.name ?? '')}` },
  );
  return { useLocale: () => 'sv', useTranslations: (ns?: string) => (ns ? Object.assign((k: string, v?: Record<string, unknown>) => t(`${ns}.${k}`, v), { rich: t.rich }) : t) };
});
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/hooks/useCart', () => ({ useCart: () => cart }));
vi.mock('@/lib/api', () => ({ resolveMediaUrl: (u: string) => u }));
vi.mock('@/lib/storeMedia', () => ({ responsiveImgProps: (src: string) => ({ src }) }));

import { FocusedHeader } from './FocusedHeader';
import { FocusedFooter } from './FocusedFooter';
import { StoreNotFoundView } from './StoreNotFoundView';

const SITE = 'https://mollstrands.example/';
const focused = (over: Record<string, unknown> = {}) =>
  normalizeCheckoutSettings({ external_site_url: SITE, external_focus: true, ...over });

function withSettings(settings: CheckoutSettings | null, node: ReactNode) {
  return <CheckoutSettingsProvider value={settings}>{node}</CheckoutSettingsProvider>;
}

beforeEach(() => {
  cart.itemCount = 0;
  pathname = '/products/sommarkurs';
});

describe('FocusedHeader', () => {
  it('renders the logo to the site, the back link and the cart, and nothing else', () => {
    render(withSettings(focused(), <FocusedHeader storeName="Möllstrands" logoUrl="/logo.png" />));
    const header = screen.getByRole('banner');
    const links = within(header).getAllByRole('link');
    expect(links).toHaveLength(3);

    const [logo, back, cartLink] = links as [HTMLElement, HTMLElement, HTMLElement];
    expect(logo).toHaveAttribute('href', SITE);
    expect(logo).toHaveAttribute('rel', 'noreferrer');
    expect(within(logo).getByRole('img')).toHaveAttribute('alt', 'Möllstrands');

    expect(back).toHaveAttribute('href', SITE);
    expect(back).toHaveAttribute('rel', 'noreferrer');
    expect(back).toHaveTextContent('checkout.returnToSite:mollstrands.example');

    expect(cartLink).toHaveAttribute('href', '/cart');
    expect(cartLink).toHaveAccessibleName('common.cart');

    // No navigation, search, switcher, account or menu controls.
    expect(within(header).queryByRole('navigation')).toBeNull();
    expect(within(header).queryByRole('button')).toBeNull();
    expect(within(header).queryByRole('search')).toBeNull();
    expect(within(header).queryByRole('searchbox')).toBeNull();
    expect(within(header).queryByRole('combobox')).toBeNull();
  });

  it('uses the merchant label for the locale', () => {
    render(withSettings(focused({ back_label: { sv: 'Tillbaka till Möllstrands', en: 'Back' } }), <FocusedHeader storeName="Möllstrands" />));
    expect(screen.getByText('Tillbaka till Möllstrands').closest('a')).toHaveAttribute('href', SITE);
  });

  it('without a logo: the initial and the store name link to the site', () => {
    render(withSettings(focused(), <FocusedHeader storeName="möllstrands" />));
    const logo = screen.getAllByRole('link')[0]!;
    expect(logo).toHaveAttribute('href', SITE);
    expect(logo).toHaveTextContent('M');
    expect(logo).toHaveTextContent('möllstrands');
  });

  it('shows the cart count, capped at 99+', () => {
    cart.itemCount = 3;
    const { rerender } = render(withSettings(focused(), <FocusedHeader storeName="Möllstrands" />));
    expect(screen.getByRole('link', { name: 'common.cart' })).toHaveTextContent('3');
    cart.itemCount = 120;
    rerender(withSettings(focused(), <FocusedHeader storeName="Möllstrands" />));
    expect(screen.getByRole('link', { name: 'common.cart' })).toHaveTextContent('99+');
  });

  it('keeps the locale prefix on the cart link', () => {
    pathname = '/sv/products/sommarkurs';
    render(withSettings(focused(), <FocusedHeader storeName="Möllstrands" />));
    expect(screen.getByRole('link', { name: 'common.cart' })).toHaveAttribute('href', '/sv/cart');
  });

  it('hydrates without a mismatch (the cart count is 0 on the server and in the first client render)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tree = () => withSettings(focused(), <FocusedHeader storeName="Möllstrands" logoUrl="/logo.png" />);
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = renderToString(tree());
    expect(container.querySelector('[data-focused-cart]')?.textContent).toBe('');
    const root = await act(async () => hydrateRoot(container, tree()));
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelectorAll('a')).toHaveLength(3);
    await act(async () => root.unmount());
    container.remove();
    errors.mockRestore();
  });

  it('renders nothing for a store that is not focused', () => {
    const siteOnly = normalizeCheckoutSettings({ external_site_url: SITE });
    expect(render(withSettings(siteOnly, <FocusedHeader storeName="Möllstrands" />)).container).toBeEmptyDOMElement();
    expect(render(withSettings(null, <FocusedHeader storeName="Möllstrands" />)).container).toBeEmptyDOMElement();
  });
});

describe('FocusedFooter', () => {
  const legalPages = [
    { slug: 'privacy', title: 'Integritetspolicy' },
    { slug: 'terms', title: 'Villkor' },
  ];

  it('links the legal pages, the cookie page and the site; nothing else', () => {
    render(
      withSettings(
        focused(),
        <FocusedFooter storeName="Möllstrands" legalPages={legalPages} cookiePolicyHref="/om-cookies" platformName="ShopsDoor" />,
      ),
    );
    const footer = screen.getByRole('contentinfo');
    const links = within(footer).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/legal/privacy', '/legal/terms', '/om-cookies', SITE]);
    expect(links[3]).toHaveAttribute('rel', 'noreferrer');
    expect(links[3]).toHaveTextContent('checkout.returnToSite:mollstrands.example');
    expect(footer).toHaveTextContent('Möllstrands');
    expect(footer).toHaveTextContent('store.poweredBy:ShopsDoor');
    // No newsletter form or other controls.
    expect(within(footer).queryByRole('textbox')).toBeNull();
    expect(within(footer).queryByRole('button')).toBeNull();
    expect(within(footer).queryByRole('heading')).toBeNull();
  });

  it('shows the seller details when the store has them', () => {
    render(
      withSettings(
        focused(),
        <FocusedFooter
          storeName="Möllstrands"
          legalPages={legalPages}
          traderDetails={{ legal_name: 'Möllstrands AB', org_number: '5560000000', country: 'SE' } as never}
        />,
      ),
    );
    expect(screen.getByTestId('company-details')).toHaveTextContent('Möllstrands AB');
  });

  it('omits the cookie page link when the store has none', () => {
    render(withSettings(focused(), <FocusedFooter storeName="Möllstrands" legalPages={legalPages} cookiePolicyHref={null} />));
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/legal/privacy', '/legal/terms', SITE]);
  });
});

describe('StoreNotFoundView', () => {
  it('normal storefront: home and products links, unchanged', async () => {
    render(await StoreNotFoundView({ lp: '/sv' }));
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toHaveLength(2);
    expect(['/sv', '/sv/']).toContain(hrefs[0]);
    expect(hrefs[1]).toBe('/sv/products');
  });

  it('focused storefront: one link, to the external site', async () => {
    render(await StoreNotFoundView({ lp: '', backToSite: { href: SITE, label: 'Tillbaka till Möllstrands' } }));
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', SITE);
    expect(links[0]).toHaveAttribute('rel', 'noreferrer');
    expect(links[0]).toHaveTextContent('Tillbaka till Möllstrands');
  });
});
