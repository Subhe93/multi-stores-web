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

import { headerBarSection } from './HeaderBar';

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

// The same five stored headers HeaderBar.test.tsx keeps as snapshots.
const STORED_CASES: Array<[string, Record<string, unknown>, StoreContext?]> = [
  ['store logo only', {}],
  ['logo and mobile logo', { logo_url_mobile: '/uploads/stores/logo-mobile.png', logo_size: 40 }],
  ['svg logo', { logo_url: '/uploads/stores/logo.svg', logo_size: 28 }],
  ['logo size 100', { logo_size: 100 }],
  ['no logo', {}, { ...CTX, logoUrl: undefined }],
];

const COMPACT_MARKS = ['data-compact-header', 'data-header-row', 'data-header-brand', 'data-stub="scroll-state"'];

describe('header-bar compact_on_scroll: off renders the stored output', () => {
  for (const [name, settings, ctx] of STORED_CASES) {
    it(name, () => {
      const stored = html(settings, ctx);
      for (const mark of COMPACT_MARKS) expect(stored).not.toContain(mark);
      expect(html({ ...settings, compact_on_scroll: false }, ctx)).toBe(stored);
      // Only the boolean true turns it on.
      expect(html({ ...settings, compact_on_scroll: 'true' }, ctx)).toBe(stored);
      expect(html({ ...settings, compact_on_scroll: 1 }, ctx)).toBe(stored);
    });
  }
});

describe('header-bar compact_on_scroll: on', () => {
  it('marks the header, the row and the brand, and puts the scroll island right before the header', () => {
    const out = html({ compact_on_scroll: true });
    expect(out).toContain(
      '<i data-stub="scroll-state"></i><header data-compact-header="" class="sticky top-0 z-40 backdrop-blur-sm"',
    );
    expect(out).toContain('<div data-header-row="" class="flex items-center justify-between gap-4 h-16">');
    expect(out).toContain(
      '<a data-header-brand="" class="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition" href="/">',
    );
    expect(out.match(/data-compact-header/g)).toHaveLength(1);
    expect(out.match(/data-header-row/g)).toHaveLength(1);
    expect(out.match(/data-header-brand/g)).toHaveLength(1);
  });

  it('changes nothing else: without the three attributes and the island it is the stored output', () => {
    for (const [, settings, ctx] of STORED_CASES) {
      const on = html({ ...settings, compact_on_scroll: true }, ctx)
        .replace('<i data-stub="scroll-state"></i>', '')
        .replace(' data-compact-header=""', '')
        .replace(' data-header-row=""', '')
        .replace(' data-header-brand=""', '');
      expect(on).toBe(html(settings, ctx));
    }
  });

  it('works with every sticky mode except "none"', () => {
    for (const mode of ['always', 'desktop', 'mobile']) {
      expect(html({ compact_on_scroll: true, sticky_mode: mode })).toContain('data-compact-header');
    }
  });

  it('is ignored on a header that is not sticky', () => {
    const none = html({ sticky_mode: 'none' });
    expect(html({ sticky_mode: 'none', compact_on_scroll: true })).toBe(none);
    // Legacy boolean from before `sticky_mode` existed.
    const legacy = html({ sticky: false });
    expect(html({ sticky: false, compact_on_scroll: true })).toBe(legacy);
    for (const mark of COMPACT_MARKS) expect(legacy).not.toContain(mark);
  });
});

describe('header-bar compact_on_scroll: schema', () => {
  const fields = headerBarSection.schema.schema;

  it('is a boolean right after sticky_mode, off by default', () => {
    const keys = fields.map((f) => f.key);
    expect(keys[keys.indexOf('sticky_mode') + 1]).toBe('compact_on_scroll');
    const field = fields.find((f) => f.key === 'compact_on_scroll')!;
    expect(field.type).toBe('boolean');
    expect(field.defaultValue).toBe(false);
    expect(field.label).toMatchObject({ en: 'Compact on scroll', ar: 'تصغير عند التمرير' });
  });

  it('is not part of the default settings of a new header', () => {
    expect(headerBarSection.defaultSettings).not.toHaveProperty('compact_on_scroll');
  });
});
