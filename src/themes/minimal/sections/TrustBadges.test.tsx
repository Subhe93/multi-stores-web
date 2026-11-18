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
    const out = strip(ITEMS);
    const tokens = classTokens(out);
    // The grid is counted in half-columns: four below 1024px (two items per
    // row), twice the items per row from there. Every item spans two.
    expect(tokens).toContain('grid-cols-4');
    expect(tokens).not.toContain('grid-cols-2');
    expect(tokens).toContain('lg:grid-cols-[repeat(calc(var(--tb-n)*2),minmax(0,1fr))]');
    expect(tokens).toContain('lg:justify-center');
    for (const li of liClasses(out)) expect(li).toContain('col-span-2');
    // Nothing switches at 768px.
    expect(
      tokens.filter(
        (c) => c.startsWith('md:grid-cols-') || c.startsWith('md:col-') || c === 'md:border-s' || c === 'md:justify-center',
      ),
    ).toEqual([]);
  });

  // ── A row with fewer items than columns is centred ────────────────────

  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ icon: 'star', label: `Badge ${i + 1}`, description: i % 2 ? '' : 'A short line' }));
  const START = /^(?:max-lg:|lg:)col-start-\d+$/;
  /** Per item: its centring classes (empty for an item that sits in a full row). */
  const starts = (n: number) =>
    liClasses(strip(many(n))).map((c) => c.filter((t) => START.test(t) || t === 'max-lg:justify-center').join(' '));

  it('below 1024px: an odd count centres the last item under the pairs', () => {
    for (let n = 1; n <= 8; n++) {
      const below = starts(n).map((s) => s.includes('max-lg:col-start-2'));
      const expected = Array.from({ length: n }, (_, i) => n % 2 === 1 && i === n - 1);
      expect(below, `${n} items`).toEqual(expected);
      // The centred item also centres its content, like the desktop cells.
      for (const [i, s] of starts(n).entries()) {
        expect(s.includes('max-lg:justify-center'), `${n} items, item ${i}`).toBe(expected[i]);
      }
    }
  });

  it('from 1024px: the first item of an incomplete last row starts half-columns in', () => {
    const lg = (n: number) => starts(n).map((s) => s.split(' ').find((t) => t.startsWith('lg:col-start-')) ?? '');
    // Up to four items fill one row: as many columns as items, nothing to offset.
    for (let n = 1; n <= 4; n++) expect(lg(n), `${n} items`).toEqual(Array(n).fill(''));
    expect(lg(5)).toEqual(['', '', '', '', 'lg:col-start-4']);
    expect(lg(6)).toEqual(['', '', '', '', 'lg:col-start-3', '']);
    expect(lg(7)).toEqual(['', '', '', '', 'lg:col-start-2', '', '']);
    expect(lg(8)).toEqual(Array(8).fill(''));
  });

  it('the exact classes of each item for one to eight items', () => {
    expect(Array.from({ length: 8 }, (_, i) => starts(i + 1))).toEqual([
      ['max-lg:col-start-2 max-lg:justify-center'],
      ['', ''],
      ['', '', 'max-lg:col-start-2 max-lg:justify-center'],
      ['', '', '', ''],
      ['', '', '', '', 'max-lg:col-start-2 max-lg:justify-center lg:col-start-4'],
      ['', '', '', '', 'lg:col-start-3', ''],
      ['', '', '', '', 'lg:col-start-2', '', 'max-lg:col-start-2 max-lg:justify-center'],
      ['', '', '', '', '', '', '', ''],
    ]);
  });

  it('the dividers still sit only between neighbours of a row', () => {
    const dividers = (n: number) =>
      liClasses(strip(many(n))).map((c) => [c.includes('max-lg:border-s'), c.includes('lg:border-s')]);
    // Three items: the third is alone below 1024px (no rule), last of the row above it.
    expect(dividers(3)).toEqual([
      [false, false],
      [true, true],
      [false, true],
    ]);
    // Six items: the centred pair of the second desktop row has one rule, between the two.
    expect(dividers(6).slice(4)).toEqual([
      [false, false],
      [true, true],
    ]);
    // Seven items: the centred row of three has two rules; the lone last item none below 1024px.
    expect(dividers(7).slice(4)).toEqual([
      [false, false],
      [true, true],
      [false, true],
    ]);
  });

  it('sets the items per row and the widest description', () => {
    const vars = (n: number) => /<ul[^>]*style="([^"]*)"/.exec(strip(many(n)))?.[1];
    expect(vars(1)).toBe('--tb-n:1;--tb-w:20rem');
    expect(vars(2)).toBe('--tb-n:2;--tb-w:20rem');
    expect(vars(3)).toBe('--tb-n:3;--tb-w:13rem');
    expect(vars(4)).toBe('--tb-n:4;--tb-w:13rem');
    expect(vars(7)).toBe('--tb-n:4;--tb-w:13rem');
  });

  it('from 1024px the description does not widen the text block', () => {
    const out = strip(ITEMS);
    const descriptions = [...out.matchAll(/<div class="([^"]*)"[^>]*>(?:Sent within two days|Encrypted checkout)<\/div>/g)].map(
      (m) => m[1],
    );
    expect(descriptions).toEqual([
      'text-xs md:text-sm leading-snug lg:max-w-[var(--tb-w)] lg:min-w-full',
      'text-xs md:text-sm leading-snug lg:max-w-[var(--tb-w)] lg:min-w-full',
    ]);
    // Only from 1024px: nothing about the width below it.
    expect(classTokens(out).filter((c) => /^(?:md:|sm:)?(?:w|min-w|max-w)-/.test(c) && c !== 'min-w-0')).toEqual([]);
  });

  it('class attributes carry no stray spaces', () => {
    for (let n = 1; n <= 8; n++) {
      for (const m of strip(many(n)).matchAll(/<li class="([^"]*)"/g)) {
        expect(m[1]).toBe(m[1].trim());
        expect(m[1]).not.toContain('  ');
      }
    }
  });

  it('right-to-left renders the same classes (grid columns follow the direction)', () => {
    const items = many(5);
    expect(html({ settings: { layout: 'strip' }, content: { items }, locale: 'ar' })).toBe(strip(items));
    expect(physicalClasses(strip(many(7)))).toEqual([]);
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
