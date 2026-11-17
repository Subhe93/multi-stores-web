import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { TRUST_BADGE_ICON_OPTIONS, TRUST_BADGE_ICONS } from '@/lib/trustBadgeIcons';
import { trustBadgesSection } from './TrustBadges';
import { classTokens, physicalClasses } from './_shared/testHelpers';

const TrustBadges = trustBadgesSection.Component;

function html(
  props: Partial<SectionRenderProps> & { settings: Record<string, unknown>; content?: Record<string, unknown> },
) {
  return renderToStaticMarkup(
    <TrustBadges locale="en" primaryLocale="en" storeSlug="demo" content={{}} {...props} />,
  );
}

const ITEMS = [
  { icon: 'truck', label: 'Delivery', description: 'Sent within two days' },
  { icon: 'refresh', label: 'Returns' },
  { icon: 'unknown-key', label: 'Secure payment', description: 'Encrypted checkout' },
  { label: 'Support' },
];

// The snapshots were recorded before TrustBadges.tsx was edited and must stay
// byte-identical.
describe('trust-badges cards and inline output (unchanged)', () => {
  it('cards with the palette defaults', () => {
    expect(html({ settings: { ...trustBadgesSection.defaultSettings }, content: { items: ITEMS } })).toMatchSnapshot();
  });

  it('cards with nothing set', () => {
    expect(html({ settings: {}, content: { items: ITEMS } })).toMatchSnapshot();
  });

  it('inline, compact', () => {
    expect(html({ settings: { layout: 'inline', padding: 'compact' }, content: { items: ITEMS } })).toMatchSnapshot();
  });

  it('empty', () => {
    expect(html({ settings: { layout: 'cards' }, content: {} })).toMatchSnapshot();
    expect(html({ settings: { layout: 'inline' }, content: { items: [] }, locale: 'ar' })).toMatchSnapshot();
  });
});

// ── Strip layout ────────────────────────────────────────────────────────

const strip = (items: unknown[], settings: Record<string, unknown> = {}) =>
  html({ settings: { layout: 'strip', ...settings }, content: { items } });

/** Class tokens of each <li>, in order. */
const liClasses = (out: string) =>
  [...out.matchAll(/<li class="([^"]*)"/g)].map((m) => m[1].split(/\s+/));

describe('trust-badges strip layout', () => {
  it('renders a list with one item per badge and decorative icons', () => {
    const out = strip(ITEMS);
    expect(out.match(/<ul\b/g)).toHaveLength(1);
    expect(out.match(/<li\b/g)).toHaveLength(4);
    const icons = [...out.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
    expect(icons).toHaveLength(4);
    for (const icon of icons) expect(icon).toContain('aria-hidden="true"');
    expect(out).toContain('Sent within two days');
    expect(out).toContain('--tb-n:4');
  });

  it('draws a rule between neighbours of a row and never before the first item of a row', () => {
    // Four items: two per row below 1024px, four across from there.
    expect(
      liClasses(strip(ITEMS)).map((c) => [c.includes('max-lg:border-s'), c.includes('lg:border-s')]),
    ).toEqual([
      [false, false],
      [true, true],
      [false, true],
      [true, true],
    ]);
    // A fifth item starts a new row at both widths.
    const five = liClasses(strip([...ITEMS, { icon: 'star', label: 'Rated' }]));
    expect(five[4].includes('max-lg:border-s')).toBe(false);
    expect(five[4].includes('lg:border-s')).toBe(false);
    expect(strip([...ITEMS, { icon: 'star', label: 'Rated' }])).toContain('--tb-n:4');
  });

  it('stays two per row on a tablet: four across only from 1024px', () => {
    const tokens = classTokens(strip(ITEMS));
    expect(tokens).toContain('grid-cols-2');
    expect(tokens).toContain('lg:grid-cols-[repeat(var(--tb-n),minmax(0,1fr))]');
    expect(tokens).toContain('lg:justify-center');
    // Nothing switches at 768px.
    expect(tokens.filter((c) => c.startsWith('md:grid-cols-') || c === 'md:border-s' || c === 'md:justify-center')).toEqual([]);
  });

  it('one item is one cell', () => {
    const out = strip([{ icon: 'gem', label: 'Quality' }]);
    expect(out.match(/<li\b/g)).toHaveLength(1);
    expect(out).toContain('--tb-n:1');
    expect(classTokens(out)).not.toContain('lg:border-s');
    expect(classTokens(out)).not.toContain('max-lg:border-s');
  });

  it('uses logical borders only', () => {
    const out = strip(ITEMS);
    expect(physicalClasses(out)).toEqual([]);
    expect(out).not.toMatch(/border-(left|right)/);
  });

  it('icon colour: the text colour by default, overridable', () => {
    expect(strip(ITEMS)).toContain('color:var(--theme-colors-text)');
    expect(strip(ITEMS, { icon_color: '#445566' })).toContain('color:#445566');
  });

  it('resolves each new icon key and falls back to the shield for an unknown one', () => {
    const NEW: Record<string, string> = {
      graduation: 'lucide-graduation-cap',
      gem: 'lucide-gem',
      globe: 'lucide-globe',
      book: 'lucide-book-open',
      heart: 'lucide-heart',
      sparkles: 'lucide-sparkles',
    };
    for (const [key, cls] of Object.entries(NEW)) {
      expect(TRUST_BADGE_ICONS[key], key).toBeDefined();
      expect(classTokens(strip([{ icon: key, label: 'x' }])), key).toContain(cls);
    }
    expect(classTokens(strip([{ icon: 'no-such-icon', label: 'x' }]))).toContain('lucide-shield-check');
    expect(classTokens(strip([{ label: 'x' }]))).toContain('lucide-shield-check');
    // A key that names an inherited object property is unknown too, in every layout.
    for (const layout of ['strip', 'inline', 'cards']) {
      for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
        const out = html({ settings: { layout }, content: { items: [{ icon: key, label: 'x' }] } });
        expect(classTokens(out), `${layout} ${key}`).toContain('lucide-shield-check');
      }
    }
    // The six are offered after the existing eight, in the agreed order.
    expect(TRUST_BADGE_ICON_OPTIONS.map((o) => o.value)).toEqual([
      'truck', 'refresh', 'shield', 'card', 'award', 'star', 'headphones', 'leaf',
      'graduation', 'gem', 'globe', 'book', 'heart', 'sparkles',
    ]);
  });

  it('empty: the same placeholder as the other layouts', () => {
    expect(strip([])).toBe(html({ settings: { layout: 'cards' }, content: {} }));
  });

  it('schema: the strip option and its icon colour, defaults untouched', () => {
    const fields = trustBadgesSection.schema.schema;
    expect(fields.find((f) => f.key === 'layout')?.options?.map((o) => o.value)).toEqual(['cards', 'inline', 'strip']);
    expect(fields.find((f) => f.key === 'icon_color')?.showIf).toEqual({ key: 'layout', in: ['strip'] });
    expect(trustBadgesSection.schema.translatable).toEqual(['items']);
    expect(trustBadgesSection.defaultSettings).toEqual({ layout: 'cards', padding: 'comfortable' });
  });
});
