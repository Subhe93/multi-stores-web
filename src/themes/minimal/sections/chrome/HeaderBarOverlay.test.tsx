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
vi.mock('./HeaderScrollState.client', () => ({ HeaderScrollState: () => <i data-stub="scroll-state" /> }));
vi.mock('./HeaderOverlayHome.client', () => ({
  HeaderOverlayHome: ({ homeHref }: { homeHref: string }) => <i data-stub="overlay-home" data-href={homeHref} />,
}));

import { headerBarSection, parseOverlayHero } from './HeaderBar';

const HeaderBar = headerBarSection.Component;

const CTX: StoreContext = {
  storeName: 'Demo Store',
  logoUrl: '/uploads/stores/logo.png',
  primaryLocale: 'en',
  secondaryLocales: ['ar'],
  pages: [],
};

function html(settings: Record<string, unknown>, storeContext: StoreContext = CTX, locale = 'en') {
  const props: SectionRenderProps = {
    settings,
    content: {},
    locale,
    primaryLocale: 'en',
    storeSlug: 'demo',
    storeContext,
  };
  return renderToStaticMarkup(<HeaderBar {...props} />);
}

// The same five stored headers HeaderBar.test.tsx keeps as snapshots.
const STORED_CASES: Array<[string, Record<string, unknown>, StoreContext?]> = [
  ['store logo only', {}],
  ['logo and mobile logo', { logo_url_mobile: '/uploads/stores/logo-mobile.png', logo_size: 40 }],
  ['svg logo', { logo_url: '/uploads/stores/logo.svg', logo_size: 28 }],
  ['logo size 100', { logo_size: 100 }],
  ['no logo', {}, { ...CTX, logoUrl: undefined }],
];

const OVERLAY_MARKS = [
  'data-overlay-header',
  'data-overlay-scrim',
  'data-header-logo',
  '--hb-fg',
  'data-stub="scroll-state"',
  'data-stub="overlay-home"',
];

describe('header-bar overlay_hero: off renders the stored output', () => {
  for (const [name, settings, ctx] of STORED_CASES) {
    it(name, () => {
      const stored = html(settings, ctx);
      for (const mark of OVERLAY_MARKS) expect(stored).not.toContain(mark);
      expect(html({ ...settings, overlay_hero: 'off' }, ctx)).toBe(stored);
      expect(html({ ...settings, overlay_hero: 'yes' }, ctx)).toBe(stored);
      expect(html({ ...settings, overlay_hero: true }, ctx)).toBe(stored);
      // The companion settings do nothing while the overlay is off.
      expect(
        html({ ...settings, overlay_scrim: 'none', logo_url_light: '/uploads/stores/logo-white.png' }, ctx),
      ).toBe(stored);
    });
  }

  it('parses only home and all', () => {
    expect(parseOverlayHero('home')).toBe('home');
    expect(parseOverlayHero('all')).toBe('all');
    for (const raw of [undefined, null, '', 'off', 'HOME', 1, true]) expect(parseOverlayHero(raw)).toBe('off');
  });
});

describe('header-bar overlay_hero: on', () => {
  it("'all' marks the header (soft scrim by default) and puts the scroll island right before it", () => {
    const out = html({ overlay_hero: 'all' });
    expect(out).toContain(
      '<i data-stub="scroll-state"></i><header data-overlay-header="all" data-overlay-scrim="soft" class="sticky top-0 z-40 backdrop-blur-sm"',
    );
    expect(out).toContain('--hb-fg:var(--theme-colors-text)');
    expect(out).not.toContain('data-stub="overlay-home"');
    expect(out.match(/data-header-logo=""/g)).toHaveLength(1);
  });

  it("'home' adds the home gate as the header's first child with the localized home URL", () => {
    expect(html({ overlay_hero: 'home' })).toContain(
      '<header data-overlay-header="home" data-overlay-scrim="soft"',
    );
    expect(html({ overlay_hero: 'home' })).toMatch(/style="[^"]*"><i data-stub="overlay-home" data-href="\/"><\/i><div class="mx-auto/);
    expect(html({ overlay_hero: 'home' }, CTX, 'ar')).toContain('data-href="/ar"');
  });

  it('scrim none, and the solid text colour of a custom header', () => {
    const out = html({ overlay_hero: 'all', overlay_scrim: 'none', text_color: '#222222' });
    expect(out).toContain('data-overlay-scrim="none"');
    expect(out).toContain('--hb-fg:#222222');
  });

  it('marks both logos, and renders the light logo after them', () => {
    const out = html({
      overlay_hero: 'all',
      logo_url_mobile: '/uploads/stores/logo-mobile.png',
      logo_url_light: '/uploads/stores/logo-white.png',
    });
    expect(out.match(/data-header-logo=""/g)).toHaveLength(2);
    expect(out.match(/data-header-logo-light=""/g)).toHaveLength(1);
    expect(out.indexOf('data-header-logo-light')).toBeGreaterThan(out.lastIndexOf('data-header-logo=""'));
    expect(out).toContain('logo-white.png');
    // Hidden with the logo.
    expect(html({ overlay_hero: 'all', show_logo: false, logo_url_light: '/x.png' })).not.toContain(
      'data-header-logo-light',
    );
  });

  it('changes nothing else: without its marks it is the stored output', () => {
    for (const [, settings, ctx] of STORED_CASES) {
      const on = html({ ...settings, overlay_hero: 'all' }, ctx)
        .replace('<i data-stub="scroll-state"></i>', '')
        .replace(' data-overlay-header="all" data-overlay-scrim="soft"', '')
        .replace(/;--hb-fg:[^;"]*/, '')
        .replaceAll(' data-header-logo=""', '');
      expect(on).toBe(html(settings, ctx));
    }
  });

  it('works with compact_on_scroll (one scroll island) and without sticky', () => {
    const both = html({ overlay_hero: 'all', compact_on_scroll: true });
    expect(both).toContain('<i data-stub="scroll-state"></i><header data-compact-header="" data-overlay-header="all"');
    expect(both.match(/data-stub="scroll-state"/g)).toHaveLength(1);
    const none = html({ overlay_hero: 'all', sticky_mode: 'none' });
    expect(none).toContain('<i data-stub="scroll-state"></i><header data-overlay-header="all" data-overlay-scrim="soft" class="relative z-40');
  });
});

describe('header-bar overlay_hero: schema', () => {
  const fields = headerBarSection.schema.schema;
  const keys = fields.map((f) => f.key);

  it('three fields right after accent_color, not in the default settings', () => {
    const at = keys.indexOf('accent_color');
    expect(keys.slice(at + 1, at + 4)).toEqual(['overlay_hero', 'overlay_scrim', 'logo_url_light']);
    const hero = fields.find((f) => f.key === 'overlay_hero')!;
    expect(hero.type).toBe('select');
    expect(hero.defaultValue).toBe('off');
    expect(hero.options?.map((o) => o.value)).toEqual(['off', 'home', 'all']);
    expect(hero.label).toMatchObject({ en: 'Transparent over the first section' });
    const scrim = fields.find((f) => f.key === 'overlay_scrim')!;
    expect(scrim.defaultValue).toBe('soft');
    expect(scrim.options?.map((o) => o.value)).toEqual(['soft', 'none']);
    expect(fields.find((f) => f.key === 'logo_url_light')!.type).toBe('image');
    for (const k of ['overlay_hero', 'overlay_scrim', 'logo_url_light']) {
      expect(headerBarSection.defaultSettings).not.toHaveProperty(k);
    }
  });
});
