import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps, StoreContext } from '../../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
// The client children are not under test: each renders a named stub.
vi.mock('./HeaderBarMobileMenu.client', () => ({ HeaderBarMobileMenu: () => <i data-stub="mobile-menu" /> }));
vi.mock('./HeaderBarDesktopNav.client', () => ({ HeaderBarDesktopNav: () => <i data-stub="desktop-nav" /> }));
vi.mock('./ActiveLink.client', () => ({
  ActiveLink: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a data-stub="active-link" href={href}>
      {children}
    </a>
  ),
}));
vi.mock('./HeaderLocaleControl.client', () => ({ HeaderLocaleControl: () => <i data-stub="locale-switcher" /> }));
vi.mock('./HeaderCartButton.client', () => ({ HeaderCartButton: () => <i data-stub="cart" /> }));
vi.mock('./BlurOnNavigate.client', () => ({ BlurOnNavigate: () => null }));

import { headerBarSection } from './HeaderBar';
import { classTokens, imgTags, physicalClasses } from '../_shared/testHelpers';

const HeaderBar = headerBarSection.Component;

const CTX: StoreContext = {
  storeName: 'Demo Store',
  logoUrl: '/uploads/stores/logo.png',
  primaryLocale: 'en',
  secondaryLocales: ['ar'],
  pages: [],
};

function html(settings: Record<string, unknown>, storeContext: StoreContext = CTX) {
  const props: SectionRenderProps = {
    settings,
    content: {},
    locale: 'en',
    primaryLocale: 'en',
    storeSlug: 'demo',
    storeContext,
  };
  return renderToStaticMarkup(<HeaderBar {...props} />);
}

// Headers as stored today (no `logo_fit`). The snapshots were recorded before
// HeaderBar.tsx was edited and must stay byte-identical.
const STORED_CASES: Array<[string, Record<string, unknown>, StoreContext?]> = [
  ['store logo only', {}],
  ['logo and mobile logo', { logo_url_mobile: '/uploads/stores/logo-mobile.png', logo_size: 40 }],
  ['svg logo', { logo_url: '/uploads/stores/logo.svg', logo_size: 28 }],
  ['logo size 100', { logo_size: 100 }],
  ['no logo', {}, { ...CTX, logoUrl: undefined }],
];

describe('header-bar output of stored headers (unchanged)', () => {
  for (const [name, settings, ctx] of STORED_CASES) {
    it(name, () => {
      expect(html(settings, ctx)).toMatchSnapshot();
    });
  }
});

