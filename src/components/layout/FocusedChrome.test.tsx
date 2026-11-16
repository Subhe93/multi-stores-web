import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings, type CheckoutSettings } from '@/lib/checkoutSettings';

// Focused storefront chrome: the header is logo + "back to site" + cart and
// the purchase step indicator, nothing else; the footer is a brand band with
// the seller's contact block, the `footer` menu (else the legal pages), the
// back link and the legal line; the store 404 offers one way out (the
// external site). Back links follow the remembered `?back` page of the tab.

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
vi.mock('@/lib/storeMedia', () => ({
  responsiveImgProps: (src: string) => ({ src }),
  isSvgSrc: (src: string) => src.endsWith('.svg'),
}));

import { FocusedHeader } from './FocusedHeader';
import { FocusedFooter } from './FocusedFooter';
import { FocusedBackCapture } from './FocusedBackCapture';
import { useContinueShoppingLink } from '@/hooks/useFocusedStorefront';
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
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
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

describe('FocusedHeader: proportions, steps and the remembered back page', () => {
  const BACK_KEY = 'ms-focus-back:mollstrands.example';

  it('back link: full label as the accessible name, a short text for phones', () => {
    render(withSettings(focused({ back_label: { sv: 'Tillbaka till Möllstrands Trafikskola' } }), <FocusedHeader storeName="Möllstrands" logoUrl="/logo.svg" />));
    const back = screen.getByRole('link', { name: 'Tillbaka till Möllstrands Trafikskola' });
    expect(back).toHaveAttribute('data-focused-back');
    // Full label from lg up, the short one below (hidden under 380px).
    expect(within(back).getByText('Tillbaka till Möllstrands Trafikskola')).toHaveClass('hidden', 'lg:inline');
    const short = within(back).getByText('focused.backShort');
    expect(short).toHaveClass('hidden', 'min-[380px]:inline', 'lg:hidden');
    // Never truncated mid-word.
    expect(back.innerHTML).not.toContain('truncate');
    expect(short).toHaveClass('whitespace-nowrap');
  });

  it('caps the logo in both directions', () => {
    render(withSettings(focused(), <FocusedHeader storeName="Möllstrands" logoUrl="/logo.svg" logoSize={120} />));
    const img = screen.getByRole('img', { name: 'Möllstrands' });
    expect(img).toHaveClass('h-7', 'max-w-[132px]', 'md:h-[34px]', 'md:max-w-[200px]');
    expect(img.getAttribute('style')).toBeNull();
  });

  it.each([
    ['/products/sommarkurs', 'details'],
    ['/sv/products/sommarkurs', 'details'],
    ['/store/mollstrands/products/sommarkurs', 'details'],
    ['/cart', 'cart'],
    ['/sv/cart', 'cart'],
    ['/checkout', 'payment'],
    ['/checkout/kustom', 'payment'],
  ])('step indicator on %s: %s is the current step', (path, step) => {
    pathname = path;
    render(withSettings(focused(), <FocusedHeader storeName="Möllstrands" />));
    const list = screen.getByRole('list', { name: 'focused.stepsLabel' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-step'))).toEqual(['details', 'cart', 'payment']);
    expect(items.map((li) => li.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('focused.stepDetails')]));
    const current = items.filter((li) => li.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('data-step', step);
    // Steps before the current one are done, the ones after it upcoming.
    const states = items.map((li) => li.getAttribute('data-step-state'));
    const index = ['details', 'cart', 'payment'].indexOf(step);
    expect(states).toEqual(['details', 'cart', 'payment'].map((_s, i) => (i < index ? 'done' : i === index ? 'current' : 'upcoming')));
  });

  it.each([['/legal/privacy'], ['/checkout/confirmation'], ['/om-cookies'], ['/products'], ['/']])('no step indicator on %s', (path) => {
    pathname = path;
    render(withSettings(focused(), <FocusedHeader storeName="Möllstrands" />));
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('uses logical (RTL-safe) classes only', () => {
    cart.itemCount = 2;
    const { container } = render(
      <div dir="rtl">{withSettings(focused(), <FocusedHeader storeName="متجر" logoUrl="/logo.svg" />)}</div>,
    );
    const classes = [...container.querySelectorAll('[class]')].flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/));
    const physical = classes.filter((c) => /^(?:[a-z-]+:)*-?(?:ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)-/.test(c));
    expect(physical).toEqual([]);
    // The arrow points against the reading direction.
    expect(container.querySelector('[data-focused-back] svg')).toHaveClass('rtl:rotate-180');
  });

  it('logo and back link go to the remembered site page (validated), else the site root', () => {
    window.sessionStorage.setItem(BACK_KEY, '/product/testlektion-60-min/');
    const first = render(withSettings(focused(), <FocusedHeader storeName="Möllstrands" logoUrl="/logo.svg" />));
    const hrefs = () => [...first.container.querySelectorAll('[data-focused-logo], [data-focused-back]')].map((a) => a.getAttribute('href'));
    expect(hrefs()).toEqual(['https://mollstrands.example/product/testlektion-60-min/', 'https://mollstrands.example/product/testlektion-60-min/']);
    first.unmount();

    // A tampered stored value is ignored: never another host.
    for (const evil of ['//evil.com', 'https://evil.com/', '/\\evil.com', '/%2F%2Fevil.com']) {
      window.sessionStorage.setItem(BACK_KEY, evil);
      const view = render(withSettings(focused(), <FocusedHeader storeName="Möllstrands" />));
      expect(view.container.querySelector('[data-focused-back]')).toHaveAttribute('href', SITE);
      view.unmount();
    }
  });

  it('the server HTML carries the site root; the remembered page is applied after hydration without a mismatch', async () => {
    window.sessionStorage.setItem(BACK_KEY, '/kurser/b-korkort/');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tree = () => withSettings(focused(), <FocusedHeader storeName="Möllstrands" logoUrl="/logo.png" />);
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = renderToString(tree());
    expect(container.querySelector('[data-focused-back]')?.getAttribute('href')).toBe(SITE);
    expect(container.querySelector('[data-focused-logo]')?.getAttribute('href')).toBe(SITE);
    const root = await act(async () => hydrateRoot(container, tree()));
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelector('[data-focused-back]')?.getAttribute('href')).toBe('https://mollstrands.example/kurser/b-korkort/');
    expect(container.querySelector('[data-focused-logo]')?.getAttribute('href')).toBe('https://mollstrands.example/kurser/b-korkort/');
    await act(async () => root.unmount());
    container.remove();
    errors.mockRestore();
  });

  it('a product page with ?back replaces the remembered page; a refused value keeps it', async () => {
    window.sessionStorage.setItem(BACK_KEY, '/old/');
    window.history.replaceState({}, '', '/products/sommarkurs?qty=1&back=%2Fproduct%2Ftestlektion-60-min%2F');
    const view = render(
      withSettings(
        focused(),
        <>
          <FocusedHeader storeName="Möllstrands" />
          <FocusedBackCapture />
        </>,
      ),
    );
    await act(async () => undefined);
    expect(view.container.querySelector('[data-focused-back]')).toHaveAttribute('href', 'https://mollstrands.example/product/testlektion-60-min/');
    expect(window.sessionStorage.getItem(BACK_KEY)).toBe('/product/testlektion-60-min/');
    view.unmount();

    window.history.replaceState({}, '', '/products/sommarkurs?back=%2F%2Fevil.com');
    const second = render(
      withSettings(
        focused(),
        <>
          <FocusedHeader storeName="Möllstrands" />
          <FocusedBackCapture />
        </>,
      ),
    );
    await act(async () => undefined);
    expect(second.container.querySelector('[data-focused-back]')).toHaveAttribute('href', 'https://mollstrands.example/product/testlektion-60-min/');
    expect(window.sessionStorage.getItem(BACK_KEY)).toBe('/product/testlektion-60-min/');
  });

  it('a store without the flag never reads or writes the back page', async () => {
    window.history.replaceState({}, '', '/products/sommarkurs?back=%2Fkurs%2F');
    const siteOnly = normalizeCheckoutSettings({ external_site_url: SITE });
    render(withSettings(siteOnly, <FocusedBackCapture />));
    await act(async () => undefined);
    expect(window.sessionStorage.length).toBe(0);
  });
});

describe('useContinueShoppingLink', () => {
  function Probe({ fallback }: { fallback: string }) {
    const link = useContinueShoppingLink(fallback);
    return <a data-testid="probe" {...link} />;
  }

  it('store without settings: the fallback, no rel (unchanged)', () => {
    render(withSettings(null, <Probe fallback="/products" />));
    const a = screen.getByTestId('probe');
    expect(a).toHaveAttribute('href', '/products');
    expect(a).not.toHaveAttribute('rel');
  });

  it('site without the flag: the site root (unchanged), even with a remembered page', () => {
    window.sessionStorage.setItem('ms-focus-back:mollstrands.example', '/kurs/');
    render(withSettings(normalizeCheckoutSettings({ external_site_url: SITE }), <Probe fallback="/products" />));
    const a = screen.getByTestId('probe');
    expect(a).toHaveAttribute('href', SITE);
    expect(a).toHaveAttribute('rel', 'noreferrer');
  });

  it('focused: the remembered page, else the site root', () => {
    const first = render(withSettings(focused(), <Probe fallback="/products" />));
    expect(screen.getByTestId('probe')).toHaveAttribute('href', SITE);
    first.unmount();
    window.sessionStorage.setItem('ms-focus-back:mollstrands.example', '/kurs/?a=b#c');
    render(withSettings(focused(), <Probe fallback="/products" />));
    expect(screen.getByTestId('probe')).toHaveAttribute('href', 'https://mollstrands.example/kurs/?a=b#c');
    expect(screen.getByTestId('probe')).toHaveAttribute('rel', 'noreferrer');
  });
});

describe('FocusedFooter', () => {
  const legalPages = [
    { slug: 'privacy', title: 'Integritetspolicy' },
    { slug: 'terms', title: 'Villkor' },
  ];
  const menuLinks = [
    { label: 'Köpvillkor', url: 'https://mollstrands.example/kopvillkor/' },
    { label: 'Integritetspolicy', url: 'https://mollstrands.example/integritetspolicy/' },
    { label: 'Presentkort', url: '/products/presentkort' },
    { label: 'Karta', url: 'https://maps.example/x', open_in_new_tab: true },
    { label: '', url: '/empty-label' },
  ];
  const seller = {
    legal_name: 'Möllstrands Trafikskola AB',
    org_number: '5594616228',
    country: 'SE',
    address_line1: 'Kopparmöllegatan 11A',
    postal_code: '254 35',
    city: 'Helsingborg',
    phone: '042-10 61 11',
    support_email: 'kontakt@mollstrands.example',
  };
  const linksNav = (footer: HTMLElement) => footer.querySelector('[data-focused-footer-links]') as HTMLElement;

  it('without a footer menu: the legal pages, the cookie page and the site link', () => {
    render(
      withSettings(
        focused(),
        <FocusedFooter storeName="Möllstrands" legalPages={legalPages} cookiePolicyHref="/om-cookies" platformName="ShopsDoor" />,
      ),
    );
    const footer = screen.getByRole('contentinfo');
    expect(linksNav(footer)).toHaveAttribute('data-focused-footer-links', 'legal');
    expect(within(linksNav(footer)).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/legal/privacy', '/legal/terms', '/om-cookies']);
    const back = footer.querySelector('[data-focused-back]');
    expect(back).toHaveAttribute('href', SITE);
    expect(back).toHaveAttribute('rel', 'noreferrer');
    expect(back).toHaveTextContent('checkout.returnToSite:mollstrands.example');
    expect(footer).toHaveTextContent('Möllstrands');
    expect(footer).toHaveTextContent('store.poweredBy:ShopsDoor');
    // The cookie settings entry point is the only control; no newsletter form.
    expect(within(footer).queryByRole('textbox')).toBeNull();
    const buttons = within(footer).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute('data-consent-settings-link');
  });

  it('with a footer menu: its items ARE the links (absolute as given, relative as store links); no /legal list', () => {
    pathname = '/sv/products/sommarkurs';
    render(
      withSettings(
        focused(),
        <FocusedFooter storeName="Möllstrands" menuLinks={menuLinks} legalPages={legalPages} cookiePolicyHref="/om-cookies" />,
      ),
    );
    const nav = linksNav(screen.getByRole('contentinfo'));
    expect(nav).toHaveAttribute('data-focused-footer-links', 'menu');
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Köpvillkor', 'https://mollstrands.example/kopvillkor/'],
      ['Integritetspolicy', 'https://mollstrands.example/integritetspolicy/'],
      ['Presentkort', '/sv/products/presentkort'],
      ['Karta', 'https://maps.example/x'],
      ['consent.cookiePolicy', '/sv/om-cookies'],
    ]);
    expect(links[3]).toHaveAttribute('target', '_blank');
    expect(links[3]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(links[0]).not.toHaveAttribute('target');
    expect(nav.innerHTML).not.toContain('/legal/');
  });

  it('an empty footer menu falls back to the legal pages', () => {
    render(withSettings(focused(), <FocusedFooter storeName="Möllstrands" menuLinks={[{ label: ' ', url: '' }]} legalPages={legalPages} />));
    expect(linksNav(screen.getByRole('contentinfo'))).toHaveAttribute('data-focused-footer-links', 'legal');
  });

  it('seller details: contact block with tel: and mailto: links, legal name and organisation number', () => {
    render(withSettings(focused(), <FocusedFooter storeName="Möllstrands" legalPages={legalPages} traderDetails={seller as never} />));
    const footer = screen.getByRole('contentinfo');
    const contact = footer.querySelector('[data-focused-footer-contact]') as HTMLElement;
    expect(contact.tagName).toBe('ADDRESS');
    expect(contact).toHaveTextContent('Kopparmöllegatan 11A');
    expect(contact).toHaveTextContent('254 35 Helsingborg');
    expect(within(contact).getByRole('link', { name: '042-10 61 11' })).toHaveAttribute('href', 'tel:042106111');
    expect(within(contact).getByRole('link', { name: 'kontakt@mollstrands.example' })).toHaveAttribute('href', 'mailto:kontakt@mollstrands.example');
    const legal = footer.querySelector('[data-focused-footer-legal]');
    expect(legal).toHaveTextContent(`© ${new Date().getFullYear()} Möllstrands Trafikskola AB`);
    expect(legal).toHaveTextContent('footer.companyDetailsOrgNr 559461-6228');
  });

  it('only the seller fields that exist are shown', () => {
    const { rerender } = render(
      withSettings(focused(), <FocusedFooter storeName="Möllstrands" traderDetails={{ legal_name: 'Möllstrands AB', phone: '+46 42 10 61 11' } as never} />),
    );
    let footer = screen.getByRole('contentinfo');
    let contact = footer.querySelector('[data-focused-footer-contact]') as HTMLElement;
    expect(within(contact).getAllByRole('link')).toHaveLength(1);
    expect(within(contact).getByRole('link')).toHaveAttribute('href', 'tel:+4642106111');
    expect(footer.querySelector('[data-focused-footer-legal]')).not.toHaveTextContent('footer.companyDetailsOrgNr');

    rerender(withSettings(focused(), <FocusedFooter storeName="Möllstrands" traderDetails={null} />));
    footer = screen.getByRole('contentinfo');
    contact = footer.querySelector('[data-focused-footer-contact]') as HTMLElement;
    expect(contact).toBeNull();
    expect(footer.querySelector('[data-focused-footer-legal]')).toHaveTextContent(`© ${new Date().getFullYear()} Möllstrands`);
  });

  it('marketplace seller: the "sold by" line and the VAT number stay', () => {
    render(
      withSettings(
        focused(),
        <FocusedFooter
          storeName="Butik"
          traderDetails={{ legal_name: 'Namez AB', org_number: '5560000000', vat_number: 'SE556000000001', country: 'SE', is_platform: true, platform_brand: 'ShopsDoor' } as never}
        />,
      ),
    );
    expect(screen.getByTestId('company-details-sold-by')).toHaveTextContent('footer.companyDetailsSoldBy:Namez AB|ShopsDoor');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('footer.companyDetailsVat SE556000000001');
  });

  it('logo on the dark band: SVG as a white silhouette (+ faded mark), raster on a light plate, else the store name', () => {
    const svg = render(withSettings(focused(), <FocusedFooter storeName="Möllstrands" logoUrl="/uploads/logo.svg" />));
    const silhouette = svg.container.querySelector('[data-focused-footer-logo="silhouette"]');
    expect(silhouette).toHaveClass('focused-footer-light');
    expect(silhouette).toHaveAttribute('alt', 'Möllstrands');
    const mark = svg.container.querySelector('[data-focused-footer-mark]');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveAttribute('alt', '');
    svg.unmount();

    const png = render(withSettings(focused(), <FocusedFooter storeName="Möllstrands" logoUrl="/uploads/logo.png" />));
    const plate = png.container.querySelector('[data-focused-footer-logo="plate"]');
    expect(plate).toHaveClass('bg-white');
    expect(plate?.querySelector('img')).not.toHaveClass('focused-footer-light');
    expect(png.container.querySelector('[data-focused-footer-mark]')).toBeNull();
    png.unmount();

    const none = render(withSettings(focused(), <FocusedFooter storeName="Möllstrands" />));
    expect(none.container.querySelector('[data-focused-footer-logo="name"]')).toHaveTextContent('Möllstrands');
    expect(none.container.querySelector('img')).toBeNull();
  });

  it('omits the cookie page link when the store has none', () => {
    render(withSettings(focused(), <FocusedFooter storeName="Möllstrands" legalPages={legalPages} cookiePolicyHref={null} />));
    expect(within(linksNav(screen.getByRole('contentinfo'))).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/legal/privacy', '/legal/terms']);
  });

  it('RTL: logical classes only, the address keeps its own direction', () => {
    const { container } = render(
      <div dir="rtl">
        {withSettings(focused(), <FocusedFooter storeName="متجر" logoUrl="/logo.svg" menuLinks={menuLinks} traderDetails={seller as never} cookiePolicyHref="/om-cookies" />)}
      </div>,
    );
    const classes = [...container.querySelectorAll('[class]')].flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/));
    const physical = classes.filter((c) => /^(?:[a-z-]+:)*-?(?:ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)-/.test(c));
    expect(physical).toEqual([]);
    expect(container.querySelector('[data-focused-footer-contact] bdi')).toHaveTextContent('Kopparmöllegatan 11A');
    expect(container.querySelector('[data-focused-footer-contact] a[href^="tel:"]')).toHaveAttribute('dir', 'ltr');
    expect(container.querySelector('[data-focused-back] svg')).toHaveClass('rtl:rotate-180');
  });

  it('the back link follows the remembered site page', () => {
    window.sessionStorage.setItem('ms-focus-back:mollstrands.example', '/product/testlektion-60-min/');
    render(withSettings(focused(), <FocusedFooter storeName="Möllstrands" />));
    expect(screen.getByRole('contentinfo').querySelector('[data-focused-back]')).toHaveAttribute('href', 'https://mollstrands.example/product/testlektion-60-min/');
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