describe('header-bar logo fit', () => {
  it("'box' and an unknown value render exactly the stored output", () => {
    for (const [name, settings, ctx] of STORED_CASES) {
      const stored = html(settings, ctx);
      for (const logo_fit of ['box', 'x', '', null, 'HEIGHT', 1]) {
        expect(html({ ...settings, logo_fit }, ctx), `${name} ${String(logo_fit)}`).toBe(stored);
      }
    }
  });

  it("'height': the logo is as tall as the logo size and keeps its proportions", () => {
    const [img, ...rest] = imgTags(html({ logo_size: 40, logo_fit: 'height' }));
    expect(rest).toEqual([]);
    expect(img).toContain('style="color:transparent;height:40px;width:auto;max-width:min(200px, 50vw)"');
    expect(img).toContain('sizes="200px"');
    // Square attributes: the box is 40 x 40 until the image arrives.
    expect(img).toContain('width="40"');
    expect(img).toContain('height="40"');
    const tokens = classTokens(img);
    expect(tokens).toEqual(expect.arrayContaining(['object-contain', 'min-w-0']));
    expect(tokens).not.toContain('shrink-0');
  });

  it("'height': the mobile logo gets the same treatment", () => {
    const imgs = imgTags(html({ logo_size: 40, logo_fit: 'height', logo_url_mobile: '/uploads/stores/logo-mobile.png' }));
    expect(imgs).toHaveLength(2);
    for (const img of imgs) {
      expect(img).toContain('style="color:transparent;height:40px;width:auto;max-width:min(200px, 50vw)"');
      expect(img).toContain('sizes="200px"');
      expect(classTokens(img)).not.toContain('shrink-0');
    }
    expect(classTokens(imgs[0])).toEqual(['object-contain', 'min-w-0', 'hidden', 'md:block']);
    expect(classTokens(imgs[1])).toEqual(['object-contain', 'min-w-0', 'md:hidden']);
  });

  it("'height': a logo size above 56 is clamped to the bar", () => {
    const [img] = imgTags(html({ logo_size: 96, logo_fit: 'height' }));
    expect(img).toContain('style="color:transparent;height:56px;width:auto;max-width:min(280px, 50vw)"');
    expect(img).toContain('sizes="280px"');
    // The default logo size.
    expect(imgTags(html({ logo_fit: 'height' }))[0]).toContain('style="color:transparent;height:32px;width:auto;max-width:min(160px, 50vw)"');
  });

  it("'height': an SVG logo stays unoptimized and no logo renders no image", () => {
    const [svg] = imgTags(html({ logo_url: '/uploads/stores/logo.svg', logo_fit: 'height' }));
    expect(svg).toContain('logo.svg"');
    expect(svg).not.toContain('/_next/image');
    expect(svg).toContain('style="color:transparent;height:32px;width:auto;max-width:min(160px, 50vw)"');
    expect(imgTags(html({ logo_fit: 'height' }, { ...CTX, logoUrl: undefined }))).toEqual([]);
    expect(html({ logo_fit: 'height' }, { ...CTX, logoUrl: undefined })).toBe(html({}, { ...CTX, logoUrl: undefined }));
  });

  // In `height` mode the logo can shrink (min-w-0), so the name beside it
  // gives way first; beside the square box (shrink-0) nothing is added.
  const nameSpan = (out: string) => /<span class="([^"]*)"[^>]*>Demo Store<\/span>/.exec(out)?.[1];

  it("'height': the store name beside a logo yields before the logo shrinks", () => {
    expect(nameSpan(html({ logo_fit: 'height' }))).toBe('text-base font-semibold truncate shrink-[999]');
    // Also beside a mobile-only logo.
    expect(
      nameSpan(html({ logo_fit: 'height', logo_url_mobile: '/uploads/stores/logo-mobile.png' }, { ...CTX, logoUrl: undefined })),
    ).toBe('text-base font-semibold truncate shrink-[999]');
    // No logo drawn: the name is as in every stored header.
    expect(nameSpan(html({ logo_fit: 'height' }, { ...CTX, logoUrl: undefined }))).toBe('text-base font-semibold truncate');
    expect(nameSpan(html({ logo_fit: 'height', show_logo: false }))).toBe('text-base font-semibold truncate');
    // Name switched off: no span at all.
    expect(nameSpan(html({ logo_fit: 'height', show_store_name: false }))).toBeUndefined();
  });

  it("'box': the store name carries no extra class", () => {
    for (const logo_fit of [undefined, 'box', 'x']) {
      expect(nameSpan(html({ logo_fit }))).toBe('text-base font-semibold truncate');
    }
  });

  it('uses no physical direction classes', () => {
    expect(physicalClasses(html({ logo_fit: 'height', logo_url_mobile: '/uploads/stores/logo-mobile.png' }))).toEqual([]);
  });

  it('schema: the field sits after the logo size, defaults to the square box; new headers keep proportions', () => {
    const fields = headerBarSection.schema.schema;
    const at = fields.findIndex((f) => f.key === 'logo_fit');
    expect(at).toBeGreaterThan(0);
    expect(fields[at - 1].key).toBe('logo_size');
    expect(fields[at]).toMatchObject({ type: 'select', defaultValue: 'box' });
    expect(fields[at].options?.map((o) => o.value)).toEqual(['box', 'height']);
    expect(headerBarSection.defaultSettings?.logo_fit).toBe('height');
  });
});

describe('header-bar country/language control (M155)', () => {
  const se = { key: 'se', default_locale: 'en', locales: [], countries: ['SE'], currency: 'SEK', is_default: true, primary_hostname: 'a.se', status: 'LIVE' as const };
  const eu = { key: 'eu', default_locale: 'en', locales: [], countries: ['DE'], currency: 'EUR', is_default: false, primary_hostname: 'a.eu', status: 'LIVE' as const };
  const ONE_LANGUAGE: StoreContext = { ...CTX, secondaryLocales: [] };

  it('one language and no markets: no control', () => {
    expect(html({}, ONE_LANGUAGE)).not.toContain('data-stub="locale-switcher"');
  });

  it('one language but two markets: the control renders', () => {
    expect(html({}, { ...ONE_LANGUAGE, market: se, markets: [se, eu] })).toContain('data-stub="locale-switcher"');
    // A second market that cannot be served does not count.
    expect(html({}, { ...ONE_LANGUAGE, market: se, markets: [se, { ...eu, status: 'DRAFT' }] }))
      .not.toContain('data-stub="locale-switcher"');
  });

  it('show_locale: false hides it in region mode too', () => {
    expect(html({ show_locale: false }, { ...ONE_LANGUAGE, market: se, markets: [se, eu] }))
      .not.toContain('data-stub="locale-switcher"');
  });
});
